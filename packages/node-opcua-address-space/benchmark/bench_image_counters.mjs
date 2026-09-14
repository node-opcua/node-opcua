/**
 * How much decode work a full image load actually does, counted rather than timed: the number of
 * JSON.parse calls, of inflates, and of NodeId/QualifiedName allocations. A count is exact and
 * does not move with the machine, so it is how a second pass over the image would show up.
 *
 *     node benchmark/bench_image_counters.mjs
 *
 * Read the counts against the size of what is being replayed: 5929 image lines, 5923 nodes and
 * 18798 references for standard + DI.
 */
import fs from "node:fs";
import { nodesets } from "node-opcua-nodesets";
import { AddressSpace, generateAddressSpaceRaw, nodesetToImage, setImageInflater } from "../dist/api/index.js";
import { releaseInflatedImageLines } from "../dist/api/loader/nodeset_image.js";
import "../distNodeJS/index.js";

const counters = { "JSON.parse": 0, "JSON.parse bytes": 0, inflate: 0, "inflate bytes": 0, "String.split": 0 };

const originalParse = JSON.parse;
JSON.parse = function (text, ...rest) {
    counters["JSON.parse"] += 1;
    if (typeof text === "string") counters["JSON.parse bytes"] += text.length;
    return originalParse.call(this, text, ...rest);
};
const originalSplit = String.prototype.split;
// biome-ignore lint/complexity/useArrowFunction: needs `this`
String.prototype.split = function (...args) {
    if (this.length > 4096) counters["String.split"] += 1;
    return originalSplit.apply(this, args);
};
const inner = setImageInflater(async (image) => {
    counters.inflate += 1;
    counters["inflate bytes"] += image.length;
    return inner(image);
});

const files = (process.env.BENCH_NODESETS || "standard,di").split(",").map((n) => nodesets[n]);
const images = [];
for (const f of files) images.push(await nodesetToImage(new Uint8Array(fs.readFileSync(f))));
for (const im of images) releaseInflatedImageLines(im);

for (const key of Object.keys(counters)) counters[key] = 0;

const addressSpace = AddressSpace.create();
await generateAddressSpaceRaw(addressSpace, images, {});
let nodes = 0;
for (const namespace of addressSpace.getNamespaceArray()) {
    for (const _node of namespace.nodeIterator()) nodes += 1;
}
addressSpace.dispose();

console.log(`images=${images.length} nodes=${nodes}`);
for (const [name, value] of Object.entries(counters)) {
    console.log(`${String(value).padStart(10)}  ${name}`);
}
