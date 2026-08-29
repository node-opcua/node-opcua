#!/usr/bin/env node
/**
 * check-debug-name - command line around src/rule.js.
 *
 * Usage:
 *     node tools/check-debug-name.mjs                        # report, exit 1 on a violation
 *     node tools/check-debug-name.mjs --fix                  # rewrite, then report what is left
 *     node tools/check-debug-name.mjs --package node-opcua-client
 *     node tools/check-debug-name.mjs --root ../my-project   # any project using these helpers
 */

import process from "node:process";
import { analyze, exitCode, formatReport } from "./rule.js";

function valueOf(argv, flag) {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
}

function main() {
    const argv = process.argv.slice(2);
    const result = analyze({
        repoRoot: valueOf(argv, "--root") ?? ".",
        packageFilter: valueOf(argv, "--package"),
        write: argv.includes("--fix")
    });
    console.log(formatReport(result));
    return exitCode(result);
}

process.exit(main());
