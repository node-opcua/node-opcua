// Ratchet on raw private-key access.
//
// The opaque key-operations work (IKeyOperations, getKeyOperations()) is
// migrating node-opcua off direct `.getPrivateKey(` calls: an HSM/KMS-held
// key has no material to return, so every raw-key call site is a place that
// cannot work with an opaque key. Existing call sites are grandfathered in
// the baseline below; this check fails when a package GROWS its count, so
// new code has to go through key operations instead.
//
// When you legitimately remove a call site, lower the baseline number —
// the ratchet only ever tightens. Run with --update to rewrite the baseline
// after removals (never commit an --update that raises a number).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselineFile = path.join(repoRoot, "tools", "private-key-usage-baseline.json");
const packagesRoot = path.join(repoRoot, "packages");

function countInDir(dir) {
    let count = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            count += countInDir(entryPath);
        } else if (entry.name.endsWith(".ts")) {
            const matches = fs.readFileSync(entryPath, "utf8").match(/\.getPrivateKey\(/g);
            if (matches) {
                count += matches.length;
            }
        }
    }
    return count;
}

const counts = {};
for (const pkg of fs.readdirSync(packagesRoot)) {
    const sourceDir = path.join(packagesRoot, pkg, "source");
    if (fs.existsSync(sourceDir)) {
        const count = countInDir(sourceDir);
        if (count > 0) {
            counts[pkg] = count;
        }
    }
}

if (process.argv.includes("--update")) {
    fs.writeFileSync(baselineFile, `${JSON.stringify(counts, null, 4)}\n`);
    console.log("private-key usage baseline updated:", counts);
    process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(baselineFile, "utf8"));
let failed = false;
for (const [pkg, count] of Object.entries(counts)) {
    const allowed = baseline[pkg] ?? 0;
    if (count > allowed) {
        failed = true;
        console.error(
            `ERROR: ${pkg} has ${count} .getPrivateKey( call sites (baseline: ${allowed}).\n` +
                "  New code must use getKeyOperations() / getKeyOperationsFromProvider() instead of the raw key,\n" +
                "  so it keeps working when the key is HSM/KMS-held (opaque). See node-opcua-common."
        );
    } else if (count < allowed) {
        console.log(`note: ${pkg} is below baseline (${count} < ${allowed}) — tighten it with: node tools/check-private-key-usage.mjs --update`);
    }
}
if (failed) {
    process.exit(1);
}
console.log("private-key usage ratchet: OK");
