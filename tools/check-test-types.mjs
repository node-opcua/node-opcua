// Ratchet on test-suite type-checking.
//
// Test files run untranspiled (mocha + ts-node/tsx), so `tsc -b packages`
// never sees them: a type-invalid test only fails at RUNTIME, deep inside a
// CI run — or worse, silently changes what the test asserts. Every package
// carries a `test:check` script (tsc --noEmit over its test folder), but it
// was never gated and most packages have drifted red.
//
// This check runs every package's test type-check. Packages that were
// already failing are grandfathered in the baseline below; a package that
// is green (or new) must STAY green. When you repair a baselined package,
// remove it from the baseline — the ratchet only ever tightens. Run with
// --update to rewrite the baseline (never commit an --update that adds a
// package).
import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselineFile = path.join(repoRoot, "tools", "test-types-baseline.json");
const packagesRoot = path.join(repoRoot, "packages");

const require = createRequire(path.join(repoRoot, "package.json"));
const tscBin = require.resolve("typescript/bin/tsc");

/** every package that declares a test:check script, with the tsconfig it points at */
function collectPackages() {
    const result = [];
    for (const pkg of fs.readdirSync(packagesRoot)) {
        const packageJsonFile = path.join(packagesRoot, pkg, "package.json");
        if (!fs.existsSync(packageJsonFile)) continue;
        const packageJson = JSON.parse(fs.readFileSync(packageJsonFile, "utf8"));
        const script = packageJson.scripts?.["test:check"];
        if (!script) continue;
        const m = script.match(/-p\s+(\S+)/);
        result.push({ name: pkg, dir: path.join(packagesRoot, pkg), tsconfig: m ? m[1] : "test/tsconfig.json" });
    }
    return result;
}

function runOne({ name, dir, tsconfig }) {
    return new Promise((resolve) => {
        if (!fs.existsSync(path.join(dir, tsconfig))) {
            resolve({ name, ok: false, output: `missing ${tsconfig} (the test:check script points at it)` });
            return;
        }
        const child = spawn(process.execPath, [tscBin, "--noEmit", "-p", tsconfig], { cwd: dir });
        let output = "";
        child.stdout.on("data", (d) => {
            output += d;
        });
        child.stderr.on("data", (d) => {
            output += d;
        });
        child.on("close", (code) => resolve({ name, ok: code === 0, output }));
    });
}

async function runAll(packages) {
    const queue = [...packages];
    const results = [];
    const concurrency = Math.min(8, Math.max(1, os.cpus().length - 1));
    await Promise.all(
        Array.from({ length: concurrency }, async () => {
            for (let job = queue.shift(); job; job = queue.shift()) {
                results.push(await runOne(job));
            }
        })
    );
    return results;
}

const results = await runAll(collectPackages());
const failing = results
    .filter((r) => !r.ok)
    .map((r) => r.name)
    .sort();

if (process.argv.includes("--update")) {
    fs.writeFileSync(baselineFile, `${JSON.stringify({ failingPackages: failing }, null, 4)}\n`);
    console.log(`test-types baseline updated: ${failing.length} failing package(s)`);
    process.exit(0);
}

const baseline = new Set(JSON.parse(fs.readFileSync(baselineFile, "utf8")).failingPackages);
let failed = false;
for (const r of results) {
    if (!r.ok && !baseline.has(r.name)) {
        failed = true;
        const lines = r.output.split(/\r?\n/).filter(Boolean);
        const shown = lines.slice(0, 25).join("\n  ");
        console.error(
            `ERROR: ${r.name} no longer type-checks its tests (tsc --noEmit -p test/tsconfig.json):\n  ${shown}` +
                (lines.length > 25 ? `\n  ... ${lines.length - 25} more line(s)` : "")
        );
    } else if (r.ok && baseline.has(r.name)) {
        console.log(`note: ${r.name} is green but still baselined — tighten it with: node tools/check-test-types.mjs --update`);
    }
}
if (failed) {
    process.exit(1);
}
console.log(`test-types ratchet: OK (${results.length} packages checked, ${failing.length} grandfathered)`);
