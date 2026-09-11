#!/usr/bin/env node
// Curates the published API doc versions under <site>/api_doc so the
// GitHub Pages artifact stays under the platform's 1GB deploy limit.
//
// Usage:
//   node tools/curate-api-docs.mjs <path-to-api_doc-dir> [options]
//
// Options:
//   --dry-run           Report what would be removed without touching disk
//   --budget-mb <n>     Size budget in MB for the safety-net pass (default 700)
//   --min-gap-days <n>  Minimum days between two kept releases (default 14)
//
// Each api_doc/<version> folder corresponds to the `v<version>` tag in
// node-opcua/node-opcua, so release dates are looked up from that tag via
// the GitHub API (`gh api`) rather than from gh-pages commit history —
// history there gets rewritten by the deprecation-banner step, and a full
// clone of that repo is large. Requires `gh` to be authenticated.
//
// This is the logic run by .github/workflows/docs.yml after each doc
// deploy; run it locally against a shallow clone to preview a curation pass
// (a shallow clone is enough since dates come from the GitHub API, not
// local git history):
//
//   git clone --depth 1 git@github.com:node-opcua/node-opcua.github.io.git /tmp/ghp
//   node tools/curate-api-docs.mjs /tmp/ghp/api_doc --dry-run

import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const dateCache = new Map();
function releaseDate(version, releaseRepo) {
    if (dateCache.has(version)) return dateCache.get(version);
    let date = null;
    try {
        const out = execFileSync("gh", ["api", `repos/${releaseRepo}/commits/v${version}`, "--jq", ".commit.committer.date"], {
            stdio: ["ignore", "pipe", "ignore"]
        })
            .toString()
            .trim();
        date = out ? new Date(out) : null;
    } catch {
        date = null;
    }
    dateCache.set(version, date);
    return date;
}

function parseArgs(argv) {
    const args = { apiDir: null, dryRun: false, budgetMb: 700, minGapDays: 5 };
    const rest = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--dry-run") args.dryRun = true;
        else if (a === "--budget-mb") args.budgetMb = Number(argv[++i]);
        else if (a === "--min-gap-days") args.minGapDays = Number(argv[++i]);
        else rest.push(a);
    }
    args.apiDir = rest[0];
    return args;
}

function dirSize(dir) {
    let total = 0;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name);
        total += e.isDirectory() ? dirSize(f) : statSync(f).size;
    }
    return total;
}

function mb(bytes) {
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

export function curate(apiDir, { dryRun = false, budgetMb = 700, minGapDays = 5, releaseRepo = "node-opcua/node-opcua" } = {}) {
    const budgetBytes = budgetMb * 1024 * 1024;
    const minGapMs = minGapDays * 24 * 60 * 60 * 1000;

    if (!existsSync(apiDir)) {
        console.log(`No api_doc dir found at ${apiDir}`);
        return { kept: [], removed: [] };
    }

    const remove = (v, reason) => {
        console.log(`  - ${v}  (${reason})`);
        if (!dryRun) rmSync(path.join(apiDir, v), { recursive: true, force: true });
    };

    let dirs = readdirSync(apiDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name !== "latest" && /^\d+\.\d+\.\d+/.test(e.name))
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    console.log(`Found ${dirs.length} version(s) under ${apiDir}${dryRun ? " (dry run)" : ""}`);

    // Step 0: drop pre-1.0 versions — they predate the project's first
    // proper (npm-published) release and aren't worth preserving.
    console.log("\nStep 0: drop pre-1.0 versions");
    const removedPre1 = [];
    dirs = dirs.filter((v) => {
        const major = Number(v.split(".")[0]);
        if (major === 0) {
            remove(v, "pre-1.0");
            removedPre1.push(v);
            return false;
        }
        return true;
    });

    // Step 1: keep only the newest patch per major.minor line.
    const newestPatchPerLine = new Map();
    for (const v of dirs) {
        const [major, minor, patch] = v.split(".").map(Number);
        const line = `${major}.${minor}`;
        const current = newestPatchPerLine.get(line);
        if (!current || patch > current.patch) newestPatchPerLine.set(line, { v, patch });
    }
    const keepAfterPatch = new Set([...newestPatchPerLine.values()].map((x) => x.v));

    console.log("\nStep 1: drop superseded patch releases (same major.minor line)");
    const removedPatch = [];
    for (const v of dirs) {
        if (!keepAfterPatch.has(v)) {
            remove(v, "superseded patch");
            removedPatch.push(v);
        }
    }
    dirs = dirs.filter((v) => keepAfterPatch.has(v));

    // Step 2: drop a release if it was published less than minGapDays before
    // the next kept one.
    console.log(`\nStep 2: drop releases published < ${minGapDays} day(s) before a newer one`);
    const dated = dirs.map((v) => ({ v, date: releaseDate(v, releaseRepo) }));
    const survivors = [];
    const removedRecency = [];
    for (const item of dated) {
        while (
            survivors.length &&
            item.date &&
            survivors[survivors.length - 1].date &&
            item.date - survivors[survivors.length - 1].date < minGapMs
        ) {
            const old = survivors.pop();
            remove(old.v, `< ${minGapDays}d before ${item.v}`);
            removedRecency.push(old.v);
        }
        survivors.push(item);
    }
    dirs = survivors.map((x) => x.v);

    // Step 3 (safety net): if still over budget, drop the oldest lines.
    console.log(`\nStep 3: safety-net size budget (${budgetMb} MB)`);
    const sizes = dirs.map((v) => ({ v, size: dirSize(path.join(apiDir, v)) }));
    const latestDir = path.join(apiDir, "latest");
    let total = sizes.reduce((s, x) => s + x.size, 0) + (existsSync(latestDir) ? dirSize(latestDir) : 0);
    console.log(`  size after steps 1-2: ${mb(total)}`);
    const removedBudget = [];
    while (total > budgetBytes && sizes.length > 1) {
        const oldest = sizes.shift();
        remove(oldest.v, "over size budget");
        total -= oldest.size;
        removedBudget.push(oldest.v);
    }
    dirs = sizes.map((x) => x.v);

    console.log(`\nFinal kept set (${dirs.length}): ${dirs.join(", ") || "(none)"}`);
    console.log(`Final size: ${mb(total)}`);

    return { kept: dirs, removed: [...removedPre1, ...removedPatch, ...removedRecency, ...removedBudget] };
}

const args = parseArgs(process.argv.slice(2));
if (!args.apiDir) {
    console.error("Usage: node tools/curate-api-docs.mjs <path-to-api_doc-dir> [--dry-run] [--budget-mb n] [--min-gap-days n]");
    process.exit(1);
}
curate(path.resolve(args.apiDir), args);
