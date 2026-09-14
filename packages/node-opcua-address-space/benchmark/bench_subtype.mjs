/**
 * What the DataType definition path costs during a load, counted rather than timed.
 *
 *     node benchmark/bench_subtype.mjs
 *
 * `_getDefinition` answers three questions — is this an Enumeration, a Structure, a Union — and
 * each one walks the subtype chain. For a DataType that is neither, nothing is cached, so the
 * answer is recomputed on every call for the life of the address space. Read `findDataType` and
 * `allReferences` against the node count (5923 nodes, 20754 references for standard + DI): a
 * count that is a large multiple of that is repeated work.
 */
import { nodesets } from "node-opcua-nodesets";
import { AddressSpace } from "../dist/api/index.js";
import { generateAddressSpace } from "../nodeJS.js";
import { AddressSpaceImpl } from "../dist/impl/address_space.js";
import { BaseNodeImpl } from "../dist/impl/base_node_impl.js";
import { UADataTypeImpl } from "../dist/impl/ua_data_type_impl.js";

const counters = Object.create(null);
function count(proto, name) {
    counters[name] = 0;
    const desc = Object.getOwnPropertyDescriptor(proto, name);
    if (!desc || !desc.value) {
        console.log(`  (no such method: ${name})`);
        return;
    }
    const original = desc.value;
    Object.defineProperty(proto, name, {
        ...desc,
        value: function (...args) {
            counters[name] += 1;
            return original.apply(this, args);
        }
    });
}

count(AddressSpaceImpl.prototype, "findDataType");
count(BaseNodeImpl.prototype, "allReferences");
count(UADataTypeImpl.prototype, "_getDefinition");
count(UADataTypeImpl.prototype, "isStructure");
count(UADataTypeImpl.prototype, "isSubtypeOf");

const files = [nodesets.standard, nodesets.di];
const addressSpace = AddressSpace.create();
const t0 = process.hrtime.bigint();
await generateAddressSpace(addressSpace, files);
const t1 = process.hrtime.bigint();

let nodes = 0;
for (let i = 0; i < addressSpace.getNamespaceArray().length; i++) {
    for (const _ of addressSpace.getNamespace(i).nodeIterator()) nodes++;
}

console.log(`load                 : ${Number(t1 - t0) / 1e6} ms for ${nodes} nodes`);
for (const [k, v] of Object.entries(counters)) {
    console.log(`${k.padEnd(21)}: ${v}`);
}

// and the steady-state cost: asking the same question again on a finished address space
const dt = addressSpace.findDataType("Double");
const before = counters.allReferences;
for (let i = 0; i < 1000; i++) dt.isStructure();
console.log(`allReferences for 1000 isStructure("Double") on a finished space: ${counters.allReferences - before}`);

addressSpace.dispose();
