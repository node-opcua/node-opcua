#!/usr/bin/env node
/**
 * check-cjs-globals - command line around src/rule.js.
 *
 * Usage:
 *     node tools/check-cjs-globals.mjs                       # report, exit 1 on a violation
 *     node tools/check-cjs-globals.mjs --fix                 # rewrite the one safe idiom, then report what is left
 *     node tools/check-cjs-globals.mjs --package node-opcua-client
 *     node tools/check-cjs-globals.mjs --root ../other-workspace
 *     node tools/check-cjs-globals.mjs --scope source        # shipped source only
 *     node tools/check-cjs-globals.mjs --scope tests         # test trees only
 */

import process from "node:process";
import { analyze, exitCode, formatReport, SCOPES } from "./rule.js";

function valueOf(argv, flag) {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
}

function main() {
    const argv = process.argv.slice(2);
    const scope = valueOf(argv, "--scope") ?? "all";
    if (!Object.hasOwn(SCOPES, scope)) {
        console.error(`unknown --scope "${scope}"; expected one of ${Object.keys(SCOPES).join(", ")}`);
        return 2;
    }
    const result = analyze({
        repoRoot: valueOf(argv, "--root") ?? ".",
        packageFilter: valueOf(argv, "--package"),
        write: argv.includes("--fix"),
        scope
    });
    console.log(formatReport(result));
    return exitCode(result);
}

process.exit(main());
