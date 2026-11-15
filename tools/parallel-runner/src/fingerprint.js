"use strict";
/**
 * fingerprint.js - what a cached "this test file passed" result depends on.
 *
 * A test file's outcome depends on much more than the test file itself: the
 * package's own sources (and its dist/ output, which the loader prefers), and
 * every workspace package it depends on, transitively. A cache keyed on the
 * test file alone kept skipping tests after the code under test had changed.
 *
 * fingerprint(testFile) = md5(
 *     test file path + mtime + size,
 *     package fingerprint of the test's package,   (own files + deps, transitive)
 *     global salt                                   (lockfile, root configs)
 * )
 *
 * Inside a git checkout a package's own fingerprint is built from git: the
 * blob hash of every tracked file (`git ls-files -s`) plus path + mtime + size
 * of every modified or untracked, non-ignored file (`git status`). Ignored
 * files (dist/, tmp/, generated certificates, ...) do not count, so tests that
 * write artifacts into their package do not invalidate their own cache entry.
 * dist/ is derived from the tracked sources, so a source change is still seen.
 * Outside git it falls back to stat()-ing the whole package tree.
 * Everything is computed once per process.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const SKIP_DIRS = new Set(["node_modules", ".git", "coverage", ".nyc_output", ".clinic", "tmp"]);
const GLOBAL_FILES = [
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "package-lock.json",
    "tsconfig.json",
    "tsconfig.common.json",
    ".mocharc.js",
    ".mocharc.json"
];

function statLine(file) {
    try {
        const st = fs.statSync(file);
        return `${file}\0${st.mtimeMs}\0${st.size}\n`;
    } catch (_err) {
        return `${file}\0missing\n`;
    }
}

/** hash path + mtime + size of every file under dir (skipping SKIP_DIRS) */
function hashTree(dir, hash) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_err) {
        return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
        if (SKIP_DIRS.has(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            hashTree(full, hash);
        } else if (e.isFile()) {
            hash.update(statLine(full));
        }
    }
}

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (_err) {
        return null;
    }
}

/** nearest directory at or above `file` that holds a package.json, stopping at `stop` */
function packageDirOf(file, stop) {
    let dir = path.dirname(file);
    for (;;) {
        if (fs.existsSync(path.join(dir, "package.json"))) return dir;
        const parent = path.dirname(dir);
        if (parent === dir || (stop && !parent.startsWith(stop))) return null;
        dir = parent;
    }
}

/** walk up from `start` to the first directory holding one of `names` */
function findUp(start, names) {
    let dir = start;
    for (;;) {
        if (names.some((n) => fs.existsSync(path.join(dir, n)))) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) return null;
        dir = parent;
    }
}

/**
 * @param {string} root the --root directory (monorepo packages/ or one package)
 * @returns {(testFile: string) => string}
 */
function createFingerprinter(root) {
    root = path.resolve(root);

    // workspace package index: name -> dir. Look at root's children, and - when
    // root is itself a package - at its siblings, so a single-package run still
    // follows its workspace dependencies.
    const nameToDir = new Map();
    const indexChildren = (dir) => {
        let entries = [];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (_err) {
            return;
        }
        for (const e of entries) {
            if (!e.isDirectory()) continue;
            const pj = readJson(path.join(dir, e.name, "package.json"));
            if (pj && pj.name && !nameToDir.has(pj.name)) {
                nameToDir.set(pj.name, path.join(dir, e.name));
            }
        }
    };
    indexChildren(root);
    const rootPj = readJson(path.join(root, "package.json"));
    if (rootPj && rootPj.name) {
        nameToDir.set(rootPj.name, root);
        indexChildren(path.dirname(root));
    }

    // global salt: lockfile + top-level configs of the repo and of root
    const repoRoot = findUp(root, ["pnpm-workspace.yaml", ".git"]) || root;
    const salt = crypto.createHash("md5");
    for (const dir of new Set([repoRoot, root])) {
        for (const name of GLOBAL_FILES) {
            salt.update(statLine(path.join(dir, name)));
        }
    }
    const globalSalt = salt.digest("hex");

    // git snapshot: relative path -> line, grouped later by package dir
    let gitTop = null;
    // single-package mode: also cover the sibling packages it depends on
    const scope = rootPj && rootPj.name ? path.dirname(root) : root;
    const gitLines = []; // [absPath, line]
    try {
        gitTop = execFileSync("git", ["rev-parse", "--show-toplevel"], {
            cwd: root,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"]
        }).trim();
        const opts = { cwd: gitTop, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 512 * 1024 * 1024 };
        const ls = execFileSync("git", ["ls-files", "-s", "-z", "--", scope], opts);
        for (const rec of ls.split("\0")) {
            if (!rec) continue;
            const tab = rec.indexOf("\t");
            gitLines.push([path.join(gitTop, rec.slice(tab + 1)), `${rec.slice(tab + 1)}\0${rec.slice(0, tab)}\n`]);
        }
        const st = execFileSync("git", ["status", "--porcelain", "-z", "--untracked-files=all", "--", scope], opts);
        const recs = st.split("\0");
        for (let i = 0; i < recs.length; i++) {
            const rec = recs[i];
            if (rec.length < 4) continue;
            const xy = rec.slice(0, 2);
            const abs = path.join(gitTop, rec.slice(3));
            gitLines.push([abs, `dirty\0${xy}\0${statLine(abs)}`]);
            if (xy[0] === "R" || xy[0] === "C") i++; // rename/copy: next record is the source path
        }
    } catch (_err) {
        gitTop = null;
    }
    /** package dir -> sorted lines, filled lazily from gitLines */
    let gitByPackage = null;
    const groupGitLines = () => {
        gitByPackage = new Map();
        const known = new Set(nameToDir.values());
        const pkgOfDir = new Map();
        const resolvePkg = (dir) => {
            if (pkgOfDir.has(dir)) return pkgOfDir.get(dir);
            let result = null;
            if (known.has(dir) || fs.existsSync(path.join(dir, "package.json"))) {
                result = dir;
            } else {
                const parent = path.dirname(dir);
                result = parent !== dir && parent.startsWith(scope) ? resolvePkg(parent) : null;
            }
            pkgOfDir.set(dir, result);
            return result;
        };
        for (const [abs, line] of gitLines) {
            const pkg = resolvePkg(path.dirname(abs));
            if (!pkg) continue;
            if (!gitByPackage.has(pkg)) gitByPackage.set(pkg, []);
            gitByPackage.get(pkg).push(line);
        }
        for (const lines of gitByPackage.values()) lines.sort();
    };

    const ownHash = new Map();
    const fullHash = new Map();

    const ownOf = (dir) => {
        if (!ownHash.has(dir)) {
            const h = crypto.createHash("md5");
            if (gitTop && dir.startsWith(scope)) {
                if (!gitByPackage) groupGitLines();
                h.update((gitByPackage.get(dir) || []).join(""));
            } else {
                // not in git, or a dependency outside root (single-package mode)
                hashTree(dir, h);
            }
            ownHash.set(dir, h.digest("hex"));
        }
        return ownHash.get(dir);
    };

    const depsOf = (dir) => {
        const pj = readJson(path.join(dir, "package.json")) || {};
        const names = Object.keys({ ...(pj.dependencies || {}), ...(pj.devDependencies || {}) });
        return names.map((n) => nameToDir.get(n)).filter((d) => d && d !== dir);
    };

    /** own files + all transitive workspace deps, cycle safe */
    const packageFingerprint = (dir) => {
        if (fullHash.has(dir)) return fullHash.get(dir);
        const seen = new Set();
        const stack = [dir];
        const parts = [];
        while (stack.length) {
            const d = stack.pop();
            if (seen.has(d)) continue;
            seen.add(d);
            parts.push(`${d}:${ownOf(d)}`);
            stack.push(...depsOf(d));
        }
        parts.sort();
        const value = crypto.createHash("md5").update(parts.join("\n")).digest("hex");
        fullHash.set(dir, value);
        return value;
    };

    return function fingerprint(testFile) {
        const pkgDir = packageDirOf(testFile);
        const h = crypto.createHash("md5");
        h.update(statLine(testFile));
        h.update(globalSalt);
        if (pkgDir) h.update(packageFingerprint(pkgDir));
        return h.digest("hex");
    };
}

module.exports = { createFingerprinter };
