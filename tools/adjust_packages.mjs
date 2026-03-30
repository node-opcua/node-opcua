#!/usr/bin/env node
/**
 * adjust_packages.mjs
 *
 * Adds a "test:check" script to every package that has TypeScript
 * test files (`test/*.ts`), and creates a `test/tsconfig.json` if
 * one does not already exist.
 *
 * Usage:
 *   node tools/adjust_packages.mjs            # dry-run (default)
 *   node tools/adjust_packages.mjs --apply    # actually write changes
 *
 * The reference test/tsconfig.json is taken from
 * packages/node-opcua-server-configuration/test/tsconfig.json.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// ── Configuration ──────────────────────────────────────────────
const ROOT = resolve(import.meta.dirname, "..");
const PACKAGES_DIR = join(ROOT, "packages");
const DRY_RUN = !process.argv.includes("--apply");

if (DRY_RUN) {
    console.log("🔍  Dry-run mode. Pass --apply to write changes.\n");
}

// ── Reference test/tsconfig.json ───────────────────────────────
const TEST_TSCONFIG_TEMPLATE = JSON.stringify(
    {
        extends: "../../tsconfig.common.json",
        compilerOptions: {
            rootDir: "..",
            outDir: "../dist-test",
            noEmit: true,
            composite: false,
            incremental: false,
            declaration: false,
            sourceMap: false,
            skipLibCheck: true
        },
        include: ["../source/**/*.ts", "./**/*.ts"],
        exclude: ["../node_modules", "../dist"]
    },
    null,
    4
) + "\n";

const TEST_CHECK_SCRIPT = "tsc --noEmit -p test/tsconfig.json";

// ── Helpers ────────────────────────────────────────────────────
function hasTypeScriptTestFiles(pkgDir) {
    const testDir = join(pkgDir, "test");
    if (!existsSync(testDir) || !statSync(testDir).isDirectory()) {
        return false;
    }
    // Recursively check for .ts files (not .d.ts)
    return findTsFiles(testDir);
}

function findTsFiles(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules") continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (findTsFiles(full)) return true;
        } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
            return true;
        }
    }
    return false;
}

// ── Main ───────────────────────────────────────────────────────
const entries = readdirSync(PACKAGES_DIR, { withFileTypes: true }).filter((e) => e.isDirectory());

let createdTsconfigs = 0;
let addedScripts = 0;
let skippedNoTests = 0;
let skippedAlready = 0;

for (const entry of entries) {
    const pkgDir = join(PACKAGES_DIR, entry.name);
    const pkgJsonPath = join(pkgDir, "package.json");

    if (!existsSync(pkgJsonPath)) continue;

    // Skip packages without TypeScript test files
    if (!hasTypeScriptTestFiles(pkgDir)) {
        skippedNoTests++;
        continue;
    }

    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));

    // ── 1. Create test/tsconfig.json if missing ────────────
    const testTsconfigPath = join(pkgDir, "test", "tsconfig.json");
    if (!existsSync(testTsconfigPath)) {
        console.log(`  📄 CREATE  ${entry.name}/test/tsconfig.json`);
        if (!DRY_RUN) {
            writeFileSync(testTsconfigPath, TEST_TSCONFIG_TEMPLATE, "utf-8");
        }
        createdTsconfigs++;
    }

    // ── 2. Add "test:check" script if missing ──────────────
    if (!pkgJson.scripts) {
        pkgJson.scripts = {};
    }

    if (pkgJson.scripts["test:check"]) {
        skippedAlready++;
        continue;
    }

    console.log(`  📝 ADD     ${entry.name}/package.json  →  "test:check"`);
    addedScripts++;

    if (!DRY_RUN) {
        // Insert "test:check" right after "test" if it exists,
        // otherwise at the end of scripts.
        const newScripts = {};
        let inserted = false;
        for (const [key, value] of Object.entries(pkgJson.scripts)) {
            newScripts[key] = value;
            if (key === "test" && !inserted) {
                newScripts["test:check"] = TEST_CHECK_SCRIPT;
                inserted = true;
            }
        }
        if (!inserted) {
            newScripts["test:check"] = TEST_CHECK_SCRIPT;
        }
        pkgJson.scripts = newScripts;

        // Write back with 4-space indentation + trailing newline
        writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 4) + "\n", "utf-8");
    }
}

// ── Summary ────────────────────────────────────────────────────
console.log("\n── Summary ──────────────────────────────────────");
console.log(`  Created test/tsconfig.json : ${createdTsconfigs}`);
console.log(`  Added "test:check" script  : ${addedScripts}`);
console.log(`  Already had "test:check"   : ${skippedAlready}`);
console.log(`  Skipped (no TS tests)      : ${skippedNoTests}`);
if (DRY_RUN) {
    console.log("\n⚠️  No files were modified. Run with --apply to write changes.");
}
