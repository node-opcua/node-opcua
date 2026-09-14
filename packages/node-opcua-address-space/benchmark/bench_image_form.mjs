/**
 * The same image in the two forms the reader already accepts — gzip and plain — loaded end to
 * end. Nothing on disk changes: `isGzip` tells them apart on the first byte, so an image store
 * that keeps its entries uncompressed is read by today's loader unmodified.
 *
 *     node benchmark/bench_image_form.mjs [runs]
 *
 * Every figure is the minimum over the runs, the first dropped.
 */
import fs from "node:fs";
import zlib from "node:zlib";
import { performance } from "node:perf_hooks";
import { nodesets } from "node-opcua-nodesets";
import { AddressSpace, generateAddressSpaceRaw, nodesetToImage } from "../dist/api/index.js";
import { releaseInflatedImageLines } from "../dist/api/loader/nodeset_image.js";
import "../distNodeJS/index.js";

const runs = Number.parseInt(process.argv[2] || "", 10) || 20;
const files = (process.env.BENCH_NODESETS || "standard,di").split(",").map((n) => nodesets[n]);

const gz = [];
for (const f of files) gz.push(await nodesetToImage(new Uint8Array(fs.readFileSync(f))));
const plain = gz.map((image) => new Uint8Array(zlib.gunzipSync(Buffer.from(image))));

async function bench(name, images) {
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < runs; i++) {
        for (const im of images) releaseInflatedImageLines(im);
        const addressSpace = AddressSpace.create();
        const t0 = performance.now();
        await generateAddressSpaceRaw(addressSpace, images, {});
        const dt = performance.now() - t0;
        addressSpace.dispose();
        if (i > 0) best = Math.min(best, dt);
    }
    const bytes = images.reduce((a, im) => a + im.length, 0);
    return `${name}=${best.toFixed(1)}ms(${(bytes / 1048576).toFixed(2)}MB)`;
}

// interleaved, so a busy stretch does not land on one form only
const results = { gzip: Number.POSITIVE_INFINITY, plain: Number.POSITIVE_INFINITY };
const out = [];
for (let round = 0; round < 3; round++) {
    out.push(await bench("gzip", gz));
    out.push(await bench("plain", plain));
}
console.log(`RESULT ${out.join(" ")}`);
