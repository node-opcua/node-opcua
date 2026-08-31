#!/usr/bin/env node
/**
 * check-module-identity - command line around src/rule.js.
 *
 * Usage:
 *     node tools/check-module-identity.mjs              # report, exit 1 on a violation
 *     node tools/check-module-identity.mjs --root ../x
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
