/**
 * Finding every package.json of a workspace, so that one command keeps a whole monorepo
 * on one release.
 *
 * Every tool declares workspace membership somewhere different. All the usual places are
 * read, in this order, and the first that exists wins: `pnpm-workspace.yaml`
 * (`packages:`), `package.json` (`workspaces` as a list or as `{ packages: [...] }`),
 * `lerna.json` (`packages`). A repository with none of them is a single package.
 */
import fs from "node:fs";
import path from "node:path";

/** the workspace patterns a root declares, or `[]` for a plain package */
export function workspacePatterns(rootDir: string): string[] {
    const pnpm = path.join(rootDir, "pnpm-workspace.yaml");
    if (fs.existsSync(pnpm)) {
        const patterns = pnpmPackagesList(fs.readFileSync(pnpm, "utf8"));
        if (patterns.length > 0) return patterns;
    }
    const manifest = path.join(rootDir, "package.json");
    if (fs.existsSync(manifest)) {
        const json = JSON.parse(fs.readFileSync(manifest, "utf8")) as { workspaces?: string[] | { packages?: string[] } };
        const ws = json.workspaces;
        if (Array.isArray(ws) && ws.length > 0) return ws;
        if (ws && !Array.isArray(ws) && Array.isArray(ws.packages) && ws.packages.length > 0) return ws.packages;
    }
    const lerna = path.join(rootDir, "lerna.json");
    if (fs.existsSync(lerna)) {
        const json = JSON.parse(fs.readFileSync(lerna, "utf8")) as { packages?: string[] };
        if (Array.isArray(json.packages) && json.packages.length > 0) return json.packages;
    }
    return [];
}

/**
 * the `packages:` list of a pnpm-workspace.yaml
 *
 * A deliberately small reader: a list of scalars under the `packages` key, quoted or not,
 * comments allowed, which is the whole of what pnpm documents for that key.
 */
export function pnpmPackagesList(yaml: string): string[] {
    const lines = yaml.split(/\r?\n/);
    const patterns: string[] = [];
    let inPackages = false;
    for (const raw of lines) {
        const line = raw.replace(/#.*$/, "").trimEnd();
        if (line.trim() === "") continue;
        if (/^packages\s*:/.test(line)) {
            inPackages = true;
            continue;
        }
        if (!inPackages) continue;
        const item = /^\s+-\s*['"]?([^'"]+?)['"]?\s*$/.exec(line);
        if (item) {
            patterns.push(item[1]);
            continue;
        }
        if (!/^\s/.test(line)) inPackages = false; // a new top-level key ends the list
    }
    return patterns;
}

/**
 * every package.json of the workspace: the root's first, then each package's, sorted by
 * path. A pattern is a path glob as the package managers accept it (`packages/*`,
 * `./packages/binding-*`, `apps/**`, `tools/cli`); one starting with `!` excludes what it
 * matches.
 */
export function discoverWorkspaceManifests(rootDir: string): string[] {
    const root = path.resolve(rootDir);
    const patterns = workspacePatterns(root);
    const included = new Set<string>();
    const excluded: string[] = [];
    for (const pattern of patterns) {
        if (pattern.startsWith("!")) {
            excluded.push(pattern.slice(1));
            continue;
        }
        for (const dir of expandPattern(root, pattern)) included.add(dir);
    }
    const manifests = [...included]
        .filter((dir) => !excluded.some((ex) => matchesExclusion(root, dir, ex)))
        .map((dir) => path.join(dir, "package.json"))
        .filter((file) => fs.existsSync(file))
        .sort();
    const rootManifest = path.join(root, "package.json");
    return fs.existsSync(rootManifest) ? [rootManifest, ...manifests.filter((m) => m !== rootManifest)] : manifests;
}

/**
 * the directories a workspace glob designates, walking only the segments the pattern
 * names: `packages/binding-*` reads one folder, `apps/**` the whole subtree under apps
 */
function expandPattern(root: string, pattern: string): string[] {
    const segments = normalizePattern(pattern)
        .split("/")
        .filter((s) => s !== "" && s !== ".");
    let dirs = [root];
    for (const segment of segments) {
        const next = new Set<string>();
        if (segment === "**") {
            for (const dir of dirs) for (const sub of descendants(dir)) next.add(sub);
        } else if (/[*?]/.test(segment)) {
            const re = globToRegExp(segment);
            for (const dir of dirs) for (const sub of subdirectories(dir)) if (re.test(path.basename(sub))) next.add(sub);
        } else {
            for (const dir of dirs) {
                const candidate = path.join(dir, segment);
                if (isDirectory(candidate)) next.add(candidate);
            }
        }
        dirs = [...next];
    }
    return dirs;
}

/** forward slashes, no `./` prefix, no trailing slash: the shape the package managers normalise to */
function normalizePattern(pattern: string): string {
    return pattern.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

/**
 * a glob over `/`-separated paths as a regular expression: `**` spans directories (`** /`
 * and a trailing `/**` match zero of them too), `*` and `?` stay within one segment
 */
export function globToRegExp(glob: string): RegExp {
    let re = "";
    for (let i = 0; i < glob.length; i++) {
        const c = glob[i];
        if (c === "/" && glob.slice(i + 1) === "**") {
            re += "(?:/.*)?";
            break;
        }
        if (c === "*" && glob[i + 1] === "*") {
            if (glob[i + 2] === "/") {
                re += "(?:.*/)?";
                i += 2;
            } else {
                re += ".*";
                i += 1;
            }
        } else if (c === "*") re += "[^/]*";
        else if (c === "?") re += "[^/]";
        else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
    return new RegExp(`^${re}$`);
}

/** the directories directly under `dir`, node_modules and dot folders left out */
function subdirectories(dir: string): string[] {
    if (!isDirectory(dir)) return [];
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name !== "node_modules" && !e.name.startsWith("."))
        .map((e) => path.join(dir, e.name));
}

/** `dir` itself and every directory below it, node_modules and dot folders left out */
function descendants(dir: string): string[] {
    const found: string[] = [];
    const visit = (d: string) => {
        found.push(d);
        for (const sub of subdirectories(d)) visit(sub);
    };
    if (isDirectory(dir)) visit(dir);
    return found;
}

function isDirectory(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** an exclusion glob matching the directory, or one of its ancestors, excludes it */
function matchesExclusion(root: string, dir: string, exclusion: string): boolean {
    const relative = path.relative(root, dir).replace(/\\/g, "/");
    const re = globToRegExp(normalizePattern(exclusion));
    const parts = relative.split("/");
    for (let i = 1; i <= parts.length; i++) {
        if (re.test(parts.slice(0, i).join("/"))) return true;
    }
    return false;
}

/** folders that never hold a package of the repository itself */
const NOT_A_PACKAGE_FOLDER = new Set(["node_modules", "dist", "build", "out", "coverage", "tmp", ".git", ".cache", ".pnpm-store"]);

/**
 * every package.json under `rootDir`, whatever the workspace declares: root first, then
 * sorted by path. This reaches the packages a workspace excludes on purpose (a snap, a
 * documentation site, a standalone publishable copy) and that still pin node-opcua.
 */
export function discoverAllManifests(rootDir: string): string[] {
    const root = path.resolve(rootDir);
    const found: string[] = [];
    const visit = (dir: string) => {
        const manifest = path.join(dir, "package.json");
        if (dir !== root && fs.existsSync(manifest)) found.push(manifest);
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isDirectory() || NOT_A_PACKAGE_FOLDER.has(entry.name) || entry.name.startsWith(".")) continue;
            visit(path.join(dir, entry.name));
        }
    };
    visit(root);
    found.sort();
    const rootManifest = path.join(root, "package.json");
    return fs.existsSync(rootManifest) ? [rootManifest, ...found] : found;
}

export const LOCKFILES: Record<string, string> = {
    "pnpm-lock.yaml": "pnpm install",
    "yarn.lock": "yarn install",
    "package-lock.json": "npm install",
    "bun.lockb": "bun install",
    "bun.lock": "bun install"
};

/**
 * where `npm install` must run for a manifest to take effect: the nearest folder, from
 * the manifest's own up to `rootDir`, that owns a lockfile; `rootDir` when none does
 */
export function installRootFor(manifestPath: string, rootDir: string): { dir: string; command: string } {
    const root = path.resolve(rootDir);
    let dir = path.dirname(path.resolve(manifestPath));
    for (;;) {
        for (const [lockfile, command] of Object.entries(LOCKFILES)) {
            if (fs.existsSync(path.join(dir, lockfile))) return { dir, command };
        }
        if (dir === root || path.dirname(dir) === dir) break;
        dir = path.dirname(dir);
    }
    return { dir: root, command: packageManagerCommand(root) };
}

/**
 * with no lockfile to go by, the `packageManager` field of the root manifest (the corepack
 * convention, e.g. `"pnpm@11.25.0"`) decides; npm otherwise
 */
export function packageManagerCommand(rootDir: string): string {
    const manifest = path.join(rootDir, "package.json");
    if (fs.existsSync(manifest)) {
        const json = JSON.parse(fs.readFileSync(manifest, "utf8")) as { packageManager?: string };
        const name = /^(pnpm|yarn|npm|bun)@/.exec(json.packageManager ?? "")?.[1];
        if (name) return `${name} install`;
    }
    return "npm install";
}

/** the distinct install roots of these manifests, outermost first, each with its command */
export function installRoots(manifestPaths: string[], rootDir: string): { dir: string; command: string }[] {
    const seen = new Map<string, string>();
    for (const m of manifestPaths) {
        const { dir, command } = installRootFor(m, rootDir);
        seen.set(dir, command);
    }
    return [...seen.entries()].sort((a, b) => a[0].length - b[0].length).map(([dir, command]) => ({ dir, command }));
}
