#!/usr/bin/env node
/**
 * check-package-shape - command line around src/rule.js.
 *
 * Usage:
 *     node tools/check-package-shape.mjs
 *     node tools/check-package-shape.mjs --package node-opcua-client
 *     node tools/check-package-shape.mjs --concurrency 8
 *     node tools/check-package-shape.mjs --update      # rewrite the baseline
 *
 * Slower than the lint rules, because publint and attw each pack the package. It runs beside
 * check-pack in the per-package CI job rather than inside lint.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { evaluate, exitCode, formatReport, publishableTargets, readBaseline, writeBaseline } from "./rule.js";

function valueOf(argv, flag) {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
}

/**
 * The launcher npm installed for a dependency. .bin is the one location that is correct on both
 * platforms: on Windows it is the .CMD shim, elsewhere the executable symlink.
 */
function binary(repoRoot, name) {
    // absolute: each tool runs with cwd set to the package being checked, so a relative path
    // would resolve against that package and silently fail every check
    const file = path.resolve(repoRoot, "node_modules", ".bin", process.platform === "win32" ? `${name}.CMD` : name);
    if (!fs.existsSync(file)) {
        throw new Error(`${name} is not installed (looked for ${file}); run pnpm install at the repository root`);
    }
    return file;
}

const run = (cmd, args, cwd) =>
    new Promise((resolve) => {
        const child = spawn(cmd, args, { cwd, shell: true });
        let out = "";
        child.stdout.on("data", (d) => (out += d));
        child.stderr.on("data", (d) => (out += d));
        // both tools report through the exit code; strip the colouring so the report is readable
        child.on("close", (code) => resolve({ ok: code === 0, output: out.replace(/\[[0-9;]*m/g, "") }));
    });

async function collect(repoRoot, targets, concurrency) {
    const publint = binary(repoRoot, "publint");
    const attw = binary(repoRoot, "attw");
    const results = [];
    let next = 0;
    const worker = async () => {
        while (next < targets.length) {
            const t = targets[next++];
            results.push({
                name: t.name,
                // the esm-only profile is deliberate: see the note in rule.js
                publint: await run(publint, [], t.dir),
                attw: await run(attw, ["--pack", ".", "--profile", "esm-only"], t.dir)
            });
            if (process.stdout.isTTY) {
                process.stdout.write(`${results.length}/${targets.length}\r`);
            }
        }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    return results.sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
    const argv = process.argv.slice(2);
    const repoRoot = valueOf(argv, "--root") ?? ".";
    const only = valueOf(argv, "--package");
    const concurrency = Number(valueOf(argv, "--concurrency") ?? Math.min(8, Math.max(2, os.cpus().length >> 1)));

    const targets = publishableTargets(repoRoot).filter((t) => !only || t.name === only || path.basename(t.dir) === only);
    if (targets.length === 0) {
        console.error(only ? `check-package-shape: no publishable package named ${only}` : "check-package-shape: no publishable packages found");
        return 1;
    }

    const results = await collect(repoRoot, targets, concurrency);

    if (argv.includes("--update")) {
        const failing = results.filter((r) => !r.publint.ok || !r.attw.ok).map((r) => r.name);
        const file = writeBaseline(repoRoot, failing);
        console.log(`package-shape baseline updated: ${failing.length} failing package(s) -> ${file}`);
        return 0;
    }

    const result = evaluate(results, readBaseline(repoRoot));
    console.log(formatReport(result));
    return exitCode(result);
}

main().then((code) => process.exit(code));
