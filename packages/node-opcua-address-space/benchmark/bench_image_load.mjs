/**
 * A full image load, with the stages of the replay timed inside it rather than replayed on their
 * own, so that the numbers are the ones the loader actually pays:
 *
 *   inflate   the gzip -> text of every image, and the split into lines
 *   decode    JSON.parse + decodeHeader/decodeNode for every line
 *   apply     the records turned into nodes and references
 *   terminate back references, values, data types, promotion
 *
 *     node benchmark/bench_image_load.mjs [runs]
 *
 * Every figure is the minimum over the runs, the first dropped.
 */
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { nodesets } from "node-opcua-nodesets";
import { AddressSpace, generateAddressSpaceRaw, nodesetToImage, setImageInflater } from "../dist/api/index.js";
import * as image_module from "../dist/api/loader/nodeset_image.js";
import { NodeSetLoader } from "../dist/api/loader/load_nodeset2.js";
import { NodesetRecordApplier } from "../dist/api/loader/nodeset_record_applier.js";
import "../distNodeJS/index.js";

const runs = Number.parseInt(process.argv[2] || "", 10) || 20;
const quiet = process.env.BENCH_QUIET === "1";
const names = (process.env.BENCH_NODESETS || "standard,di").split(",");
const files = names.map((n) => nodesets[n]);

const phases = { inflate: 0, decode: 0, apply: 0, terminate: 0 };
const calls = { inflate: 0, lines: 0, records: 0 };

// the inflater is timed by wrapping the one the Node.js entry point installed
const inner = setImageInflater(async (image) => {
    const t0 = performance.now();
    try {
        calls.inflate += 1;
        return await inner(image);
    } finally {
        phases.inflate += performance.now() - t0;
    }
});

function timeSync(proto, name, bucket) {
    const original = proto[name];
    proto[name] = function (...args) {
        const t0 = performance.now();
        try {
            return original.apply(this, args);
        } finally {
            phases[bucket] += performance.now() - t0;
        }
    };
}
function timeAsync(proto, name, bucket) {
    const original = proto[name];
    proto[name] = async function (...args) {
        const t0 = performance.now();
        try {
            return await original.apply(this, args);
        } finally {
            phases[bucket] += performance.now() - t0;
        }
    };
}
timeSync(NodesetRecordApplier.prototype, "apply", "apply");
timeAsync(NodeSetLoader.prototype, "terminate", "terminate");

const images = [];
for (const f of files) images.push(await nodesetToImage(new Uint8Array(fs.readFileSync(f))));
for (const im of images) image_module.releaseInflatedImageLines(im);

const wall = [];
const inflate = [];
const apply = [];
const terminate = [];
let nodes = 0;
for (let run = 0; run < runs; run++) {
    phases.inflate = 0;
    phases.decode = 0;
    phases.apply = 0;
    phases.terminate = 0;
    calls.inflate = 0;
    const addressSpace = AddressSpace.create();
    const t0 = performance.now();
    await generateAddressSpaceRaw(addressSpace, images, {});
    const dt = performance.now() - t0;
    wall.push(dt);
    inflate.push(phases.inflate);
    apply.push(phases.apply);
    terminate.push(phases.terminate);
    if (run === runs - 1) {
        nodes = 0;
        for (const namespace of addressSpace.getNamespaceArray()) {
            for (const _node of namespace.nodeIterator()) nodes += 1;
        }
        console.log(`calls: inflate=${calls.inflate}`);
    }
    addressSpace.dispose();
    for (const im of images) image_module.releaseInflatedImageLines(im);
    if (!quiet) {
        console.log(
            `  run ${String(run + 1).padStart(2)}: total ${dt.toFixed(1)} inflate ${phases.inflate.toFixed(1)} ` +
                `apply ${phases.apply.toFixed(1)} terminate ${phases.terminate.toFixed(1)}`
        );
    }
}
const min = (s) => Math.min(...s.slice(1));
console.log(
    `[image] nodes=${nodes} runs=${runs} min-of-run: total=${min(wall).toFixed(1)}ms ` +
        `inflate=${min(inflate).toFixed(1)}ms apply=${min(apply).toFixed(1)}ms terminate=${min(terminate).toFixed(1)}ms`
);
