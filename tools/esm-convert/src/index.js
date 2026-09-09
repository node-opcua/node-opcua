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
import { analyze, convertAnchors, convertMocharc, packageFiles, setTypeModule, survey } from "./rule.js";

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

/** the workspace at a glance: how much of FEAT-2 a tool can finish on its own */
function reportSurvey(s) {
    const lines = [
        `esm-convert: ${s.total} packages - ${s.alreadyEsm.length} already ESM, ${s.mechanical.length} mechanical, ${s.needsDecision.length} need a decision`,
        ""
    ];

    if (s.needsDecision.length) {
        lines.push("  need a decision:");
        for (const p of s.needsDecision) {
            const kinds = [...new Set(p.manual.map((m) => m.kind))];
            if (p.mocharc === "unrecognised") kinds.push("mocharc");
            lines.push(`    ${p.packageName.padEnd(46)} ${kinds.join(", ")}`);
        }
        lines.push("");
    }

    const byKind = new Map();
    for (const p of s.needsDecision) {
        for (const m of p.manual) byKind.set(m.kind, (byKind.get(m.kind) ?? 0) + 1);
    }
    if (byKind.size) {
        lines.push("  by kind:");
        for (const [kind, n] of [...byKind].sort((a, b) => b[1] - a[1])) {
            lines.push(`    ${String(n).padStart(3)}  ${kind}`);
        }
        lines.push("");
    }

    lines.push(
        `  ${s.mechanical.length} of ${s.total - s.alreadyEsm.length} remaining packages can be converted without anyone reading them:`,
        "  esm-convert --write, then tsc -b <pkg> --force, then that package's suite."
    );
    return lines.join("\n");
}

function main() {
    const argv = process.argv.slice(2);

    if (argv.includes("--all")) {
        console.log(reportSurvey(survey({ repoRoot: valueOf(argv, "--root") ?? "." })));
        return 0;
    }

    const packageName = valueOf(argv, "--package");
    if (!packageName) {
        console.error("usage: node tools/esm-convert.mjs --package <name> [--write]   |   --all");
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
