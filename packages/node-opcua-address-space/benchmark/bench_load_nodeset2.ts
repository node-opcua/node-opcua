/**
 * Where does a NodeSet2 load spend its time?
 *
 * Run from packages/node-opcua-address-space after `pnpm run build`:
 *
 *     node --expose-gc --import tsx benchmark/bench_load_nodeset2.ts            # both scenarios, 5 runs, 20000 names
 *     node --expose-gc --import tsx benchmark/bench_load_nodeset2.ts load 7     # cold loads only, 7 runs
 *     node --expose-gc --import tsx benchmark/bench_load_nodeset2.ts unique 50000
 *
 * Scenario `load` loads the standard nodeset alone and a six-file companion chain, each N times in a fresh
 * address space, and prints the best run: total, XML parse (`Xml2Json.parseString`), terminate
 * (`NodeSetLoader.terminate`, i.e. back references, values, datatypes, promotion), back-reference propagation,
 * the number of `findReferencesEx` calls and the heap retained by the address space.
 *
 * Scenario `unique` reproduces packages/playground/issue_1440_large_nodeset.ts: N variables with unique browse
 * names added to one folder at runtime, with and without `isFrugal`. It also reports the number of own
 * properties on `BaseNodeImpl.prototype` before and after, which must not move: shared child accessors are
 * only defined for names seen while a nodeset loads.
 *
 * The best of N is reported rather than the mean: on a busy machine the distribution is bimodal and the
 * minimum is the estimate of the intrinsic cost.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { nodesets } from "node-opcua-nodesets";
import { DataType, Variant } from "node-opcua-variant";
import { Xml2Json } from "node-opcua-xml2json";
import { AddressSpace, generateAddressSpaceRaw, type IAddressSpace } from "../dist/api/index.js";
import { NodeSetLoader } from "../dist/api/loader/load_nodeset2.js";
import { BaseNodeImpl } from "../dist/impl/base_node_impl.js";

const counters = { parse: 0, terminate: 0, backRefs: 0, findReferencesEx: 0 };

type AnyMethod = (this: unknown, ...args: unknown[]) => unknown;
type Patchable = Record<string, AnyMethod>;

function timeSync(proto: object, name: string, bucket: "parse" | "backRefs") {
    const target = proto as Patchable;
    const original = target[name];
    target[name] = function (this: unknown, ...args: unknown[]) {
        const t0 = performance.now();
        try {
            return original.apply(this, args);
        } finally {
            counters[bucket] += performance.now() - t0;
        }
    };
}
function timeAsync(proto: object, name: string, bucket: "terminate") {
    const target = proto as Patchable;
    const original = target[name];
    target[name] = async function (this: unknown, ...args: unknown[]) {
        const t0 = performance.now();
        try {
            return await original.apply(this, args);
        } finally {
            counters[bucket] += performance.now() - t0;
        }
    };
}
function count(proto: object, name: string) {
    const target = proto as Patchable;
    const original = target[name];
    target[name] = function (this: unknown, ...args: unknown[]) {
        counters.findReferencesEx += 1;
        return original.apply(this, args);
    };
}

timeSync(Xml2Json.prototype, "parseString", "parse");
timeAsync(NodeSetLoader.prototype, "terminate", "terminate");
timeSync(BaseNodeImpl.prototype, "propagate_back_references", "backRefs");
if ("propagate_back_references_declared_from_both_ends" in BaseNodeImpl.prototype) {
    // the loader calls this variant; a tree built before it existed only has the method above
    timeSync(BaseNodeImpl.prototype, "propagate_back_references_declared_from_both_ends", "backRefs");
}
count(BaseNodeImpl.prototype, "findReferencesEx");

const gc: (() => void) | undefined = (globalThis as { gc?: () => void }).gc;
const heapUsed = () => {
    gc?.();
    return process.memoryUsage().heapUsed;
};
const seconds = (ms: number) => `${(ms / 1000).toFixed(3)}s`;
const megabytes = (bytes: number) => `${(bytes / 1048576).toFixed(1)}MB`;

interface LoadSample {
    total: number;
    parse: number;
    terminate: number;
    backRefs: number;
    findReferencesEx: number;
    heap: number;
    nodes: number;
}

async function loadOnce(files: string[]): Promise<LoadSample> {
    for (const key of Object.keys(counters) as (keyof typeof counters)[]) {
        counters[key] = 0;
    }
    const addressSpace = AddressSpace.create();
    const heap0 = heapUsed();
    const t0 = performance.now();
    await generateAddressSpaceRaw(addressSpace, files, (f) => fs.promises.readFile(f, "utf-8"), {});
    const total = performance.now() - t0;
    const heap1 = heapUsed();
    let nodes = 0;
    for (const namespace of addressSpace.getNamespaceArray()) {
        for (const _node of namespace.nodeIterator()) {
            nodes += 1;
        }
    }
    const sample: LoadSample = { ...counters, total, heap: heap1 - heap0, nodes };
    addressSpace.dispose();
    return sample;
}

const scenarios: Record<string, (keyof typeof nodesets)[]> = {
    standard: ["standard"],
    chain: ["standard", "di", "ia", "machinery", "amb", "lads"]
};

async function benchLoad(runs: number) {
    for (const [label, names] of Object.entries(scenarios)) {
        const files = names.map((name) => nodesets[name]);
        let best: LoadSample | undefined;
        for (let run = 0; run < runs; run++) {
            const sample = await loadOnce(files);
            console.log(`  ${label.padEnd(9)} run ${run + 1}: total=${seconds(sample.total)} parse=${seconds(sample.parse)}`);
            if (!best || sample.total < best.total) {
                best = sample;
            }
        }
        if (!best) continue;
        const rest = best.total - best.parse - best.terminate;
        console.log(
            `${label.padEnd(9)} best of ${runs}: nodes=${best.nodes} total=${seconds(best.total)} ` +
                `parse=${seconds(best.parse)} terminate=${seconds(best.terminate)} ` +
                `(backRefs=${seconds(best.backRefs)}) other=${seconds(rest)} ` +
                `findReferencesEx=${best.findReferencesEx} heap=${gc ? megabytes(best.heap) : "n/a (run with --expose-gc)"}`
        );
    }
}

/**
 * each mode in a process of its own: run second in the same process, a scenario inherits the
 * object shapes the first one warmed up and reports a heap 12MB smaller than it would on its own
 */
function benchUniqueNames(countOfNodes: number) {
    for (const frugal of [false, true]) {
        const result = spawnSync(
            process.execPath,
            [...process.execArgv, process.argv[1], "unique-one", String(countOfNodes), frugal ? "1" : "0"],
            {
                encoding: "utf-8"
            }
        );
        process.stdout.write(result.stdout);
        if (result.status !== 0) {
            process.stderr.write(result.stderr);
        }
    }
}

async function benchUniqueNamesOne(countOfNodes: number, frugal: boolean) {
    {
        const addressSpace = AddressSpace.create();
        await generateAddressSpaceRaw(addressSpace, [nodesets.standard], (f) => fs.promises.readFile(f, "utf-8"), {});
        addressSpace.isFrugal = frugal;
        const namespace = addressSpace.registerNamespace("urn:bench");
        const folder = namespace.addObject({ browseName: "TestPoint", organizedBy: addressSpace.rootFolder.objects });
        const protoBefore = Object.getOwnPropertyNames(BaseNodeImpl.prototype).length;
        const heap0 = heapUsed();
        const t0 = performance.now();
        (addressSpace as IAddressSpace & { modelChangeTransaction(func: () => void): void }).modelChangeTransaction(() => {
            for (let i = 0; i < countOfNodes; i++) {
                namespace.addVariable({
                    componentOf: folder,
                    browseName: `point_${i}`,
                    dataType: "Double",
                    value: new Variant({ dataType: DataType.Double, value: 1000.0 })
                });
            }
        });
        const elapsed = performance.now() - t0;
        const heap1 = heapUsed();
        const protoAfter = Object.getOwnPropertyNames(BaseNodeImpl.prototype).length;
        const last = folder.getChildByName(`point_${countOfNodes - 1}`);
        console.log(
            `unique   ${countOfNodes} variables isFrugal=${frugal}: ${seconds(elapsed)} ` +
                `(${((elapsed * 1000) / countOfNodes).toFixed(1)}us per node) heap=${gc ? megabytes(heap1 - heap0) : "n/a"} ` +
                `prototype props ${protoBefore} -> ${protoAfter} last child ${last ? "found" : "MISSING"}`
        );
        addressSpace.dispose();
    }
}

async function main() {
    // load [runs]  |  unique [count]  |  all [runs] [count]
    const scenario = process.argv[2] || "all";
    if (scenario === "unique-one") {
        await benchUniqueNamesOne(Number.parseInt(process.argv[3], 10), process.argv[4] === "1");
        return;
    }
    const runs = Number.parseInt(process.argv[3] || "", 10);
    const count = Number.parseInt((scenario === "unique" ? process.argv[3] : process.argv[4]) || "", 10);
    if (scenario === "load" || scenario === "all") {
        await benchLoad(Number.isFinite(runs) ? runs : 5);
    }
    if (scenario === "unique" || scenario === "all") {
        benchUniqueNames(Number.isFinite(count) ? count : 20000);
    }
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
