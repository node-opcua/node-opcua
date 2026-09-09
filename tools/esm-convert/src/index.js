#!/usr/bin/env node
/**
 * esm-convert - do the mechanical half of converting a package to ESM, and report the rest.
 *
 * Usage:
 *     node tools/esm-convert.mjs --package node-opcua-transport            # report only
 *     node tools/esm-convert.mjs --package node-opcua-transport --write    # apply
 *
 * It never rewrites anything whose ESM form changes behaviour. Those are listed so a person
 * can decide, and the exit code is 0 either way: this is a helper, not a gate.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { analyze, convertAnchors, convertMocharc, packageFiles, setTypeModule } from "./rule.js";

function valueOf(argv, flag) {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
}

function apply(result) {
    const done = [];

    const manifestPath = path.join(result.dir, "package.json");
    const manifest = setTypeModule(fs.readFileSync(manifestPath, "utf8"));
    if (manifest) {
        fs.writeFileSync(manifestPath, manifest);
        done.push('package.json: "type": "module"');
    }

    const mocharcPath = path.join(result.dir, ".mocharc.js");
    if (result.mocharc === "convertible") {
        const next = convertMocharc(fs.readFileSync(mocharcPath, "utf8"));
        if (next) {
            fs.writeFileSync(mocharcPath, next);
            done.push(".mocharc.js: module.exports -> export default");
        }
    }

    for (const file of packageFiles(result.dir)) {
        const text = fs.readFileSync(file, "utf8");
        const next = convertAnchors(text);
        if (next !== null && next !== text) {
            fs.writeFileSync(file, next);
            done.push(`${path.relative(result.dir, file).replace(/\\/g, "/")}: __dirname -> import.meta.dirname`);
        }
    }
    return done;
}

function report(result, applied) {
    const lines = [];
    if (!result.found) {
        return `esm-convert: no package named ${result.packageName}`;
    }
    lines.push(`esm-convert: ${result.packageName}${result.alreadyEsm && !applied ? "  (already ESM)" : ""}`, "");

    if (applied) {
        lines.push(applied.length ? "  applied:" : "  nothing to apply");
        for (const d of applied) lines.push(`    ${d}`);
    } else {
        lines.push("  would apply:");
        if (!result.alreadyEsm) lines.push('    package.json: "type": "module"');
        if (result.mocharc === "convertible") lines.push("    .mocharc.js: module.exports -> export default");
        for (const a of result.anchors) lines.push(`    ${a}: __dirname -> import.meta.dirname`);
        if (result.alreadyEsm && result.mocharc !== "convertible" && result.anchors.length === 0) {
            lines.push("    nothing");
        }
    }

    if (result.mocharc === "unrecognised") {
        lines.push("", "  .mocharc.js is not a shape this tool rewrites - convert it by hand");
    }

    if (result.manual.length) {
        lines.push("", `  needs a decision (${result.manual.length}):`);
        for (const m of result.manual) {
            lines.push(`    ${m.file}:${m.line}  [${m.kind}]`);
            lines.push(`        ${m.text}`);
            lines.push(`        -> ${m.why}`);
        }
    }

    lines.push(
        "",
        "  after applying, rebuild with --force: tsc does not re-emit on a `type` change alone,",
        `  so \`npx tsc -b packages/${result.packageName} --force\` is what actually produces ESM.`,
        "  then: the package's own suite, and both consumer smoke tests."
    );
    return lines.join("\n");
}

function main() {
    const argv = process.argv.slice(2);
    const packageName = valueOf(argv, "--package");
    if (!packageName) {
        console.error("usage: node tools/esm-convert.mjs --package <name> [--write]");
        return 2;
    }
    const repoRoot = valueOf(argv, "--root") ?? ".";
    const result = analyze({ repoRoot, packageName });
    if (!result.found) {
        console.error(report(result, null));
        return 1;
    }
    const applied = argv.includes("--write") ? apply(result) : null;
    console.log(report(result, applied));
    return 0;
}

process.exit(main());
