/**
 * How the NDJSON of an image is best turned into objects.
 *
 *     node benchmark/bench_image_parse.mjs
 *
 * A warm profile of a four-nodeset load puts `JSON.parse` of the image lines at ~11% of the
 * load and the garbage collector at ~13%. The current route inflates to one 3.5 MB string and
 * splits it: `String.split` hands back *sliced* strings that point into the parent, and V8
 * flattens a sliced string — copying it — before it can parse it. So every line is copied once
 * more than it looks.
 *
 * The candidates are timed against each other, interleaved and minimum-of-runs, on the same
 * inflated bytes. Whole-array parse is the ceiling, not a proposal: it needs a format change.
 */
import fs from "node:fs";
import zlib from "node:zlib";
import { nodesets } from "node-opcua-nodesets";

const imagePath = nodesets.standard.replace(/\.xml$/i, ".ndjson.gz");
const text = zlib.gunzipSync(fs.readFileSync(imagePath)).toString("utf8");
const bytes = Buffer.from(text, "utf8");
console.log(`${imagePath.split(/[\\/]/).pop()}: ${(text.length / 1e6).toFixed(2)} MB of text`);

/** current: split the inflated text, parse each sliced line */
function splitThenParse() {
    const lines = text.split("\n");
    let n = 0;
    for (const line of lines) {
        if (line.length === 0) continue;
        JSON.parse(line);
        n++;
    }
    return n;
}

/** parse each line straight out of the inflated bytes, so every string handed to JSON is flat */
function decodePerLineThenParse() {
    const decoder = new TextDecoder("utf-8");
    let n = 0;
    let start = 0;
    for (;;) {
        const nl = bytes.indexOf(10, start);
        const end = nl === -1 ? bytes.length : nl;
        if (end > start) {
            JSON.parse(decoder.decode(bytes.subarray(start, end)));
            n++;
        }
        if (nl === -1) break;
        start = nl + 1;
    }
    return n;
}

/** the same, using Buffer's own utf8 decode rather than TextDecoder */
function bufferToStringThenParse() {
    let n = 0;
    let start = 0;
    for (;;) {
        const nl = bytes.indexOf(10, start);
        const end = nl === -1 ? bytes.length : nl;
        if (end > start) {
            JSON.parse(bytes.toString("utf8", start, end));
            n++;
        }
        if (nl === -1) break;
        start = nl + 1;
    }
    return n;
}

/** the ceiling: one parse of the whole document. Needs a format change, measured for scale only */
function wholeArrayParse() {
    const joined = `[${text.trimEnd().split("\n").join(",")}]`;
    return JSON.parse(joined).length;
}

const candidates = [
    ["split + parse (current)", splitThenParse],
    ["TextDecoder per line", decodePerLineThenParse],
    ["Buffer.toString per line", bufferToStringThenParse],
    ["whole array (format change)", wholeArrayParse]
];

// warm every candidate before any of them is timed
for (const [, fn] of candidates) for (let i = 0; i < 3; i++) fn();

const best = new Map(candidates.map(([name]) => [name, Number.POSITIVE_INFINITY]));
const counts = new Map();
for (let round = 0; round < 12; round++) {
    for (const [name, fn] of candidates) {
        const t0 = process.hrtime.bigint();
        const n = fn();
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        counts.set(name, n);
        if (ms < best.get(name)) best.set(name, ms);
    }
}

const baseline = best.get("split + parse (current)");
console.log("\nminimum of 12 interleaved runs:");
for (const [name] of candidates) {
    const ms = best.get(name);
    const ratio = baseline / ms;
    console.log(`  ${name.padEnd(30)} ${ms.toFixed(1).padStart(7)} ms   ${ratio.toFixed(2)}x   (${counts.get(name)} records)`);
}
