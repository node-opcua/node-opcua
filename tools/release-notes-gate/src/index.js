#!/usr/bin/env node
/**
 * release-notes-gate - command line around src/rule.js.
 *
 * Wired into the ROOT package's npm lifecycle scripts, which lerna runs:
 *
 *   preversion -> `check`     refuse the release while the Unreleased section is missing or
 *                             empty, before lerna writes anything
 *   version    -> `promote`   rename the heading to `Release X.Y.Z` after lerna has written
 *                             lerna.json, and stage the file so it lands in lerna's own
 *                             release commit
 *
 * And into lint:ci:
 *
 *   check --format            the file is well formed. It never asks for content, because a
 *                             CI-only or test-only pull request has nothing user-visible to say.
 *
 * The version comes from lerna.json, because lerna writes it there and does not bump the root
 * package.json.
 *
 * Usage:
 *     node tools/release-notes-gate.mjs check [--format]
 *     node tools/release-notes-gate.mjs promote [--no-stage]
 *     node tools/release-notes-gate.mjs --root ../other-workspace check
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
    checkFormat,
    checkReleasable,
    formatProblems,
    promote,
    versionFromLerna
} from "./rule.js";

const FILE = "RELEASE_NOTES.md";

function valueOf(argv, flag) {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
}

function read(file) {
    if (!fs.existsSync(file)) {
        console.error(`release refused: ${FILE} does not exist`);
        process.exit(1);
    }
    return fs.readFileSync(file, "utf8");
}

function main() {
    const argv = process.argv.slice(2);
    const root = valueOf(argv, "--root") ?? ".";
    const notes = path.join(root, FILE);
    const command = argv.find((a) => !a.startsWith("--") && a !== root) ?? "check";

    if (command === "check") {
        const text = read(notes);
        const problems = argv.includes("--format") ? checkFormat(text) : checkReleasable(text);
        console.log(formatProblems(problems, FILE));
        if (problems.length > 0 && !argv.includes("--format")) {
            console.log(
                `\nWrite the note under an "Unreleased" heading at the top of ${FILE}, then release again.`
            );
        }
        return problems.length === 0 ? 0 : 1;
    }

    if (command === "promote") {
        const lernaPath = path.join(root, "lerna.json");
        if (!fs.existsSync(lernaPath)) {
            console.error(`cannot promote: ${lernaPath} does not exist`);
            return 1;
        }
        const { version, error } = versionFromLerna(fs.readFileSync(lernaPath, "utf8"));
        if (error) {
            console.error(`cannot promote: ${error}`);
            return 1;
        }
        const result = promote(read(notes), version);
        if (result.error) {
            console.error(`cannot promote ${FILE}: ${result.error}`);
            return 1;
        }
        if (!result.changed) {
            console.log(`${FILE} already reads "${result.from}", nothing to promote`);
            return 0;
        }
        fs.writeFileSync(notes, result.text);
        console.log(`${FILE}: "${result.from}" is now "${result.to}"`);
        if (!argv.includes("--no-stage")) {
            execFileSync("git", ["add", "--", FILE], { cwd: root, stdio: "inherit" });
        }
        return 0;
    }

    console.error(`unknown command "${command}": use check or promote`);
    return 1;
}

process.exit(main());
