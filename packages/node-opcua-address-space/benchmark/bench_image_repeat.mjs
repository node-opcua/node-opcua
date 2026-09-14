/**
 * The same image loaded over and over into a fresh address space, the way a language server
 * rebuilds one per edit, reporting the time and the heap of every load.
 *
 *     node --expose-gc benchmark/bench_image_repeat.mjs [runs]
 *
 * A flat line is what a per-edit rebuild needs. A line that climbs says the process keeps
 * something from the loads that came before.
 */
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { nodesets } from "node-opcua-nodesets";
import { AddressSpace, generateAddressSpaceRaw, nodesetToImage } from "../dist/api/index.js";
import { releaseInflatedImageLines } from "../dist/api/loader/nodeset_image.js";
import { BaseNodeImpl } from "../dist/impl/base_node_impl.js";
import "../distNodeJS/index.js";

const runs = Number.parseInt(process.argv[2] || "", 10) || 40;
const mode = process.argv[3] || "image";
const files = (process.env.BENCH_NODESETS || "standard,di").split(",").map((n) => nodesets[n]);

const images = [];
for (const f of files) images.push(await nodesetToImage(new Uint8Array(fs.readFileSync(f))));

const gc = process.env.BENCH_NO_GC === "1" ? undefined : globalThis.gc;
const mb = (n) => (n / 1048576).toFixed(1);

for (let run = 0; run < runs; run++) {
    for (const im of images) releaseInflatedImageLines(im);
    const addressSpace = AddressSpace.create();
    const t0 = performance.now();
    if (mode === "image") {
        await generateAddressSpaceRaw(addressSpace, images, {});
    } else {
        await generateAddressSpaceRaw(addressSpace, files, (f) => fs.promises.readFile(f, "utf-8"), {});
    }
    const dt = performance.now() - t0;
    addressSpace.dispose();
    gc?.();
    const m = process.memoryUsage();
    console.log(
        `run ${String(run + 1).padStart(3)}: ${dt.toFixed(1).padStart(7)} ms   ` +
            `heapUsed=${mb(m.heapUsed).padStart(7)}MB heapTotal=${mb(m.heapTotal).padStart(7)}MB ` +
            `external=${mb(m.external).padStart(6)}MB protoProps=${Object.getOwnPropertyNames(BaseNodeImpl.prototype).length}`
    );
}
