/**
 * Which directories of a package hold the TypeScript it ships.
 *
 * Shared, and derived from data, because the alternative has now failed twice. The gates began
 * with a hardcoded `["source", "src"]`, which missed `source_nodejs` in three packages - and
 * then node-opcua-address-space renamed its trees to `api/` and `impl/` and silently left every
 * gate's coverage, which none of them noticed because they all still reported "clean".
 *
 * A package's `files` array is the list of what it publishes, so it is the honest source for
 * this. Build output is excluded: `dist` is emitted, not authored - but excluding it is not
 * enough on its own. node-opcua-address-space ships `distHelpers`, and the tree that produces
 * it, `test_helpers`, appears nowhere in `files`; every gate therefore skipped it while
 * reporting a clean scan. So an emitted directory is resolved back through the package's
 * tsconfigs to the source it is compiled from.
 */
import fs from "node:fs";
import path from "node:path";

/** roots holding the workspace's packages */
export const SOURCE_ROOTS = ["packages", "packages_extra"];

/** never authored source, whatever a package lists */
const NOT_SOURCE = /^dist|^node_modules$|^nodesets$|^certificates$|^bin$/;

const holdsTypeScript = (dir) => {
    const stack = [dir];
    while (stack.length) {
        const d = stack.pop();
        let entries;
        try {
            entries = fs.readdirSync(d, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const e of entries) {
            if (e.isDirectory()) {
                if (e.name !== "node_modules") stack.push(path.join(d, e.name));
            } else if (/\.ts$/.test(e.name) && !e.name.endsWith(".d.ts")) {
                return true;
            }
        }
    }
    return false;
};

/**
 * outDir -> the source directories compiled into it, read from the package's tsconfigs.
 *
 * The `include` globs are used rather than `rootDir`, because a rootDir of "" or "." names the
 * package itself and would widen a scan to everything; `include: ["api/**", "impl/**"]` says
 * precisely which trees feed that output.
 */
function emittedFrom(packageDir) {
    const map = new Map();
    let names;
    try {
        names = fs.readdirSync(packageDir).filter((n) => /^tsconfig.*\.json$/.test(n));
    } catch {
        return map;
    }
    for (const name of names) {
        let config;
        try {
            config = JSON.parse(stripJsonComments(fs.readFileSync(path.join(packageDir, name), "utf8")));
        } catch {
            continue;
        }
        const outDir = config.compilerOptions?.outDir?.replace(/^\.\//, "").replace(/\/$/, "");
        if (!outDir) continue;
        const roots = (config.include ?? [])
            .map((g) => g.replace(/^\.\//, "").split("/")[0])
            .filter((r) => r && r !== "**" && !r.includes("*") && !r.includes("."));
        if (roots.length) map.set(outDir, [...new Set([...(map.get(outDir) ?? []), ...roots])]);
    }
    return map;
}

/** tsconfigs are JSONC; only line comments appear in this repo's */
const stripJsonComments = (text) => text.replace(/^\s*\/\/.*$/gm, "");

/**
 * The source directories one package ships, from its `files` array.
 *
 * `fallback` is used when a package declares no `files`, which npm reads as "publish
 * everything": the conventional layout is then the best available answer.
 */
export function shippedDirsOf(packageDir, fallback = ["source", "src"]) {
    const onlyExisting = () => fallback.filter((f) => fs.existsSync(path.join(packageDir, f)));

    // No manifest, or one we cannot read, means we do not know what ships. Scan the
    // conventional layout rather than nothing: guessing wide is recoverable, and a gate that
    // quietly scans less than it claims is the failure this whole module exists to prevent.
    const pjPath = path.join(packageDir, "package.json");
    if (!fs.existsSync(pjPath)) return onlyExisting();
    let pj;
    try {
        pj = JSON.parse(fs.readFileSync(pjPath, "utf8"));
    } catch {
        return onlyExisting();
    }
    const listed = pj.files ?? null;
    let candidates;
    if (listed) {
        const entries = listed.map((f) => f.replace(/^\.\//, "").replace(/\/$/, ""));
        const emitted = entries.filter((f) => NOT_SOURCE.test(f));
        const sources = emitted.length ? emittedFrom(packageDir) : new Map();
        candidates = [...new Set([...entries.filter((f) => !NOT_SOURCE.test(f)), ...emitted.flatMap((f) => sources.get(f) ?? [])])];
    } else {
        candidates = fallback;
    }

    const dirs = [];
    for (const c of candidates) {
        if (c.includes("*") || c.includes(".")) continue; // a glob or a single file, not a tree
        const full = path.join(packageDir, c);
        if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) continue;
        if (holdsTypeScript(full)) dirs.push(c);
    }
    // a package with `files` that names no source tree still has one to check
    return dirs.length ? dirs : fallback.filter((f) => fs.existsSync(path.join(packageDir, f)));
}

/** every source directory shipped across the workspace, as a sorted set of names */
export function allShippedDirNames(repoRoot = ".") {
    const names = new Set();
    for (const root of SOURCE_ROOTS) {
        const full = path.join(repoRoot, root);
        if (!fs.existsSync(full)) continue;
        for (const e of fs.readdirSync(full, { withFileTypes: true })) {
            if (!e.isDirectory()) continue;
            for (const d of shippedDirsOf(path.join(full, e.name))) names.add(d);
        }
    }
    return [...names].sort();
}
