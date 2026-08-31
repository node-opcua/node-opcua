#!/usr/bin/env node
/**
 * check-short-circuit-assertion - command line around src/rule.js.
 *
 * Usage:
 *     node tools/check-short-circuit-assertion.mjs                          # report, exit 1
 *     node tools/check-short-circuit-assertion.mjs --fix                    # rewrite, then report
 *     node tools/check-short-circuit-assertion.mjs --package node-opcua-server
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
