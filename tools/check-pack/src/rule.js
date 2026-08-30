/**
 * rule - every entry point a package declares must actually be in its tarball.
 *
 * The consumer fixtures in fixtures/ load node-opcua through a pnpm workspace symlink,
 * which resolves against the working tree. That catches a wrong `exports` condition or a
 * missing named export, but it cannot catch a packaging fault: a `main`, `types` or
 * `exports` target that `files`/.npmignore leaves out of the published tarball. Nothing
 * in CI looked at what npm would actually ship, so that class of bug could only be found
 * by publishing it.
 *
 * That matters now because FEAT-3 adds real `exports` maps to 116 packages, and an
 * exports map is a promise about files that exist.
 *
 * The npm call is kept at the edge (packFileList) so the interesting logic stays pure and
 * the tests can hand it fabricated file lists instead of packing anything.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const SOURCE_ROOTS = ["packages", "packages_extra"];

/** normalise "./dist/index.js" and "dist/index.js" to the tarball's form */
const normalize = (p) => p.replace(/^\.\//, "").replace(/\\/g, "/");

/**
 * Every path a manifest promises, from main/types/typings/module/browser and every
 * string leaf of exports. Pure, so the tests can drive it directly.
 * Returns [{ field, target }].
 */
export function declaredEntryPoints(pkg) {
    const out = [];
    for (const field of ["main", "types", "typings", "module"]) {
        if (typeof pkg[field] === "string") {
            out.push({ field, target: pkg[field] });
        }
    }
    // browser may be a string or a mapping
    if (typeof pkg.browser === "string") {
        out.push({ field: "browser", target: pkg.browser });
    } else if (pkg.browser && typeof pkg.browser === "object") {
        for (const [k, v] of Object.entries(pkg.browser)) {
            if (typeof v === "string") {
                out.push({ field: `browser["${k}"]`, target: v });
            }
        }
    }
    const walkExports = (node, trail) => {
        if (typeof node === "string") {
            out.push({ field: `exports${trail}`, target: node });
            return;
        }
        if (node && typeof node === "object") {
            for (const [k, v] of Object.entries(node)) {
                walkExports(v, `${trail}["${k}"]`);
            }
        }
    };
    if (pkg.exports !== undefined) {
        walkExports(pkg.exports, "");
    }
    return out;
}

/**
 * Which declared entry points are absent from the packed file list.
 * `packedFiles` is an array of tarball-relative paths. Pure.
 */
export function missingEntryPoints(pkg, packedFiles) {
    const shipped = new Set(packedFiles.map(normalize));
    const out = [];
    for (const { field, target } of declaredEntryPoints(pkg)) {
        // only relative targets describe a file in this tarball; a bare specifier in an
        // exports map is a redirect to another package and is not ours to verify
        if (!target.startsWith(".") && !target.startsWith("/")) {
            continue;
        }
        if (!shipped.has(normalize(target))) {
            out.push({ field, target });
        }
    }
    return out;
}

/** every publishable workspace package: [{ name, dir, pkg }] */
export function publishablePackages(repoRoot = ".", packageFilter) {
    const out = [];
    for (const root of SOURCE_ROOTS) {
        const full = path.join(repoRoot, root);
        if (!fs.existsSync(full)) {
            continue;
        }
        for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
            if (!entry.isDirectory()) {
                continue;
            }
            if (packageFilter && entry.name !== packageFilter) {
                continue;
            }
            const dir = path.join(full, entry.name);
            const manifest = path.join(dir, "package.json");
            if (!fs.existsSync(manifest)) {
                continue;
            }
            const pkg = JSON.parse(fs.readFileSync(manifest, "utf8"));
            if (pkg.private === true) {
                continue;
            }
            out.push({ name: pkg.name ?? entry.name, dir, pkg });
        }
    }
    return out;
}

/** ask npm what it would ship. --ignore-scripts so no prepack hook runs. */
export function packFileList(dir) {
    const stdout = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
        cwd: dir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32"
    });
    const parsed = JSON.parse(stdout);
    const entry = Array.isArray(parsed) ? parsed[0] : parsed;
    return (entry?.files ?? []).map((f) => f.path);
}

export function analyze({ repoRoot = ".", packageFilter, pack = packFileList } = {}) {
    const packages = publishablePackages(repoRoot, packageFilter);
    const findings = [];
    const failures = [];
    for (const { name, dir, pkg } of packages) {
        let files;
        try {
            files = pack(dir);
        } catch (err) {
            failures.push({ name, error: (err?.message ?? String(err)).split("\n")[0] });
            continue;
        }
        for (const m of missingEntryPoints(pkg, files)) {
            findings.push({ name, dir: dir.replace(/\\/g, "/"), ...m });
        }
    }
    return { scanned: packages.length, findings, failures };
}

export function exitCode(result) {
    return result.findings.length > 0 || result.failures.length > 0 ? 1 : 0;
}

export function formatReport(result) {
    const lines = [];
    if (result.findings.length === 0 && result.failures.length === 0) {
        lines.push(`check-pack: ${result.scanned} publishable packages, every declared entry point is in the tarball.`);
        return lines.join("\n");
    }
    if (result.findings.length) {
        lines.push(`check-pack: ${result.findings.length} declared entry points are not shipped, across ${result.scanned} packages`, "");
        for (const f of result.findings) {
            lines.push(`  ${f.name}`);
            lines.push(`      ${f.field} -> ${f.target}   (not in the tarball)`);
        }
        lines.push("");
        lines.push("A package that names a file in main, types or exports promises that file");
        lines.push("is published. Check the `files` field and .npmignore.");
    }
    if (result.failures.length) {
        lines.push("", `${result.failures.length} packages could not be packed:`);
        for (const f of result.failures) {
            lines.push(`  ${f.name}: ${f.error}`);
        }
    }
    return lines.join("\n");
}
