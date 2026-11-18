#!/usr/bin/env node
/**
 * check-child-process - command line around src/rule.js.
 *
 * Usage:
 *     node tools/check-child-process.mjs
 *     node tools/check-child-process.mjs --package node-opcua-versions
 *     node tools/check-child-process.mjs --root ../other-workspace
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
    console.log(formatReport(result));
    return exitCode(result);
}

process.exit(main());
