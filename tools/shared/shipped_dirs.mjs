/**
 * Which directories of a package hold the TypeScript it ships.
 *
 * Shared, and derived from data, because the alternative has now failed twice. The gates began
 * with a hardcoded `["source", "src"]`, which missed `source_nodejs` in three packages - and
 * then node-opcua-address-space renamed its trees to `api/` and `impl/` and silently left every
 * gate's coverage, which none of them noticed because they all still reported "clean".
 *
 * A package's `files` array is the list of what it publishes, so it is the honest source for
 * this. Build output is excluded: `dist` is emitted, not authored.
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
    const candidates = listed
        ? listed.map((f) => f.replace(/^\.\//, "").replace(/\/$/, "")).filter((f) => !NOT_SOURCE.test(f))
        : fallback;

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
