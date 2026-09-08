/**
 * rule - every published package declares the same Node floor as the repository root.
 *
 * The root has required `node >= 22.13.0` since Node 18 and 20 were dropped from CI in May
 * 2026. The root is `private: true` and never published, so that declaration reached nobody:
 * the published umbrella still said `>=18`, two more packages said `>=18`, and the other 110
 * said nothing at all. A consumer on Node 18 installed with no warning against a version CI
 * had stopped testing four months earlier.
 *
 * Nothing checked, so nothing noticed. This is that check.
 *
 * It matters more once the packages emit ESM: `require()` of an ES module needs Node 22.12,
 * and below that a CJS consumer gets a hard `ERR_REQUIRE_ESM` at run time. `engines` is the
 * only standard way to turn that into an install-time signal - a warning by default, and a
 * refusal for anyone using `engine-strict`.
 *
 * Equality rather than "at least as strict" on purpose: one floor for the whole workspace,
 * changed in one place. A package that genuinely needs a different one is a decision to make
 * deliberately, not to let drift.
 */

import fs from "node:fs";
import path from "node:path";

/** roots holding the workspace's packages */
export const SOURCE_ROOTS = ["packages", "packages_extra"];

/** the floor the whole workspace declares, read from the repository root */
export function rootFloor(repoRoot = ".") {
    const pj = path.join(repoRoot, "package.json");
    if (!fs.existsSync(pj)) {
        return undefined;
    }
    try {
        return JSON.parse(fs.readFileSync(pj, "utf8")).engines?.node;
    } catch {
        return undefined;
    }
}

/** every published package.json in the workspace, as { name, file, engines } */
export function publishedPackages(repoRoot = ".") {
    const out = [];
    for (const root of SOURCE_ROOTS) {
        const full = path.join(repoRoot, root);
        if (!fs.existsSync(full)) {
            continue;
        }
        for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
            if (!entry.isDirectory()) {
                continue;
            }
            const file = path.join(full, entry.name, "package.json");
            if (!fs.existsSync(file)) {
                continue;
            }
            let pj;
            try {
                pj = JSON.parse(fs.readFileSync(file, "utf8"));
            } catch {
                continue; // a manifest we cannot read is check-pack's business, not ours
            }
            if (pj.private) {
                continue; // never published, so its engines reach no consumer
            }
            out.push({ name: pj.name ?? entry.name, file: file.replace(/\\/g, "/"), engines: pj.engines?.node });
        }
    }
    return out;
}

export function analyze({ repoRoot = "." } = {}) {
    const expected = rootFloor(repoRoot);
    const packages = publishedPackages(repoRoot);
    const findings = [];

    for (const pkg of packages) {
        if (pkg.engines === expected) {
            continue;
        }
        findings.push({
            name: pkg.name,
            file: pkg.file,
            actual: pkg.engines,
            kind: pkg.engines === undefined ? "missing" : "mismatch"
        });
    }
    return { scanned: packages.length, expected, findings };
}

export function exitCode(result) {
    return result.findings.length > 0 || !result.expected ? 1 : 0;
}

export function formatReport(result) {
    if (!result.expected) {
        return "check-engines: the repository root declares no engines.node, so there is no floor to check against.";
    }
    if (result.findings.length === 0) {
        return `check-engines: ${result.scanned} published packages, every one declares node ${result.expected}.`;
    }

    const missing = result.findings.filter((f) => f.kind === "missing");
    const mismatch = result.findings.filter((f) => f.kind === "mismatch");
    const lines = [
        `check-engines: ${result.findings.length} of ${result.scanned} published packages do not declare node ${result.expected}`,
        ""
    ];
    if (mismatch.length) {
        lines.push(`  ${mismatch.length} declare a different floor:`);
        for (const f of mismatch) {
            lines.push(`    ${f.name.padEnd(46)} "${f.actual}"`);
        }
        lines.push("");
    }
    if (missing.length) {
        lines.push(`  ${missing.length} declare no engines at all:`);
        for (const f of missing.slice(0, 10)) {
            lines.push(`    ${f.name}`);
        }
        if (missing.length > 10) {
            lines.push(`    ... and ${missing.length - 10} more`);
        }
        lines.push("");
    }
    lines.push(
        "A published package's engines.node must match the root's. The root is private and",
        "never published, so a floor declared only there reaches no consumer: npm has nothing",
        "to warn about, and a consumer on an unsupported Node finds out at run time instead.",
        "",
        `Set "engines": { "node": "${result.expected}" } in each, or change the root if the`,
        "floor itself is wrong."
    );
    return lines.join("\n");
}
