/**
 * How much work a load does, counted rather than timed: the number of calls to the operations a
 * construction repeats. A count is exact and does not move with the machine, so it is the way to
 * show that an optimisation removed work — the clock on a busy laptop cannot resolve 2%.
 *
 *     node benchmark/bench_counters.mjs
 *
 * Read the counts against the size of what is being built: 5923 nodes and 20754 references for
 * standard + DI. A count that is a large multiple of those is repeated work worth looking at.
 */
import fs from "node:fs";
import { nodesets } from "node-opcua-nodesets";
import { AddressSpace, generateAddressSpaceRaw } from "../dist/api/index.js";
import { BaseNodeImpl } from "../dist/impl/base_node_impl.js";
import { AddressSpaceImpl } from "../dist/impl/address_space.js";
import { UAVariableImpl } from "../dist/impl/ua_variable_impl.js";
import { UAObjectImpl } from "../dist/impl/ua_object_impl.js";
import { NamespaceImpl } from "../dist/impl/namespace_impl.js";

const counters = Object.create(null);
function count(proto, name, label) {
    const key = label || name;
    counters[key] = 0;
    const desc = Object.getOwnPropertyDescriptor(proto, name);
    if (!desc) {
        console.log(`  (no such member: ${key})`);
        return;
    }
    if (desc.get) {
        const original = desc.get;
        Object.defineProperty(proto, name, {
            ...desc,
            get() {
                counters[key] += 1;
                return original.call(this);
            }
        });
        return;
    }
    const original = desc.value;
    proto[name] = function (...args) {
        counters[key] += 1;
        return original.apply(this, args);
    };
}

for (const name of [
    "findReferences",
    "findReferencesEx",
    "findReferencesAsObject",
    "findReferencesExAsObject",
    "_clear_caches",
    "__addReference",
    "getChildByName",
    "getNotifiers",
    "getEventSources",
    "propagate_back_references",
    "install_extra_properties",
    "_coerceReferenceType"
]) {
    count(BaseNodeImpl.prototype, name);
}
count(UAObjectImpl.prototype, "eventNotifier", "get eventNotifier");
count(UAVariableImpl.prototype, "dataTypeObj", "get dataTypeObj");
count(AddressSpaceImpl.prototype, "findNode", "addressSpace.findNode");
count(AddressSpaceImpl.prototype, "findReferenceType", "addressSpace.findReferenceType");
count(NamespaceImpl.prototype, "internalCreateNode", "namespace.internalCreateNode");

const addressSpace = AddressSpace.create();
await generateAddressSpaceRaw(
    addressSpace,
    (process.env.BENCH_NODESETS || "standard,di").split(",").map((n) => nodesets[n]),
    (f) => fs.promises.readFile(f, "utf-8"),
    {}
);
let nodes = 0;
let refs = 0;
for (const namespace of addressSpace.getNamespaceArray()) {
    for (const node of namespace.nodeIterator()) {
        nodes += 1;
        refs += node.ownReferences().length;
    }
}
console.log(`nodes=${nodes} references=${refs}`);
for (const [name, value] of Object.entries(counters).sort((a, b) => b[1] - a[1])) {
    console.log(`${String(value).padStart(9)}  ${(value / nodes).toFixed(1).padStart(7)} per node  ${name}`);
}
addressSpace.dispose();
