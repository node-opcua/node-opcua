/**
 * rule - the published shape of every package, as a consumer resolves it.
 *
 * Three checks now look at packaging, and they ask different questions:
 *
 *   check-build-graph  is the package compiled at all?
 *   check-pack         is every declared entry point in the tarball?
 *   this one           is the manifest coherent, and does a consumer resolve types?
 *
 * publint reads the packed manifest: exports ordering, a bin without a shebang, a file extension
 * that contradicts "type". attw resolves the package as both an ESM and a CommonJS consumer, which
 * is the only way to see that a consumer is handed declarations it cannot use. Neither duplicates
 * the other two: check-pack proved a promised file exists, not that the promise makes sense.
 *
 * attw runs under the esm-only profile, which ignores the node10 and node16-cjs resolutions. That
 * is a decision, not a convenience: the workspace is moving to ESM, `require(esm)` works from
 * Node 22.12, and the declared floor is 22.13. Without the profile every ESM package reports
 * "node16 (from CJS): ESM (dynamic import only)" and the gate would be permanently red for
 * something deliberate.
 *
 * Ratchet, like check-test-types: packages already failing are grandfathered in
 * tools/package-shape-baseline.json. A package that is green, or new, must stay green. Repair a
 * baselined package and remove it from the baseline with --update; the list only shrinks.
 */

import fs from "node:fs";
import path from "node:path";

export const SOURCE_ROOTS = ["packages", "packages_extra"];

/** every publishable package, the ones a consumer can install */
export function publishableTargets(repoRoot = ".") {
    const out = [];
    for (const root of SOURCE_ROOTS) {
        const base = path.join(repoRoot, root);
        if (!fs.existsSync(base)) {
            continue;
        }
        for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
            if (!entry.isDirectory()) {
                continue;
            }
            const manifest = path.join(base, entry.name, "package.json");
            if (!fs.existsSync(manifest)) {
                continue;
            }
            let pkg;
            try {
                pkg = JSON.parse(fs.readFileSync(manifest, "utf8").replace(/^﻿/, ""));
            } catch {
                continue;
            }
            if (pkg.private === true) {
                continue;
            }
            out.push({ name: pkg.name ?? entry.name, dir: path.join(base, entry.name) });
        }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function readBaseline(repoRoot = ".") {
    const file = path.join(repoRoot, "tools", "package-shape-baseline.json");
    if (!fs.existsSync(file)) {
        return new Set();
    }
    return new Set(JSON.parse(fs.readFileSync(file, "utf8")).failingPackages ?? []);
}

export function writeBaseline(repoRoot, failing) {
    const file = path.join(repoRoot, "tools", "package-shape-baseline.json");
    fs.writeFileSync(file, `${JSON.stringify({ failingPackages: [...failing].sort() }, null, 4)}\n`);
    return file;
}

/**
 * Compare results against the baseline. Pure: `results` is [{name, publint, attw}] where each
 * tool result is { ok, output }, so the tests drive it without packing anything.
 */
export function evaluate(results, baseline) {
    const failures = [];
    const fixed = [];
    for (const r of results) {
        const failedTools = [];
        if (!r.publint.ok) {
            failedTools.push("publint");
        }
        if (!r.attw.ok) {
            failedTools.push("attw");
        }
        if (failedTools.length > 0) {
            if (!baseline.has(r.name)) {
                failures.push({ name: r.name, tools: failedTools, output: outputOf(r, failedTools) });
            }
        } else if (baseline.has(r.name)) {
            fixed.push(r.name);
        }
    }
    return { scanned: results.length, grandfathered: baseline.size, failures, fixed };
}

function outputOf(result, failedTools) {
    return failedTools
        .map((t) => `--- ${t}\n${(result[t].output ?? "").trim()}`)
        .join("\n")
        .split("\n")
        .slice(0, 24)
        .join("\n");
}

export function exitCode(result) {
    return result.failures.length > 0 ? 1 : 0;
}

export function formatReport(result) {
    const lines = [];
    for (const name of result.fixed) {
        lines.push(`note: ${name} is green but still baselined - tighten it with: node tools/check-package-shape.mjs --update`);
    }
    if (result.failures.length === 0) {
        lines.push(`package-shape ratchet: OK (${result.scanned} packages checked, ${result.grandfathered} grandfathered)`);
        return lines.join("\n");
    }
    lines.push(`package-shape: ${result.failures.length} package(s) publish a shape a consumer cannot use`, "");
    for (const f of result.failures) {
        lines.push(`  ${f.name}  (${f.tools.join(", ")})`);
        for (const line of f.output.split("\n")) {
            lines.push(`      ${line}`);
        }
        lines.push("");
    }
    lines.push(
        "publint reads the packed manifest; attw resolves the package the way a consumer's",
        "TypeScript does. Fix the package, or, if this is a known gap being worked on, add it",
        "with: node tools/check-package-shape.mjs --update"
    );
    return lines.join("\n");
}
