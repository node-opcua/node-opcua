#!/usr/bin/env node
/**
 * `pnpm run test:per-package`: run every package's own `test` script, each with
 * its own .mocharc.
 *
 *     node tools/parallel-runner/src/per_package.js [-g] [--since <ref>] [args for each test script...]
 *
 * Without -g / --since it runs every package (`pnpm -r run test`). With them it
 * runs only the packages the parallel runner's git-aware mode would select
 * (same analyzeChanges: changed packages plus their dependents), and falls back
 * to every package in the same cases the runner does (repo-level config change,
 * no change detected). Every other argument (e.g. --dry-run) goes to the test scripts.
 */
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { analyzeChanges, hasChanges } = require("./git_aware");

const packagesDir = path.resolve(__dirname, "../../../packages");

const passThrough = [];
let gitAware = false;
let since = null;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-g" || a === "--gitAware") {
        gitAware = true;
    } else if (a === "--since") {
        since = args[++i];
        gitAware = true;
    } else if (a.startsWith("--since=")) {
        since = a.slice("--since=".length);
        gitAware = true;
    } else {
        passThrough.push(a);
    }
}

/** null = run every package */
function selectPackages() {
    if (!gitAware) return null;
    let changed;
    try {
        changed = hasChanges(packagesDir, since);
    } catch (err) {
        // a typo in --since must not quietly turn into "run everything"
        console.error(`✗ ${err.message}`);
        process.exit(2);
    }
    const analysis = changed ? analyzeChanges({ packagesDir, includeDependents: true, sinceCommit: since }) : null;
    if (since) {
        const base = analysis && analysis.base ? analysis.base.slice(0, 10) : "merge-base";
        console.log(`Git-aware: comparing against ${since} (${base}) + uncommitted changes`);
    }
    if (!analysis) {
        console.log("No git changes detected - running all packages");
        return null;
    }
    if (analysis.runAll) {
        console.log(`Git-aware: ${analysis.reason} - running all packages`);
        return null;
    }
    console.log(`Git-aware: filtering to ${analysis.affectedPackages.length} affected packages`);
    return analysis.affectedPackages;
}

const selected = selectPackages();
if (selected && selected.length === 0) {
    // no --filter at all would mean "every package": say so and stop instead
    console.log("No package affected - nothing to run");
    process.exit(0);
}

const pnpmArgs = selected
    ? [...selected.flatMap((name) => ["--filter", name]), "--if-present", "run", "test", ...passThrough]
    : ["-r", "run", "test", ...passThrough];

// Under `pnpm run`, npm_execpath is pnpm's own JS entry: run it with this node, no
// shell, so the --filter list never meets cmd.exe quoting or its line-length limit.
const execPath = process.env.npm_execpath;
const result =
    execPath && /\.c?js$/.test(execPath)
        ? spawnSync(process.execPath, [execPath, ...pnpmArgs], { stdio: "inherit" })
        : spawnSync("pnpm", pnpmArgs, { stdio: "inherit", shell: process.platform === "win32" });
if (result.error) {
    console.error(result.error.message);
    process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
