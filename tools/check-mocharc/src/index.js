#!/usr/bin/env node
/**
 * check-mocharc - keep every package's mocha configuration on one robust shape.
 *
 * Mocha does not merge configuration files. The nearest .mocharc wins outright, so a
 * package that wants a single setting changed - almost always `timeout` - has to restate
 * the loader list as well. That is how this repo came to have 52 hand-maintained
 * configs, 24 of them carrying a loader as a relative path:
 *
 *     require:
 *       - ../../node_modules/should
 *
 * Those resolve from mocha's own install directory rather than the working directory, so
 * whether one works depends on how deep the package happens to sit. The same mistake one
 * level up - "../node_modules/..." in packages/.mocharc.yml - expanded to
 * mocha/lib/node_modules/... and every package without a config of its own failed to
 * start with ERR_MODULE_NOT_FOUND, while the deeper copies kept working by accident.
 *
 * The shape enforced here removes the class rather than the instances:
 *
 *     module.exports = {
 *         ...require("../.mocharc.js"),
 *         timeout: 20000
 *     };
 *
 * Loaders are declared once, in packages/.mocharc.js, through require.resolve - absolute
 * paths, immune to depth and to pnpm's layout. A package lists only what it changes, and
 * a package that changes nothing carries no config at all.
 *
 * Usage:
 *     node tools/check-mocharc.mjs            # report, exit 1 if anything is off-pattern
 *     node tools/check-mocharc.mjs --fix      # rewrite to the canonical shape
 *     node tools/check-mocharc.mjs --verbose  # list every package, not just the offenders
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const require_ = createRequire(path.join(repoRoot, "package.json"));

/** roots scanned for workspace packages */
const PACKAGE_ROOTS = ["packages", "packages_extra"];
/** the shared baseline, as written from inside a package directory */
const BASELINE_SPREAD = '...require("../.mocharc.js")';
/** configs mocha accepts but this tool will not generate */
const FOREIGN_EXTENSIONS = [".yml", ".yaml", ".json", ".jsonc", ".cjs", ".mjs", ".js"];

/**
 * The config is CommonJS whichever package it sits in, so a package declaring
 * "type": "module" needs the .cjs extension - a .mocharc.js there is parsed as ESM and
 * dies on `module is not defined in ES module scope`. Mocha looks for both.
 */
function canonicalName(dir) {
    try {
        return require_(path.join(dir, "package.json")).type === "module" ? ".mocharc.cjs" : ".mocharc.js";
    } catch {
        return ".mocharc.js";
    }
}

const HEADER = `// Mocha does not merge configuration files: the nearest .mocharc wins outright, so a
// package that wants one setting changed would otherwise have to restate everything.
// Spreading the shared baseline avoids that - loaders stay defined in exactly one place,
// packages/.mocharc.js, which resolves them with require.resolve.
//
// Never put a relative path in \`require\`. Mocha resolves those from its own install
// directory, not the working directory, so they depend on how deep the package sits and
// break under pnpm's layout. Run \`pnpm run check:mocharc\` after editing this file.
`;

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** the canonical text for a package config carrying these overrides */
function render(overrides) {
    const body = Object.keys(overrides)
        .sort()
        .map((k) => `    ${IDENTIFIER.test(k) ? k : JSON.stringify(k)}: ${JSON.stringify(overrides[k])}`)
        .join(",\n");
    return `${HEADER}\nmodule.exports = {\n    ${BASELINE_SPREAD},\n${body}\n};\n`;
}

/** every setting a config changes relative to the baseline */
function overridesOf(config, baseline) {
    const out = {};
    for (const [k, v] of Object.entries(config)) {
        if (!deepEqual(v, baseline[k])) {
            out[k] = v;
        }
    }
    return out;
}

function packageDirs() {
    const dirs = [];
    for (const root of PACKAGE_ROOTS) {
        const abs = path.join(repoRoot, root);
        if (!fs.existsSync(abs)) {
            continue;
        }
        for (const name of fs.readdirSync(abs)) {
            const dir = path.join(abs, name);
            if (fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, "package.json"))) {
                dirs.push(dir);
            }
        }
    }
    return dirs;
}

function main() {
    const fix = process.argv.includes("--fix");
    const verbose = process.argv.includes("--verbose");

    const baselinePath = path.join(repoRoot, "packages", ".mocharc.js");
    if (!fs.existsSync(baselinePath)) {
        console.log(`check-mocharc: no baseline at ${path.relative(repoRoot, baselinePath)} - nothing to check against.`);
        return 1;
    }
    const baseline = require_(baselinePath);

    const problems = [];
    let rewritten = 0;
    let removed = 0;
    let clean = 0;

    for (const dir of packageDirs()) {
        const rel = path.relative(repoRoot, dir).split(path.sep).join("/");
        const wanted = canonicalName(dir);
        const jsConfig = path.join(dir, wanted);

        // Anything in another shape is reported rather than converted: doing it would
        // mean parsing YAML, a dependency taken on for a migration that happens once.
        for (const ext of FOREIGN_EXTENSIONS) {
            if (ext !== wanted.slice(".mocharc".length) && fs.existsSync(path.join(dir, `.mocharc${ext}`))) {
                problems.push({ rel, kind: "foreign", detail: `.mocharc${ext} - this package wants ${wanted}` });
            }
        }

        if (!fs.existsSync(jsConfig)) {
            clean++;
            if (verbose) {
                console.log(`  ok          ${rel} (inherits the baseline)`);
            }
            continue;
        }

        const text = fs.readFileSync(jsConfig, "utf8");
        if (!text.includes(BASELINE_SPREAD)) {
            problems.push({ rel, kind: "no-spread", detail: `does not spread ${BASELINE_SPREAD}` });
            continue;
        }

        if (require_.cache) {
            delete require_.cache[jsConfig];
        }
        let config;
        try {
            config = require_(jsConfig);
        } catch (err) {
            problems.push({ rel, kind: "unloadable", detail: err.message.split("\n")[0] });
            continue;
        }

        // `require` belongs to the baseline alone: a package that redeclares it discards
        // the resolved absolute paths and reintroduces the very bug this prevents.
        const overrides = overridesOf(config, baseline);
        if ("require" in overrides) {
            problems.push({ rel, kind: "own-require", detail: "declares `require`; loaders belong in the baseline" });
            if (!fix) {
                continue;
            }
            delete overrides.require;
        }

        if (Object.keys(overrides).length === 0) {
            problems.push({ rel, kind: "redundant", detail: "changes nothing; the file can be deleted" });
            if (fix) {
                fs.unlinkSync(jsConfig);
                removed++;
            }
            continue;
        }

        const canonical = render(overrides);
        if (text !== canonical) {
            problems.push({ rel, kind: "drift", detail: `off canonical shape (${Object.keys(overrides).sort().join(", ")})` });
            if (fix) {
                fs.writeFileSync(jsConfig, canonical);
                rewritten++;
            }
            continue;
        }

        clean++;
        if (verbose) {
            console.log(`  ok          ${rel} (${Object.keys(overrides).sort().join(", ")})`);
        }
    }

    const foreign = problems.filter((p) => p.kind === "foreign");

    if (fix) {
        console.log(`check-mocharc: rewrote ${rewritten}, removed ${removed} redundant config(s), ${clean} already on pattern.`);
        if (foreign.length) {
            console.log(`  ${foreign.length} config(s) must be converted by hand:`);
            for (const p of foreign) {
                console.log(`    ${p.rel}: ${p.detail}`);
            }
            return 1;
        }
        return 0;
    }

    if (problems.length === 0) {
        console.log(`check-mocharc: ${clean} package(s) on pattern.`);
        return 0;
    }

    console.log(`check-mocharc: ${problems.length} package(s) off pattern\n`);
    for (const p of problems) {
        console.log(`  ${p.kind.padEnd(11)} ${p.rel}`);
        console.log(`              ${p.detail}`);
    }
    if (problems.length > foreign.length) {
        console.log("\nRun with --fix to rewrite them.");
    }
    return 1;
}

process.exit(main());
