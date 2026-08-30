#!/usr/bin/env node
/**
 * check-pack - command line around src/rule.js.
 *
 * Usage:
 *     node tools/check-pack.mjs                       # report, exit 1 on a violation
 *     node tools/check-pack.mjs --package node-opcua
 *     node tools/check-pack.mjs --root ../my-project
 *
 * Slower than the other checks, because it asks npm what it would ship for every
 * publishable package. It runs as its own CI job rather than inside lint.
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
