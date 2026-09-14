/**
 * The image replay broken into its stages, each measured on its own:
 *
 *   inflate    gzip bytes -> one text (the Node.js zlib inflater the entry point installs)
 *   split      that text -> an array of lines
 *   parse      JSON.parse of every line, nothing built
 *   decode     the real reader: JSON.parse + decodeHeader/decodeNode -> NodesetRecord
 *   full       generateAddressSpaceRaw over the images, for reference
 *
 *     node benchmark/bench_image_read.mjs [iterations]
 *
 * Every figure is the minimum over the iterations, the first dropped: on a busy machine the
 * minimum is the estimate of the intrinsic cost and the mean only says how busy the machine was.
 */
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { nodesets } from "node-opcua-nodesets";
import { AddressSpace, generateAddressSpaceRaw, nodesetToImage } from "../dist/api/index.js";
import { imageLinesToRecords, inflatedImageLines, releaseInflatedImageLines } from "../dist/api/loader/nodeset_image.js";
import "../distNodeJS/index.js";

const iterations = Number.parseInt(process.argv[2] || "", 10) || 20;
const names = (process.env.BENCH_NODESETS || "standard,di").split(",");
const files = names.map((n) => nodesets[n]);

const images = [];
for (const f of files) images.push(await nodesetToImage(new Uint8Array(fs.readFileSync(f))));
for (const image of images) releaseInflatedImageLines(image);
const imageBytes = images.reduce((a, i) => a + i.length, 0);

async function benchAsync(name, fn) {
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < iterations; i++) {
        const t0 = performance.now();
        await fn();
        const dt = performance.now() - t0;
        if (i > 0) best = Math.min(best, dt);
    }
    return [name, best];
}
function bench(name, fn) {
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < iterations; i++) {
        const t0 = performance.now();
        fn();
        const dt = performance.now() - t0;
        if (i > 0) best = Math.min(best, dt);
    }
    return [name, best];
}

const results = [];
results.push(
    await benchAsync("inflate+split", async () => {
        for (const image of images) {
            await inflatedImageLines(image);
            releaseInflatedImageLines(image);
        }
    })
);

// the lines, kept, so that the stages below do not pay the inflate again
const lineSets = [];
for (const image of images) {
    lineSets.push(await inflatedImageLines(image));
    releaseInflatedImageLines(image);
}
const textLength = lineSets.reduce((a, l) => a + l.reduce((b, s) => b + s.length + 1, 0), 0);
const lineCount = lineSets.reduce((a, l) => a + l.length, 0);

let sink = 0;
results.push(
    bench("parse only", () => {
        for (const lines of lineSets) {
            for (const line of lines) {
                if (line.length === 0) continue;
                const json = JSON.parse(line);
                if (json) sink += 1;
            }
        }
    })
);
results.push(
    bench("decode", () => {
        for (const lines of lineSets) {
            for (const record of imageLinesToRecords(lines, {})) {
                if (record) sink += 1;
            }
        }
    })
);
results.push(
    await benchAsync("full load", async () => {
        const addressSpace = AddressSpace.create();
        await generateAddressSpaceRaw(addressSpace, images, {});
        addressSpace.dispose();
        for (const image of images) releaseInflatedImageLines(image);
    })
);

console.log(
    `RESULT ${results.map(([n, v]) => `${n}=${v.toFixed(1)}ms`).join(" ")} ` +
        `| imageBytes=${(imageBytes / 1048576).toFixed(2)}MB text=${(textLength / 1048576).toFixed(2)}MB lines=${lineCount} sink=${sink}`
);
