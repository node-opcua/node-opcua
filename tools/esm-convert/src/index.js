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
import { analyze, convertAnchors, convertDynamicRequire, mocharcRename, packageFiles, setTypeModule, survey } from "./rule.js";

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

    // a rename, not a rewrite: check-mocharc mandates .cjs for an ESM package and owns the
    // canonical content, so it stays the only thing that renders these files
    const rename = mocharcRename(result.dir);
    if (rename) {
        fs.renameSync(rename.from, rename.to);
        done.push(".mocharc.js -> .mocharc.cjs");
    }

    for (const file of packageFiles(result.dir)) {
        const original = fs.readFileSync(file, "utf8");
        const rel = path.relative(result.dir, file).replace(/\\/g, "/");
        let text = original;

        const anchored = convertAnchors(text);
        if (anchored !== null && anchored !== text) {
            text = anchored;
            done.push(`${rel}: __dirname -> import.meta.dirname`);
        }
        const required = convertDynamicRequire(text);
        if (required !== null && required !== text) {
            text = required;
            done.push(`${rel}: require(nonLiteral) kept, behind createRequire`);
        }
        if (text !== original) {
            fs.writeFileSync(file, text);
        }
    }

    for (const shim of result.shims) {
        fs.writeFileSync(shim.file, shim.rewritten);
        const rel = path.relative(result.dir, shim.file).replace(/\\/g, "/");
        done.push(`${rel}: module.exports = require("${shim.spec}") -> export * from "${shim.resolved}"`);
        if (shim.dts) {
            fs.writeFileSync(shim.dts.file, shim.dts.rewritten);
            const dtsRel = path.relative(result.dir, shim.dts.file).replace(/\\/g, "/");
            done.push(`${dtsRel}: export * from "..." -> export * from "${shim.resolved}"`);
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
        if (result.mocharc === "rename") lines.push("    .mocharc.js -> .mocharc.cjs");
        for (const a of result.anchors) lines.push(`    ${a}: __dirname -> import.meta.dirname`);
        for (const d of result.dynamicRequires ?? []) lines.push(`    ${d}: require(nonLiteral) kept, behind createRequire`);
        for (const shim of result.shims ?? []) {
            const shimRel = shim.file.replace(/\\/g, "/").slice(result.dir.length + 1);
            lines.push(`    ${shimRel}: module.exports = require("${shim.spec}") -> export * from "${shim.resolved}"`);
            if (shim.dts) {
                const dtsRel = shim.dts.file.replace(/\\/g, "/").slice(result.dir.length + 1);
                lines.push(`    ${dtsRel}: export * from "..." -> export * from "${shim.resolved}"`);
            }
        }
        if (result.alreadyEsm && result.mocharc !== "rename" && result.anchors.length === 0 && (result.shims ?? []).length === 0) {
            lines.push("    nothing");
        }
    }

    if (result.manual.length) {
        lines.push("", `  needs a decision (${result.manual.length}):`);
        for (const m of result.manual) {
            lines.push(`    ${m.file}:${m.line}  [${m.kind}]`);
            lines.push(`        ${m.text}`);
            lines.push(`        -> ${m.why}`);
        }
    }

    if (result.deadFiles?.length) {
        lines.push("", `  dead - not shipped, nothing live references it (${result.deadFiles.length}):`);
        for (const d of result.deadFiles) lines.push(`    ${d.file}`);
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
        `esm-convert: ${s.total} packages - ${s.alreadyEsm.length} already ESM, ${s.mechanical.length} mechanical, ` +
            `${s.needsDecision.length} need a decision, ${s.deadTotal} dead files not shipped`,
        ""
    ];

    if (s.needsDecision.length) {
        lines.push("  need a decision:");
        for (const p of s.needsDecision) {
            const kinds = [...new Set(p.manual.map((m) => m.kind))];
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

    if (s.stillHasCommonJs.length) {
        lines.push("  already ESM but still has CommonJS left:");
        for (const p of s.stillHasCommonJs) {
            const what = [
                ...(p.shims.length ? [`${p.shims.length} entry shim(s) to rewrite`] : []),
                ...(p.manual.length ? [...new Set(p.manual.map((m) => m.kind))] : [])
            ];
            lines.push(`    ${p.packageName.padEnd(46)} ${what.join(", ")}`);
        }
        lines.push("");
    }

    if (s.deadTotal) {
        lines.push(`  dead - not shipped, nothing live references it (${s.deadTotal}):`);
        for (const p of s.packages) {
            if (!p.deadFiles?.length) continue;
            for (const d of p.deadFiles) lines.push(`    ${d.file}`);
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
