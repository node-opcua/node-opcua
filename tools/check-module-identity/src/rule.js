/**
 * rule - a file must reach any one package by a single route.
 *
 * A package can be reached several ways, and they are not the same module instance:
 *
 *     "node-opcua-foo"                 -> its package.json main, i.e. dist/index.js
 *     "node-opcua-foo/dist/x.js"       -> the SAME dist tree, same instances
 *     "node-opcua-foo/source/x.js"     -> a SECOND compilation of the same code
 *     ".." from inside the package     -> its own dist
 *     "../source/x.js" from inside it  -> a second compilation
 *
 * Where two routes to one package meet in a running process there are two copies of every
 * class and every module-scope registry. `instanceof` across the boundary is false, and a
 * resource registered through one copy and disposed through the other is reported as a
 * leak. Neither `tsc` nor a single-package test run detects it: the types are structurally
 * identical and one process loading the package twice still passes in isolation. It shows
 * up as an unrelated-looking failure somewhere else, which is why it needs a gate.
 *
 * Only VALUE imports count. `import type` is erased before anything runs and cannot
 * duplicate a module.
 *
 * Deep imports into dist/ are fine - same tree, same instances - and so are the sibling
 * entry points distNodeJS/ and distHelpers/, which re-export dist rather than recompiling
 * (distNodeJS/generate_address_space.js does `require("..")`).
 */

import fs from "node:fs";
import path from "node:path";

/** opt out on one line, with a reason: `// check-module-identity: ok - why` */
export const IGNORE_MARKER = "check-module-identity: ok";

export const SOURCE_ROOTS = ["packages", "packages_extra"];

const SKIP_DIRS = new Set(["node_modules", "dist", "dist-esm", "distNodeJS", "distHelpers", "coverage", "build"]);

/** a compiled output tree: reaching into one of these is the same instance as the entry */
const BUILT_DIR = /^dist/;

/** a TypeScript source tree: reaching into one of these compiles the code a second time */
const SOURCE_DIR = /^(source|src|source_nodejs)$/;

/**
 * The value-import specifiers of one file.
 *
 * `import type ...` and `import { type A, type B } ...` are both fully erased, so neither
 * can bring a second copy of anything into the process.
 */
export function valueSpecifiers(text) {
    const clean = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const out = [];
    for (const m of clean.matchAll(/^[^\S\n]*import\s+(type\s+)?([\s\S]*?)\bfrom\s+["']([^"']+)["']/gm)) {
        if (m[1]) continue;
        const names = (m[2] ?? "")
            .replace(/[{}]/g, "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        if (names.length > 0 && names.every((n) => n.startsWith("type "))) continue;
        out.push(m[3]);
    }
    for (const m of clean.matchAll(/^[^\S\n]*import\s+["']([^"']+)["']/gm)) out.push(m[1]);
    return out;
}

/**
 * Which package a specifier reaches, and by which route.
 * Returns { pkg, route } with route "built" or "source", or null when it reaches no
 * package in a way that could duplicate one.
 */
export function classify(specifier, fileRelativeToPackage, packageName) {
    // another package, by name: "node-opcua-foo", "node-opcua-foo/dist/x.js", ...
    const byName = /^(@[\w.-]+\/[\w.-]+|[\w.-]+)(?:\/(.*))?$/.exec(specifier);
    if (byName && !specifier.startsWith(".")) {
        const [, pkg, rest] = byName;
        if (!rest) return { pkg, route: "built" };
        const head = rest.split("/")[0];
        if (SOURCE_DIR.test(head)) return { pkg, route: "source" };
        if (BUILT_DIR.test(head)) return { pkg, route: "built" };
        // any other subpath is an export map entry, which resolves into the built tree
        return { pkg, route: "built" };
    }

    // a relative specifier inside the package: how far up does it go?
    const depth = fileRelativeToPackage.split("/").length - 1;
    const up = "../".repeat(depth);
    if (!specifier.startsWith("..")) return null;
    const root = up.replace(/\/$/, "");
    if (specifier === root) return { pkg: packageName, route: "built" };
    if (!specifier.startsWith(up)) return null; // does not reach the package root
    const rest = specifier.slice(up.length);
    const head = rest.split("/")[0];
    if (SOURCE_DIR.test(head)) return { pkg: packageName, route: "source" };
    if (BUILT_DIR.test(head)) return { pkg: packageName, route: "built" };
    return null;
}

/** findings for one file: [{ pkg, built: [...], source: [...] }] */
export function findViolations(text, fileRelativeToPackage, packageName) {
    const lines = text.split("\n");
    const byPackage = new Map();
    for (const spec of valueSpecifiers(text)) {
        const c = classify(spec, fileRelativeToPackage, packageName);
        if (!c) continue;
        const line = lines.findIndex((l) => l.includes(`"${spec}"`) || l.includes(`'${spec}'`));
        if (line >= 0 && lines[line].includes(IGNORE_MARKER)) continue;
        if (!byPackage.has(c.pkg)) byPackage.set(c.pkg, { pkg: c.pkg, built: [], source: [] });
        byPackage.get(c.pkg)[c.route].push(spec);
    }
    return [...byPackage.values()].filter((v) => v.built.length > 0 && v.source.length > 0);
}

export function findFiles(repoRoot = ".") {
    const out = [];
    const walk = (dir, pkgDir, pkgName) => {
        if (!fs.existsSync(dir)) return;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name).replace(/\\/g, "/");
            if (e.isDirectory()) {
                if (!SKIP_DIRS.has(e.name)) walk(full, pkgDir, pkgName);
            } else if (/\.(ts|mts|cts)$/.test(e.name) && !e.name.endsWith(".d.ts")) {
                out.push({ file: full, relative: path.posix.relative(pkgDir, full), packageName: pkgName });
            }
        }
    };
    for (const root of SOURCE_ROOTS) {
        const full = path.join(repoRoot, root);
        if (!fs.existsSync(full)) continue;
        for (const pkg of fs.readdirSync(full, { withFileTypes: true })) {
            if (!pkg.isDirectory() || SKIP_DIRS.has(pkg.name)) continue;
            const pkgDir = path.join(full, pkg.name).replace(/\\/g, "/");
            walk(pkgDir, pkgDir, pkg.name);
        }
    }
    return out;
}

export function analyze({ repoRoot = "." } = {}) {
    const files = findFiles(repoRoot);
    const findings = [];
    for (const { file, relative, packageName } of files) {
        for (const v of findViolations(fs.readFileSync(file, "utf8"), relative, packageName)) {
            findings.push({ file, ...v });
        }
    }
    return { scanned: files.length, findings };
}

export function exitCode(result) {
    return result.findings.length > 0 ? 1 : 0;
}

export function formatReport(result) {
    if (result.findings.length === 0) {
        return `check-module-identity: ${result.scanned} files scanned, every package is reached by a single route.`;
    }
    const lines = [`check-module-identity: ${result.findings.length} file(s) reach a package by two routes, in ${result.scanned} scanned`, ""];
    for (const f of result.findings) {
        lines.push(`  ${f.file}  reaches ${f.pkg} twice:`);
        for (const s of f.built) lines.push(`      built  "${s}"`);
        for (const s of f.source) lines.push(`      source "${s}"`);
    }
    lines.push("");
    lines.push("Those are two module instances: two copies of every class, two module-scope");
    lines.push("registries. instanceof across the boundary is false, and a resource registered");
    lines.push("through one copy and disposed through the other is reported as a leak.");
    lines.push("");
    lines.push("Point the source import at its dist equivalent, or import the package by name.");
    return lines.join("\n");
}
