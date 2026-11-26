#!/usr/bin/env node
/**
 * check-experimental - command line around src/rule.js.
 *
 * Usage:
 *     node tools/check-experimental.mjs
 *     node tools/check-experimental.mjs --list
 *     node tools/check-experimental.mjs --fix
 *     node tools/check-experimental.mjs --package node-opcua-server
 *     node tools/check-experimental.mjs --root ../other-workspace
 *
 * `--list` prints the features and exits 0, so a human can ask the question without reading a
 * table. Without it, the command fails when the tags, EXPERIMENTAL.md and the start-up warnings
 * disagree.
 *
 * `--fix` adds a row to the table for a tagged symbol that the table does not name. It never
 * deletes a row and it never edits source, so it leaves the other two kinds of disagreement to a
 * human and still fails for them.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { analyze, applyFix, exitCode, formatReport } from "./rule.js";

function valueOf(argv, flag) {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
}

function main() {
    const argv = process.argv.slice(2);
    const repoRoot = valueOf(argv, "--root") ?? ".";
    let result = analyze({ repoRoot, packageFilter: valueOf(argv, "--package") });

    if (argv.includes("--list")) {
        for (const t of result.tagged) {
            console.log(`${t.symbol}\t${t.file}:${t.line}`);
        }
        return 0;
    }

    if (argv.includes("--fix") && result.tableExists && result.missing.length > 0) {
        const file = path.join(repoRoot, result.tableFile);
        const fix = applyFix(fs.readFileSync(file, "utf8"), result.missing);
        if (fix.error) {
            console.log(`ERROR cannot fix ${result.tableFile}: ${fix.error}`);
            return 1;
        }
        fs.writeFileSync(file, fix.markdown);
        for (const s of fix.added) {
            console.log(`added a row for ${s} to ${result.tableFile}: write its prose`);
        }
        result = analyze({ repoRoot, packageFilter: valueOf(argv, "--package") });
    }

    console.log(formatReport(result));
    return exitCode(result);
}

process.exit(main());
