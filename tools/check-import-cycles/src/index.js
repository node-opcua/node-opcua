#!/usr/bin/env node
/**
 * check-import-cycles - command line around src/rule.js.
 *
 * Usage:
 *     node tools/check-import-cycles.mjs                    # report, exit 1 on a dangerous cycle
 *     node tools/check-import-cycles.mjs --all              # list the benign ones too
 *     node tools/check-import-cycles.mjs --package node-opcua-address-space
 *     node tools/check-import-cycles.mjs --root ../my-project
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
        packageFilter: valueOf(argv, "--package")
    });
    console.log(formatReport(result, { showBenign: argv.includes("--all") }));
    return exitCode(result);
}

process.exit(main());
