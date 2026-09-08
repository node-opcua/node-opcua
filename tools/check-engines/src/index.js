#!/usr/bin/env node
/**
 * check-engines - command line around src/rule.js.
 *
 * Usage:
 *     node tools/check-engines.mjs
 *     node tools/check-engines.mjs --fix          # write the root's floor into every package
 *     node tools/check-engines.mjs --root ../other-workspace
 */

import process from "node:process";
import { analyze, exitCode, formatReport } from "./rule.js";
import { applyFloor } from "./fix.js";

function valueOf(argv, flag) {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
}

function main() {
    const argv = process.argv.slice(2);
    const repoRoot = valueOf(argv, "--root") ?? ".";

    if (argv.includes("--fix")) {
        const { changed } = applyFloor({ repoRoot });
        console.log(`check-engines: wrote engines.node into ${changed} package(s)`);
        console.log("");
    }

    const result = analyze({ repoRoot });
    console.log(formatReport(result));
    return exitCode(result);
}

process.exit(main());
