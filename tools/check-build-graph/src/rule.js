/**
 * rule - every publishable package is reachable in the TypeScript build graph.
 *
 * `pnpm run build` is `tsc -b packages`, which builds the projects packages/tsconfig.json
 * references and, transitively, the projects those reference. A package outside that closure is
 * never built by CI or by a release, and nothing said so: node-opcua-nodeset-i-4-aas was missing
 * from the aggregate list, nothing else referenced it, and it went to npm with `main` naming a
 * dist/ that the tarball did not contain (2.183.1 shipped LICENSE, package.json and source only).
 *
 * check-pack catches the consequence, one packaging step before publish. This catches the cause:
 * the package is simply never compiled. It is a file-reading check, so it runs inside lint rather
 * than as its own CI job.
 *
 * Private packages are exempt. They are not published, so an unbuilt one breaks nobody outside
 * the repo; `playground` is deliberately outside the graph.
 */

import fs from "node:fs";
import path from "node:path";

export const SOURCE_ROOTS = ["packages", "packages_extra"];

/**
 * Strip comments and trailing commas from JSONC, respecting string literals. A regex would do
 * neither safely: tsconfig globs such as "source/**\/*.ts" carry a /* inside a string, and 31 of
 * the generated nodeset tsconfigs end their arrays with a trailing comma.
 */
export function stripJsonc(text) {
    let out = "";
    let inString = false;
    let escaped = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inString) {
            out += c;
            if (escaped) {
                escaped = false;
            } else if (c === "\\") {
                escaped = true;
            } else if (c === '"') {
                inString = false;
            }
            continue;
        }
        if (c === '"') {
            inString = true;
            out += c;
            continue;
        }
        if (c === "/" && text[i + 1] === "/") {
            while (i < text.length && text[i] !== "\n") {
                i++;
            }
            out += "\n";
            continue;
        }
        if (c === "/" && text[i + 1] === "*") {
            i += 2;
            while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
                i++;
            }
            i++;
            continue;
        }
        out += c;
    }
    return out.replace(/,(\s*[}\]])/g, "$1");
}

/** parsed tsconfig, or null when it is absent or unreadable (a broken one is tsc's to report) */
export function readTsconfig(file) {
    if (!fs.existsSync(file)) {
        return null;
    }
    try {
        // the BOM is not decoration: packages/node-opcua-debug/tsconfig.json carries one
        return JSON.parse(stripJsonc(fs.readFileSync(file, "utf8").replace(/^﻿/, "")));
    } catch {
        return null;
    }
}

/** the reference targets of one tsconfig, as written */
export function referencePaths(tsconfig) {
    if (!tsconfig || !Array.isArray(tsconfig.references)) {
        return [];
    }
    return tsconfig.references.map((r) => r?.path).filter((p) => typeof p === "string");
}

/**
 * The package a reference points at, or null when it leaves the packages directory. A reference
 * may name the directory ("../node-opcua-variant") or the file ("../node-opcua-variant/tsconfig.json"),
 * and may carry a variant name ("tsconfig.pre.json").
 */
export function resolveReference(fromDir, refPath, packagesDir) {
    const target = path.resolve(fromDir, refPath.replace(/[/\\]tsconfig(\.\w+)?\.json$/, ""));
    const rel = path.relative(packagesDir, target).replace(/\\/g, "/");
    return rel === "" || rel.startsWith("..") || rel.includes("/") ? null : rel;
}

/** every package name reachable from packages/tsconfig.json through project references */
export function reachablePackages(repoRoot = ".") {
    const packagesDir = path.join(repoRoot, "packages");
    const seen = new Set();
    const queue = [];
    for (const ref of referencePaths(readTsconfig(path.join(packagesDir, "tsconfig.json")))) {
        const name = resolveReference(packagesDir, ref, packagesDir);
        if (name) {
            queue.push(name);
        }
    }
    while (queue.length) {
        const name = queue.pop();
        if (seen.has(name)) {
            continue;
        }
        seen.add(name);
        const dir = path.join(packagesDir, name);
        for (const ref of referencePaths(readTsconfig(path.join(dir, "tsconfig.json")))) {
            const next = resolveReference(dir, ref, packagesDir);
            if (next && !seen.has(next)) {
                queue.push(next);
            }
        }
    }
    return seen;
}

/** publishable packages that carry a tsconfig.json, so are meant to be compiled */
export function compiledPackages(repoRoot = ".") {
    const out = [];
    for (const root of SOURCE_ROOTS) {
        const base = path.join(repoRoot, root);
        if (!fs.existsSync(base)) {
            continue;
        }
        for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
            if (!entry.isDirectory()) {
                continue;
            }
            const dir = path.join(base, entry.name);
            const manifest = path.join(dir, "package.json");
            if (!fs.existsSync(manifest) || !fs.existsSync(path.join(dir, "tsconfig.json"))) {
                continue;
            }
            let pkg;
            try {
                pkg = JSON.parse(fs.readFileSync(manifest, "utf8").replace(/^﻿/, ""));
            } catch {
                continue;
            }
            if (pkg.private === true) {
                continue;
            }
            out.push({ name: pkg.name ?? entry.name, dir: entry.name, root });
        }
    }
    return out;
}

export function analyze({ repoRoot = "." } = {}) {
    const reachable = reachablePackages(repoRoot);
    const packages = compiledPackages(repoRoot);
    const findings = packages
        .filter((p) => p.root === "packages" && !reachable.has(p.dir))
        .map((p) => ({ name: p.name, dir: `packages/${p.dir}` }));
    return { scanned: packages.length, reachable: reachable.size, findings };
}

export function exitCode(result) {
    return result.findings.length > 0 ? 1 : 0;
}

export function formatReport(result) {
    if (result.findings.length === 0) {
        return `check-build-graph: ${result.scanned} publishable packages, all reachable from packages/tsconfig.json.`;
    }
    const lines = [
        `check-build-graph: ${result.findings.length} publishable package(s) are never built`,
        ""
    ];
    for (const f of result.findings) {
        lines.push(`  ${f.name}`, `      ${f.dir}   (no path to it from packages/tsconfig.json)`);
    }
    lines.push(
        "",
        "`tsc -b packages` builds the projects packages/tsconfig.json references and whatever",
        "those reference in turn. A package outside that closure is never compiled, so it ships",
        "whatever `files` lists and nothing else. Add a reference in packages/tsconfig.json, or",
        "have a package that depends on it reference it."
    );
    return lines.join("\n");
}
