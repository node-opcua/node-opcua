#!/usr/bin/env node
/**
 * check-entry-points - command line around src/rule.js.
 *
 * Usage:
 *     node tools/check-entry-points.mjs                    # report, exit 1 on a violation
 *     node tools/check-entry-points.mjs --package node-opcua-client
 *     node tools/check-entry-points.mjs --update           # rewrite the baseline
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { analyze, currentCounts, exitCode, formatReport } from "./rule.js";

function valueOf(argv, flag) {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
}

function main() {
    const argv = process.argv.slice(2);
    const repoRoot = valueOf(argv, "--root") ?? ".";
    const baselineFile = path.join(repoRoot, "tools", "entry-points-baseline.json");

    const result = analyze({ repoRoot, packageFilter: valueOf(argv, "--package") });

    if (argv.includes("--update")) {
        const counts = currentCounts(result);
        fs.writeFileSync(baselineFile, `${JSON.stringify(counts, null, 4)}\n`);
        console.log(`entry-points baseline updated: ${Object.keys(counts).length} packages, ${result.internalFindings.length} untagged`);
        return 0;
    }

    const baseline = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, "utf8")) : {};
    console.log(formatReport(result, baseline));
    return exitCode(result, baseline);
}

process.exit(main());
