#!/usr/bin/env node
/**
 * Writes the precompiled image of every NodeSet2 file of the catalog next to it:
 * packages/node-opcua-nodesets/nodesets/<name>.xml -> <name>.ndjson.gz.
 *
 * The images are committed, so a checkout works without a build step; this script runs when a
 * catalog file changes (and in the package's prepublishOnly). `tools/check-nodeset-images.mjs`
 * is the guard: an image whose trailer digest is not the SHA-256 of its XML fails the check.
 *
 *   node tools/build-nodeset-images.mjs            # every file whose image is missing or stale
 *   node tools/build-nodeset-images.mjs --force    # every file
 *   node tools/build-nodeset-images.mjs --check    # report only, exit 1 when any image is missing or stale
 *
 * Needs node-opcua-address-space built (its dist and distNodeJS).
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogDir = path.join(root, "packages", "node-opcua-nodesets", "nodesets");
const addressSpace = path.join(root, "packages", "node-opcua-address-space");

const force = process.argv.includes("--force");
const checkOnly = process.argv.includes("--check");

export const imageFileOf = (xmlFile) => xmlFile.replace(/\.xml$/i, ".ndjson.gz");

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function main() {
    const { readNodesetImageInfo } = await import(pathToFileURL(path.join(addressSpace, "dist", "api", "index.js")).href);
    const { nodesetFileToImage } = await import(pathToFileURL(path.join(addressSpace, "distNodeJS", "index.js")).href);

    const xmlFiles = fs
        .readdirSync(catalogDir)
        .filter((name) => /\.xml$/i.test(name))
        .sort()
        .map((name) => path.join(catalogDir, name));

    let stale = 0;
    let built = 0;
    for (const xmlFile of xmlFiles) {
        const imageFile = imageFileOf(xmlFile);
        const digest = sha256(fs.readFileSync(xmlFile));
        let current = false;
        if (fs.existsSync(imageFile)) {
            try {
                const info = await readNodesetImageInfo(new Uint8Array(fs.readFileSync(imageFile)));
                current = info.trailer?.sourceDigest === digest;
            } catch {
                current = false;
            }
        }
        if (current && !force) {
            continue;
        }
        if (checkOnly) {
            stale += 1;
            console.error(`${path.basename(imageFile)}: ${fs.existsSync(imageFile) ? "stale" : "missing"} (run: node tools/build-nodeset-images.mjs)`);
            continue;
        }
        const t0 = performance.now();
        const image = await nodesetFileToImage(xmlFile);
        fs.writeFileSync(imageFile, image);
        built += 1;
        console.log(`${path.basename(xmlFile)} -> ${path.basename(imageFile)} (${(image.length / 1024).toFixed(0)} KB, ${(performance.now() - t0).toFixed(0)} ms)`);
    }
    if (checkOnly) {
        console.log(stale === 0 ? `check-nodeset-images: ${xmlFiles.length} images current` : `check-nodeset-images: ${stale} of ${xmlFiles.length} images missing or stale`);
        process.exit(stale === 0 ? 0 : 1);
    }
    console.log(`build-nodeset-images: ${built} written, ${xmlFiles.length - built} already current`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
