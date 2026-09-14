/**
 * The image replay taken apart stage by stage, to see which of them is worth attacking:
 *
 *   inflate      gzip bytes -> one text (Node zlib, as the entry point installs it)
 *   split        that text -> an array of lines
 *   parse/line   JSON.parse of each line, nothing built     <- what NDJSON framing costs
 *   parse/array  one JSON.parse over the same records framed as a single array
 *   decodeNode   the pre-parsed JSON objects -> NodesetRecord, no JSON.parse
 *   read         the real reader: parse/line + decodeNode + the trailer checks
 *
 *     node benchmark/bench_image_stages.mjs [iterations]
 *
 * `parse/array` reads the same bytes with a different framing, to answer "is per-line JSON.parse
 * inherently the cost?". It builds nothing on disk and changes no format; it is a measurement.
 * Every figure is the minimum over the iterations, the first dropped.
 */
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { nodesets } from "node-opcua-nodesets";
import { nodesetToImage } from "../dist/api/index.js";
import { imageLinesToRecords, inflatedImageLines, releaseInflatedImageLines } from "../dist/api/loader/nodeset_image.js";
import { decodeHeader, decodeNode } from "../dist/api/loader/nodeset_image_codec.js";
import "../distNodeJS/index.js";

const iterations = Number.parseInt(process.argv[2] || "", 10) || 25;
const names = (process.env.BENCH_NODESETS || "standard,di").split(",");
const files = names.map((n) => nodesets[n]);

const images = [];
for (const f of files) images.push(await nodesetToImage(new Uint8Array(fs.readFileSync(f))));
for (const im of images) releaseInflatedImageLines(im);

let sink = 0;
const out = [];
function bench(name, fn) {
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < iterations; i++) {
        const t0 = performance.now();
        fn();
        const dt = performance.now() - t0;
        if (i > 0) best = Math.min(best, dt);
    }
    out.push(`${name}=${best.toFixed(1)}ms`);
}
async function benchAsync(name, fn) {
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < iterations; i++) {
        const t0 = performance.now();
        await fn();
        const dt = performance.now() - t0;
        if (i > 0) best = Math.min(best, dt);
    }
    out.push(`${name}=${best.toFixed(1)}ms`);
}

await benchAsync("inflate", async () => {
    for (const im of images) {
        await inflatedImageLines(im);
        releaseInflatedImageLines(im);
    }
});

// the inflated texts, kept, so the stages below do not pay the inflate again
const texts = [];
for (const im of images) {
    const lines = await inflatedImageLines(im);
    texts.push(lines.join("\n"));
    releaseInflatedImageLines(im);
}
bench("split", () => {
    for (const text of texts) sink += text.split("\n").length;
});

const lineSets = texts.map((t) => t.split("\n"));
const lineCount = lineSets.reduce((a, l) => a + l.length, 0);
const textLength = texts.reduce((a, t) => a + t.length, 0);

bench("parse/line", () => {
    for (const lines of lineSets) {
        for (const line of lines) {
            if (line.length === 0) continue;
            if (JSON.parse(line)) sink += 1;
        }
    }
});

// the same records framed as one array; the framing is built once, outside the timing
const arrayTexts = lineSets.map((lines) => `[${lines.filter((l) => l.length > 0).join(",")}]`);
bench("parse/array", () => {
    for (const text of arrayTexts) sink += JSON.parse(text).length;
});

// the node records, pre-parsed, so decodeNode is measured without JSON.parse
const jsonSets = lineSets.map((lines) =>
    lines
        .filter((l) => l.length > 0)
        .map((l) => JSON.parse(l))
        .filter((j) => j.kind === undefined)
);
const nodeCount = jsonSets.reduce((a, s) => a + s.length, 0);
bench("decodeNode", () => {
    for (const jsons of jsonSets) {
        for (const json of jsons) {
            if (decodeNode(json)) sink += 1;
        }
    }
});

bench("read", () => {
    for (const lines of lineSets) {
        for (const record of imageLinesToRecords(lines, {})) {
            if (record) sink += 1;
        }
    }
});

// the same work collected into an array instead of yielded: what the generator framing costs
bench("read/array", () => {
    for (const lines of lineSets) {
        const records = [];
        let first = true;
        for (const line of lines) {
            if (line.length === 0) continue;
            const json = JSON.parse(line);
            if (first) {
                first = false;
                records.push(decodeHeader(json));
                continue;
            }
            if (json.kind === "trailer") continue;
            records.push(decodeNode(json));
        }
        sink += records.length;
    }
});

console.log(
    `RESULT ${out.join(" ")} | text=${(textLength / 1048576).toFixed(2)}MB lines=${lineCount} nodes=${nodeCount} sink=${sink}`
);
