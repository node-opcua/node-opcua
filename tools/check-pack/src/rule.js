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
    // main/types/typings/module/browser always name a file in this package, with or without a
    // leading "./". Only an exports target can be a bare specifier redirecting elsewhere, so
    // fromExports records which rule applies; see missingEntryPoints.
    for (const field of ["main", "types", "typings", "module"]) {
        if (typeof pkg[field] === "string") {
            out.push({ field, target: pkg[field], fromExports: false });
        }
    }
    // browser may be a string or a mapping
    if (typeof pkg.browser === "string") {
        out.push({ field: "browser", target: pkg.browser, fromExports: false });
    } else if (pkg.browser && typeof pkg.browser === "object") {
        for (const [k, v] of Object.entries(pkg.browser)) {
            if (typeof v === "string") {
                out.push({ field: `browser["${k}"]`, target: v, fromExports: false });
            }
        }
    }
    const walkExports = (node, trail) => {
        if (typeof node === "string") {
            out.push({ field: `exports${trail}`, target: node, fromExports: true });
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
    const shippedList = packedFiles.map(normalize);
    const shipped = new Set(shippedList);
    const out = [];
    for (const { field, target, fromExports } of declaredEntryPoints(pkg)) {
        // a bare specifier in an exports map is a redirect to another package and is not ours
        // to verify. main/types/module/browser have no such form: "dist/index.js" is the same
        // file as "./dist/index.js", and skipping the unprefixed spelling silently exempted a
        // third of the workspace, including a package that shipped no dist at all.
        if (fromExports && !target.startsWith(".") && !target.startsWith("/")) {
            continue;
        }
        const wanted = normalize(target);
        // a subpath pattern ("./dist/*.js") promises every file the star can expand to; it
        // is kept only if at least one shipped file matches, otherwise it promises nothing
        const star = wanted.indexOf("*");
        if (star >= 0) {
            const prefix = wanted.slice(0, star);
            const suffix = wanted.slice(star + 1);
            const hit = shippedList.some(
                (f) => f.length > prefix.length + suffix.length && f.startsWith(prefix) && f.endsWith(suffix)
            );
            if (!hit) {
                out.push({ field, target });
            }
            continue;
        }
        if (!shipped.has(wanted)) {
            out.push({ field, target });
        }
    }
    return out;
}

// --- build output without a source ---------------------------------------------------
//
// A release built from a working tree whose dist folder was not cleaned ships the build
// output of a source file that no longer exists. Nothing imports such a file, so no test
// notices it, but it is published and a consumer can still load it by its path. The rule
// below asks, for every shipped build file, whether a source file still produces it.
//
// Package layouts differ (dist, dist-esm, distNodeJS, distHelpers; rootDir source, src, ".",
// or computed), so the rule does not read tsconfig files. It compares paths: a build file
// dist*/<rel>.js has a source when <rel>.ts exists at the package root or below any top
// folder. dist/foo/bar.js matches source/foo/bar.ts; dist/source/x.js (rootDir ".")
// matches source/x.ts.

/** a top-level folder that holds build output */
export const isBuildDir = (segment) => /^dist/i.test(segment);

const BUILD_FILE = /(\.d)?\.[mc]?(js|ts)(\.map)?$/;
const SOURCE_FILE = /(\.d)?\.[mc]?(ts|tsx|js|jsx)$/;

/**
 * The keys a set of package-relative source paths can satisfy: each path without its
 * extension, from the package root and from below its top folder. Pure.
 */
export function sourceKeys(sourceFiles) {
    const keys = new Set();
    for (const file of sourceFiles) {
        const p = normalize(file);
        const top = p.split("/")[0];
        if (!SOURCE_FILE.test(p) || isBuildDir(top) || top === "node_modules") {
            continue;
        }
        const stem = p.replace(SOURCE_FILE, "");
        keys.add(stem);
        keys.add(stem.split("/").slice(1).join("/"));
    }
    return keys;
}

/**
 * The shipped build files that no source file produces. `packedFiles` are tarball-relative
 * paths, `keys` comes from sourceKeys, `allowed` lists paths that ship on purpose without a
 * source (each with a reason, see unsourced-allowlist.json). Pure.
 */
export function unsourcedBuildFiles(packedFiles, keys, allowed = []) {
    const out = [];
    for (const file of packedFiles) {
        const p = normalize(file);
        const segments = p.split("/");
        if (segments.length < 2 || !isBuildDir(segments[0]) || !BUILD_FILE.test(p)) {
            continue;
        }
        const rel = segments.slice(1).join("/").replace(BUILD_FILE, "");
        if (keys.has(rel) || allowed.includes(p)) {
            continue;
        }
        out.push(p);
    }
    return out;
}

/** every file of a package directory except node_modules, build output and dot folders */
export function listSourceFiles(dir) {
    const out = [];
    const walk = (rel) => {
        for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
            const child = rel ? `${rel}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                if (entry.name === "node_modules" || entry.name.startsWith(".") || (!rel && isBuildDir(entry.name))) {
                    continue;
                }
                walk(child);
            } else {
                out.push(child);
            }
        }
    };
    walk("");
    return out;
}

/** the reviewed exceptions: { "<package name>": ["dist/path.js", ...] } */
export function loadAllowlist(file = new URL("../unsourced-allowlist.json", import.meta.url)) {
    if (!fs.existsSync(file)) {
        return {};
    }
    const { packages = {} } = JSON.parse(fs.readFileSync(file, "utf8"));
    return Object.fromEntries(Object.entries(packages).map(([name, entries]) => [name, entries.map((e) => e.file)]));
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

export function analyze({
    repoRoot = ".",
    packageFilter,
    pack = packFileList,
    sources = listSourceFiles,
    allowlist = loadAllowlist()
} = {}) {
    const packages = publishablePackages(repoRoot, packageFilter);
    const findings = [];
    const unsourced = [];
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
        for (const file of unsourcedBuildFiles(files, sourceKeys(sources(dir)), allowlist[name] ?? [])) {
            unsourced.push({ name, file });
        }
    }
    return { scanned: packages.length, findings, unsourced, failures };
}

export function exitCode(result) {
    return result.findings.length > 0 || (result.unsourced?.length ?? 0) > 0 || result.failures.length > 0 ? 1 : 0;
}

export function formatReport(result) {
    const lines = [];
    const unsourced = result.unsourced ?? [];
    if (result.findings.length === 0 && unsourced.length === 0 && result.failures.length === 0) {
        lines.push(
            `check-pack: ${result.scanned} publishable packages, every declared entry point is in the tarball, every shipped build file has a source.`
        );
        return lines.join("\n");
    }
    if (unsourced.length) {
        lines.push(`check-pack: ${unsourced.length} shipped build files have no source file, across ${result.scanned} packages`, "");
        for (const u of unsourced) {
            lines.push(`  ${u.name}: ${u.file}`);
        }
        lines.push("");
        lines.push("A build file without a source is left over from an earlier build. Clean the dist");
        lines.push("folder and build again (pnpm run clean, then pnpm run build:all). A file that ships on");
        lines.push("purpose without a source goes in tools/check-pack/unsourced-allowlist.json, with a reason.");
        lines.push("");
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
