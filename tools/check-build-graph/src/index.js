#!/usr/bin/env node
/**
 * check-build-graph - command line around src/rule.js.
 *
 * Usage:
 *     node tools/check-build-graph.mjs
 *     node tools/check-build-graph.mjs --root ../other-workspace
 */

import process from "node:process";
import { analyze, exitCode, formatReport } from "./rule.js";

function valueOf(argv, flag) {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
}

function main() {
    const argv = process.argv.slice(2);
    const result = analyze({ repoRoot: valueOf(argv, "--root") ?? "." });
    console.log(formatReport(result));
    return exitCode(result);
}

process.exit(main());
