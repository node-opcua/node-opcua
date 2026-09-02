#!/usr/bin/env node
/**
 * The guard for the committed catalog images: every NodeSet2 file of node-opcua-nodesets has an
 * image next to it (<name>.ndjson.gz) whose trailer digest is the SHA-256 of the XML bytes. Fails
 * otherwise, naming the files; `node tools/build-nodeset-images.mjs` rebuilds them.
 *
 * Reads the images with zlib alone, so it needs no package built and runs in the lint job.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogDir = path.join(root, "packages", "node-opcua-nodesets", "nodesets");

const xmlFiles = fs
    .readdirSync(catalogDir)
    .filter((name) => /\.xml$/i.test(name))
    .sort();

let failures = 0;
for (const name of xmlFiles) {
    const xmlFile = path.join(catalogDir, name);
    const imageFile = xmlFile.replace(/\.xml$/i, ".ndjson.gz");
    if (!fs.existsSync(imageFile)) {
        failures += 1;
        console.error(`${path.basename(imageFile)}: missing`);
        continue;
    }
    let verdict = "";
    try {
        const text = zlib.gunzipSync(fs.readFileSync(imageFile)).toString("utf8");
        const lines = text.split("\n").filter((l) => l.length > 0);
        const header = JSON.parse(lines[0]);
        const trailer = JSON.parse(lines[lines.length - 1]);
        if (header.kind !== "header") verdict = "no header line";
        else if (trailer.kind !== "trailer") verdict = "no trailer line";
        else if (trailer.nodes !== lines.length - 2) verdict = `trailer announces ${trailer.nodes} nodes, ${lines.length - 2} lines`;
        else if (trailer.sourceDigest !== createHash("sha256").update(fs.readFileSync(xmlFile)).digest("hex")) verdict = "stale: digest differs from the XML";
    } catch (err) {
        verdict = `unreadable: ${err.message}`;
    }
    if (verdict) {
        failures += 1;
        console.error(`${path.basename(imageFile)}: ${verdict}`);
    }
}
if (failures > 0) {
    console.error(`check-nodeset-images: ${failures} of ${xmlFiles.length} images missing or stale; run: node tools/build-nodeset-images.mjs`);
    process.exit(1);
}
console.log(`check-nodeset-images: ${xmlFiles.length} images match their XML`);
