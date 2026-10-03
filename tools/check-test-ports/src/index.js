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
 *
 * Where to look (all optional; flags win over the package.json key):
 *     --root <dir>             the workspace to scan                  (default: the current directory)
 *     --package-roots a,b      directories holding one package each   (default: packages,packages_extra)
 *     --test-dirs a,b          per-package directories with tests     (default: test,tests,test_long,...)
 *
 * or, in the workspace root package.json:
 *     "checkTestPorts": { "packageRoots": ["packages"], "testDirs": ["test", "tests"] }
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { analyze, suggest, exitCode, strictExitCode, formatReport, formatSummary, formatAiPrompt, formatConsolidation } from "./scanner.js";

/** the value following a flag, or undefined */
function flagValue(argv, name) {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
}

const list = (text) => text.split(",").map((x) => x.trim()).filter(Boolean);

/** what the workspace root package.json says under "checkTestPorts", if anything */
function configOf(root) {
    try {
        return JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).checkTestPorts || {};
    } catch {
        return {};
    }
}

function main() {
    const argv = process.argv.slice(2);
    const root = path.resolve(flagValue(argv, "--root") || process.cwd());
    const config = configOf(root);
    const options = {};
    const packageRoots = flagValue(argv, "--package-roots");
    const testDirs = flagValue(argv, "--test-dirs");
    if (packageRoots || config.packageRoots) {
        options.packageRoots = packageRoots ? list(packageRoots) : config.packageRoots;
    }
    if (testDirs || config.testDirs) {
        options.testDirs = testDirs ? list(testDirs) : config.testDirs;
    }
    const result = analyze(root, options);

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
