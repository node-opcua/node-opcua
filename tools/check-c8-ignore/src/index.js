#!/usr/bin/env node
/**
 * check-c8-ignore - command line around src/rule.js.
 *
 * Usage:
 *     node tools/check-c8-ignore.mjs                     # report, exit 1 on a violation
 *     node tools/check-c8-ignore.mjs --fix               # rewrite the hints, then report what is left
 *     node tools/check-c8-ignore.mjs --package node-opcua-client
 *     node tools/check-c8-ignore.mjs --root ../other-workspace
 *     node tools/check-c8-ignore.mjs --scope source      # shipped source only
 *     node tools/check-c8-ignore.mjs --scope tests       # test trees only
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
