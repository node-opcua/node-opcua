#!/usr/bin/env node
/**
 * check-no-tla - command line around src/detector.js.
 *
 * Usage:
 *     node tools/check-no-tla.mjs           # report, exit 1 on any module-scope await
 *     node tools/check-no-tla.mjs --list    # every file scanned
 *     node tools/check-no-tla.mjs <root>    # scan a tree other than packages/
 */

import process from "node:process";
import { analyze, findSourceFiles, exitCode, formatReport } from "./detector.js";

function main() {
    const argv = process.argv.slice(2);
    const root = argv.find((a) => !a.startsWith("--")) ?? "packages";

    if (argv.includes("--list")) {
        for (const f of findSourceFiles(root)) {
            console.log(f.replace(/\\/g, "/"));
        }
        return 0;
    }

    const result = analyze(root);
    console.log(formatReport(result));
    return exitCode(result);
}

process.exit(main());
