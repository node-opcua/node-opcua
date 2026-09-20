#!/usr/bin/env node
/**
 * check-proto-pollution - command line around src/rule.js.
 *
 * Usage:
 *     node tools/check-proto-pollution.mjs                    # report, exit 1 on a NEW finding
 *     node tools/check-proto-pollution.mjs --package node-opcua-server
 *     node tools/check-proto-pollution.mjs --update           # accept current findings into the baseline
 *     node tools/check-proto-pollution.mjs --all              # ignore the baseline, list every finding
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { analyze, currentBaseline, exitCode, formatReport } from "./rule.js";

function valueOf(argv, flag) {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
}

function main() {
    const argv = process.argv.slice(2);
    const repoRoot = valueOf(argv, "--root") ?? ".";
    const baselineFile = path.join(repoRoot, "tools", "proto-pollution-baseline.json");

    const result = analyze({ repoRoot, packageFilter: valueOf(argv, "--package") });

    if (argv.includes("--update")) {
        const baseline = currentBaseline(result);
        fs.writeFileSync(baselineFile, `${JSON.stringify(baseline, null, 4)}\n`);
        console.log(`proto-pollution baseline updated: ${Object.keys(baseline).length} accepted finding(s)`);
        return 0;
    }

    const baseline = argv.includes("--all")
        ? {}
        : fs.existsSync(baselineFile)
          ? JSON.parse(fs.readFileSync(baselineFile, "utf8"))
          : {};
    console.log(formatReport(result, baseline));
    return exitCode(result, baseline);
}

process.exit(main());
