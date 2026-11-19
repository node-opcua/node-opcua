/**
 * rule - is every package version of the working tree on the registry?
 *
 * The publish workflow retries `lerna publish from-package`. npm can accept a package and
 * then fail on the provenance step: the transparency log answers "409 an equivalent entry
 * already exists" when a first upload of the entry was stored but answered too late. lerna
 * reports the package as failed and stops, although the version is on the registry. A
 * retry then stops on the next such answer. The release can be complete while every
 * attempt ends in an error.
 *
 * This rule asks the registry for each `name@version` of the working tree, so the workflow
 * can decide from the registry state instead of from the last exit code of lerna.
 *
 * The registry call is kept at the edge (registryHas) so the logic stays pure and the
 * tests can hand it a fabricated registry.
 */

import fs from "node:fs";
import path from "node:path";

import { publishablePackages } from "../../check-pack/src/rule.js";

export const DEFAULT_REGISTRY = "https://registry.npmjs.org";

/**
 * The packages a publish pass must put on the registry: every publishable package, plus the
 * private packages that the pass lifts with --include-private. [{ name, version }]
 */
export function expectedVersions(repoRoot = ".", includePrivate = []) {
    const out = publishablePackages(repoRoot).map(({ name, pkg }) => ({ name, version: pkg.version }));
    if (includePrivate.length) {
        for (const root of ["packages", "packages_extra"]) {
            for (const { name, pkg } of privatePackages(repoRoot, root)) {
                if (includePrivate.includes(name)) {
                    out.push({ name, version: pkg.version });
                }
            }
        }
    }
    return out;
}

function privatePackages(repoRoot, root) {
    const full = path.join(repoRoot, root);
    if (!fs.existsSync(full)) {
        return [];
    }
    const out = [];
    for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
        const manifest = path.join(full, entry.name, "package.json");
        if (!entry.isDirectory() || !fs.existsSync(manifest)) {
            continue;
        }
        const pkg = JSON.parse(fs.readFileSync(manifest, "utf8"));
        if (pkg.private === true) {
            out.push({ name: pkg.name ?? entry.name, pkg });
        }
    }
    return out;
}

/** ask the registry for one version: true (present), false (absent); throws on any other answer */
export async function registryHas(name, version, registry = DEFAULT_REGISTRY) {
    const url = `${registry.replace(/\/$/, "")}/${name.replace("/", "%2F")}/${encodeURIComponent(version)}`;
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (response.status === 200) {
        return true;
    }
    if (response.status === 404) {
        return false;
    }
    throw new Error(`${name}@${version}: registry answered ${response.status}`);
}

/**
 * Which expected versions are not on the registry. `has(name, version)` is injected. The
 * queries run a few at a time. Returns { missing: [{name, version}], failures: [{name, version, error}] }.
 */
export async function analyze(expected, has = registryHas, concurrency = 8) {
    const missing = [];
    const failures = [];
    let next = 0;
    const worker = async () => {
        while (next < expected.length) {
            const item = expected[next++];
            try {
                if (!(await has(item.name, item.version))) {
                    missing.push(item);
                }
            } catch (err) {
                failures.push({ ...item, error: (err?.message ?? String(err)).split("\n")[0] });
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, expected.length) }, worker));
    const byName = (a, b) => a.name.localeCompare(b.name);
    return { checked: expected.length, missing: missing.sort(byName), failures: failures.sort(byName) };
}

/** 0 every version is on the registry, 1 some are missing, 2 the registry could not answer */
export function exitCode(result) {
    if (result.failures.length) {
        return 2;
    }
    return result.missing.length ? 1 : 0;
}

export function formatReport(result) {
    const lines = [];
    if (!result.missing.length && !result.failures.length) {
        lines.push(`check-published: all ${result.checked} package versions are on the registry.`);
        return lines.join("\n");
    }
    if (result.missing.length) {
        lines.push(`check-published: ${result.missing.length} of ${result.checked} package versions are not on the registry:`);
        for (const m of result.missing) {
            lines.push(`  ${m.name}@${m.version}`);
        }
    }
    if (result.failures.length) {
        lines.push(`check-published: the registry did not answer for ${result.failures.length} package versions:`);
        for (const f of result.failures) {
            lines.push(`  ${f.name}@${f.version}: ${f.error}`);
        }
    }
    return lines.join("\n");
}
