#!/usr/bin/env node
/**
 * check-test-ports - command line around src/scanner.js.
 *
 * The scanner is kept separate and pure so the unit tests can point it at a fixture tree
 * and assert on findings, rather than shelling out and matching printed text.
 *
 * Usage:
 *     node tools/check-test-ports.mjs              # report, exit 1 on a collision
 *     node tools/check-test-ports.mjs --suggest    # the next free, non-stealable port
 *     node tools/check-test-ports.mjs --suggest 5  # the next five
 *     node tools/check-test-ports.mjs --list       # every port, with the files using it
 *     node tools/check-test-ports.mjs --ai         # a prompt telling an agent exactly what to fix
 *     node tools/check-test-ports.mjs --summary    # counts only; non-zero on failure OR doubt
 */

import process from "node:process";
import { analyze, suggest, exitCode, strictExitCode, formatReport, formatSummary, formatAiPrompt, formatConsolidation } from "./scanner.js";

function main() {
    const argv = process.argv.slice(2);
    const result = analyze();

    if (argv.includes("--suggest")) {
        const n = Number(argv[argv.indexOf("--suggest") + 1]) || 1;
        for (const p of suggest(result.ports, n)) {
            console.log(p);
        }
        return 0;
    }

    if (argv.includes("--summary")) {
        console.log(formatSummary(result));
        return strictExitCode(result);
    }

    if (argv.includes("--consolidate")) {
        console.log(formatConsolidation(result));
        return 0;
    }

    if (argv.includes("--ai")) {
        console.log(formatAiPrompt(result));
        return 0;
    }

    if (argv.includes("--list")) {
        for (const p of [...result.ports.keys()].sort((a, b) => a - b)) {
            console.log(`  ${p}  ${[...result.ports.get(p).keys()].join(", ")}`);
        }
        return 0;
    }

    console.log(formatReport(result));
    return exitCode(result);
}

process.exit(main());
