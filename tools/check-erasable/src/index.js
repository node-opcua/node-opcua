#!/usr/bin/env node
/**
 * check-erasable - command line around src/rule.js.
 *
 * Usage:
 *     node tools/check-erasable.mjs                          # report, exit 1 on a violation
 *     node tools/check-erasable.mjs --package node-opcua-server
 *     node tools/check-erasable.mjs --root ../other-workspace
 *
 * There is no --fix. Every remedy is a judgement call about the shape of the replacement -
 * an enum becomes a const object plus a type alias whose members someone has to name - and
 * a gate that guessed would produce worse code than the one it replaced.
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
