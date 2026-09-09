#!/usr/bin/env node
/**
 * check-dirname - command line around src/rule.js.
 *
 * Usage:
 *     node tools/check-dirname.mjs
 *     node tools/check-dirname.mjs --package node-opcua-nodesets
 *     node tools/check-dirname.mjs --root ../other-workspace
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
