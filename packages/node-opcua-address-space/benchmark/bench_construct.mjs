/**
 * Focused construction benchmark, plain ESM so that no TypeScript loader pollutes a CPU profile.
 *
 *     node benchmark/bench_construct.mjs [runs] [mode]
 *
 * mode is `string` (default, the XML read as one utf-8 string) or `image` (the .ndjson.gz image).
 *
 * The phases are timed inside the real load rather than replayed on their own: a synthetic phase
 * keeps its intermediate results alive and pays a GC cost the real load never pays, which made a
 * replayed "produce the records" phase read 1.6x the whole load.
 *
 *   parse      Xml2Json.write: the SAX tokenizer, the reader states, and the records they build
 *   apply      NodesetRecordApplier.apply: the records turned into nodes and references
 *   terminate  NodeSetLoader.terminate: back references, values, data types, promotion
 *
 * Wall time on a busy machine swings by 20%, so every figure reported is the minimum over the
 * runs (the first dropped as the JIT warm-up): the minimum is the estimate of the intrinsic cost.
 */
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { nodesets } from "node-opcua-nodesets";
import { Xml2Json } from "node-opcua-xml2json";
import { AddressSpace, generateAddressSpaceRaw, nodesetToImage } from "../dist/api/index.js";
import { NodeSetLoader } from "../dist/api/loader/load_nodeset2.js";
import { NodesetRecordApplier } from "../dist/api/loader/nodeset_record_applier.js";

const runs = Number.parseInt(process.argv[2] || "", 10) || 12;
const mode = process.argv[3] || "string";
const quiet = process.env.BENCH_QUIET === "1";
const names = (process.env.BENCH_NODESETS || "standard,di").split(",");
const files = names.map((n) => nodesets[n]);

const phases = { parse: 0, apply: 0, terminate: 0 };
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
timeSync(Xml2Json.prototype, "write", "parse");
timeSync(NodesetRecordApplier.prototype, "apply", "apply");
timeAsync(NodeSetLoader.prototype, "terminate", "terminate");

const images = [];
if (mode === "image") {
    for (const f of files) images.push(await nodesetToImage(new Uint8Array(fs.readFileSync(f))));
}

const wall = [];
const parse = [];
const apply = [];
const terminate = [];
let nodes = 0;
let refs = 0;
for (let run = 0; run < runs; run++) {
    phases.parse = 0;
    phases.apply = 0;
    phases.terminate = 0;
    const addressSpace = AddressSpace.create();
    const t0 = performance.now();
    if (mode === "image") {
        await generateAddressSpaceRaw(addressSpace, images, {});
    } else if (mode === "store") {
        // the way a language server would use it: the XML is the source of truth, the loader keeps
        // the image of every document it parses and replays it on the next load
        await generateAddressSpaceRaw(addressSpace, files, (f) => fs.promises.readFile(f, "utf-8"), { imageStore: true });
    } else {
        await generateAddressSpaceRaw(addressSpace, files, (f) => fs.promises.readFile(f, "utf-8"), {});
    }
    const dt = performance.now() - t0;
    wall.push(dt);
    parse.push(phases.parse);
    apply.push(phases.apply);
    terminate.push(phases.terminate);
    if (run === runs - 1) {
        nodes = 0;
        refs = 0;
        for (const namespace of addressSpace.getNamespaceArray()) {
            for (const node of namespace.nodeIterator()) {
                nodes += 1;
                refs += node.ownReferences().length;
            }
        }
    }
    addressSpace.dispose();
    if (!quiet) {
        console.log(
            `  run ${String(run + 1).padStart(2)}: total ${dt.toFixed(1)}  parse ${phases.parse.toFixed(1)}  ` +
                `apply ${phases.apply.toFixed(1)}  terminate ${phases.terminate.toFixed(1)}`
        );
    }
}
const min = (s) => Math.min(...s.slice(1));
console.log(
    `[${mode}] nodes=${nodes} refs=${refs} runs=${runs} min-of-run: ` +
        `total=${min(wall).toFixed(1)}ms parse=${min(parse).toFixed(1)}ms ` +
        `apply=${min(apply).toFixed(1)}ms terminate=${min(terminate).toFixed(1)}ms`
);
