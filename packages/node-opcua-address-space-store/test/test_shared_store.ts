import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { BinaryStream } from "node-opcua-binary-stream";
import { LocalizedText, NodeClass } from "node-opcua-data-model";
import { NodeId, NodeIdType } from "node-opcua-nodeid";
import { DataType, decodeVariant, VariantArrayType } from "node-opcua-variant";
import should from "should";
import { CompactStore, NO_NODE, SharedReadStatus, SharedStoreReader, type SharedValue, ValueKind } from "../source/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const numeric = (i: number) => new NodeId(NodeIdType.NUMERIC, i, 1);
const fresh = (): SharedValue => ({
    dataType: 0,
    value: 0,
    kind: ValueKind.None,
    statusCode: 0,
    sourceTimestamp: 0,
    sourcePicoseconds: 0,
    serverTimestamp: 0,
    serverPicoseconds: 0,
    version: 0,
    encoded: null
});
const decoded = (out: SharedValue) => decodeVariant(new BinaryStream(Buffer.from(out.encoded ?? new Uint8Array())));

function build(nodes: number): CompactStore {
    const store = new CompactStore({ expectedNodes: nodes, shared: true });
    for (let i = 0; i < nodes; i++) {
        const index = store.addNode({
            nodeId: numeric(1000 + i),
            nodeClass: NodeClass.Variable,
            browseName: `V${i}`,
            browseNameNamespace: 1,
            accessLevel: 3
        });
        store.values.setScalar(index, DataType.Double, i, 0, 1000, 2000);
    }
    return store;
}

describe("shared store: the columns of a store read from another thread", function () {
    this.timeout(30000);

    it("refuses to share a store that was not created shared", () => {
        should(() => new CompactStore({ expectedNodes: 16 }).shareForReaders()).throw(/shared: true/);
    });

    it("finds nodes and reads values through the shared buffers", () => {
        const store = build(1000);
        store.addNode({
            nodeId: new NodeId(NodeIdType.STRING, "Plant.Speed", 1),
            nodeClass: NodeClass.Variable,
            browseName: "Speed",
            browseNameNamespace: 1,
            accessLevel: 1
        });
        const reader = new SharedStoreReader(store.shareForReaders());
        const out = fresh();
        const i = reader.find(numeric(1500));
        should(i).eql(store.find(numeric(1500)));
        should(reader.readValue(i, out)).eql(SharedReadStatus.Good);
        should(out.value).eql(500);
        should(out.dataType).eql(DataType.Double);
        should(out.sourceTimestamp).eql(1000);
        should(out.serverTimestamp).eql(2000);
        should(reader.find(numeric(99999))).eql(NO_NODE);
        should(reader.readValue(NO_NODE, out)).eql(SharedReadStatus.NotFound);
        const speed = reader.find(new NodeId(NodeIdType.STRING, "Plant.Speed", 1));
        should(speed).eql(store.find(new NodeId(NodeIdType.STRING, "Plant.Speed", 1)));
        should(reader.readValue(speed, out)).eql(SharedReadStatus.NotShared, "no value yet: the owner answers");
        // a value the owner writes is seen at once
        store.values.setScalar(i, DataType.Double, 42, 0, 3000, 4000);
        reader.readValue(i, out);
        should(out.value).eql(42);
        // an object value stays with the owner
        // a string: its binary encoding, from the shared heap
        store.values.setObject(i, DataType.String, { dataType: DataType.String, value: "x" }, 0, 1, 1);
        should(reader.readValue(i, out)).eql(SharedReadStatus.Good);
        should(decoded(out).value).eql("x");
    });

    it("answers NotReadable for an unreadable node and NotFound for a deleted one", () => {
        const store = build(10);
        const writeOnly = store.addNode({
            nodeId: numeric(5000),
            nodeClass: NodeClass.Variable,
            browseName: "W",
            browseNameNamespace: 1,
            accessLevel: 2
        });
        const object = store.addNode({
            nodeId: numeric(5001),
            nodeClass: NodeClass.Object,
            browseName: "O",
            browseNameNamespace: 1
        });
        const reader = new SharedStoreReader(store.shareForReaders());
        const out = fresh();
        should(reader.readValue(writeOnly, out)).eql(SharedReadStatus.NotReadable);
        should(reader.readValue(object, out)).eql(SharedReadStatus.NotReadable);
        const i = store.find(numeric(1003));
        store.deleteNode(i);
        should(reader.readValue(i, out)).eql(SharedReadStatus.NotFound);
        should(reader.find(numeric(1003))).eql(NO_NODE);
    });

    it("tells a reader its buffers went stale when the owner grows a column", () => {
        const store = build(16);
        const reader = new SharedStoreReader(store.shareForReaders());
        should(reader.isCurrent()).eql(true);
        for (let i = 0; i < 100; i++) {
            store.addNode({
                nodeId: numeric(9000 + i),
                nodeClass: NodeClass.Variable,
                browseName: `G${i}`,
                browseNameNamespace: 1,
                accessLevel: 1
            });
        }
        should(reader.isCurrent()).eql(false);
        const again = new SharedStoreReader(store.shareForReaders());
        should(again.isCurrent()).eql(true);
        should(again.find(numeric(9099))).eql(store.find(numeric(9099)));
    });

    it("reads consistent values from a worker thread while the owner writes", async () => {
        const nodes = 10000;
        const store = build(nodes);
        const index = Array.from({ length: nodes }, (_, i) => store.find(numeric(1000 + i)));
        const dist = pathToFileURL(path.join(here, "../dist/index.js")).href;
        // the worker checks that every value it reads matches its own timestamps: the owner writes
        // value v with both timestamps set to v, so a torn read shows as a mismatch
        const code = `
            const { workerData, parentPort } = require("node:worker_threads");
            import(workerData.dist).then(({ SharedStoreReader, SharedReadStatus }) => {
                const reader = new SharedStoreReader(workerData.descriptor);
                const out = {};
                let reads = 0, torn = 0;
                const stop = Date.now() + 500;
                while (Date.now() < stop) {
                    for (const i of workerData.index) {
                        if (reader.readValue(i, out) === SharedReadStatus.Good) {
                            reads++;
                            if (out.value !== out.sourceTimestamp || out.value !== out.serverTimestamp) torn++;
                        }
                    }
                }
                parentPort.postMessage({ reads, torn });
            });`;
        for (const i of index) store.values.setScalar(i, DataType.Double, 1, 0, 1, 1);
        const worker = new Worker(code, { eval: true, workerData: { dist, descriptor: store.shareForReaders(), index } });
        const result = new Promise<{ reads: number; torn: number }>((resolve, reject) => {
            worker.on("message", resolve);
            worker.on("error", reject);
        });
        let v = 1;
        const writing = setInterval(() => {
            for (let n = 0; n < 2000; n++) {
                v++;
                store.values.setScalar(index[v % nodes], DataType.Double, v, 0, v, v);
            }
        }, 1);
        const { reads, torn } = await result;
        clearInterval(writing);
        await worker.terminate();
        should(reads).be.above(10000);
        should(torn).eql(0);
    });

    it("reads strings and arrays as their binary encoding, and leaves a structure to the owner", () => {
        const store = build(3);
        const [text, array, structure] = [0, 1, 2].map((k) => store.find(numeric(1000 + k)));
        store.values.setObject(text, DataType.String, { dataType: DataType.String, value: "pump" }, 0, 10, 20);
        store.values.setObject(
            array,
            DataType.Int32,
            { dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: new Int32Array([1, 2, 3]) },
            0,
            10,
            20
        );
        store.values.setObject(structure, DataType.ExtensionObject, { dataType: DataType.ExtensionObject, value: {} }, 0, 10, 20);
        const reader = new SharedStoreReader(store.shareForReaders());
        const out = fresh();
        should(reader.canServe(text)).eql(true);
        should(reader.readValue(text, out)).eql(SharedReadStatus.Good);
        should(decoded(out).value).eql("pump");
        should(out.sourceTimestamp).eql(10);
        should(reader.readValue(array, out)).eql(SharedReadStatus.Good);
        should([...(decoded(out).value as Int32Array)]).eql([1, 2, 3]);
        should(reader.canServe(structure)).eql(false);
        should(reader.readValue(structure, out)).eql(SharedReadStatus.NotShared);
        // a number again: no bytes left behind
        store.values.setScalar(text, DataType.Double, 4, 0, 30, 40);
        should(reader.readValue(text, out)).eql(SharedReadStatus.Good);
        should(out.encoded).eql(null);
        should(out.value).eql(4);
    });

    it("compacts the heap into new buffers: a reader holding the old ones leaves the strings to the owner", () => {
        const nodes = 50;
        const store = build(nodes);
        const index = Array.from({ length: nodes }, (_, k) => store.find(numeric(1000 + k)));
        const set = (k: number, text: string) =>
            store.values.setObject(index[k], DataType.String, { dataType: DataType.String, value: text }, 0, k, k);
        for (let k = 0; k < nodes; k++) set(k, "a");
        const before = new SharedStoreReader(store.shareForReaders());
        // longer and longer: every write takes a new slot, the garbage fills the heap
        let generation = 0;
        while (before.isCurrent()) {
            generation++;
            for (let k = 0; k < nodes; k++) set(k, "x".repeat(generation * 10));
            if (generation > 1000) throw new Error("the heap never compacted");
        }
        const out = fresh();
        // its bytes would be older than the timestamps it reads with them
        should(before.readValue(index[7], out)).eql(SharedReadStatus.NotShared);
        const after = new SharedStoreReader(store.shareForReaders());
        should(after.readValue(index[7], out)).eql(SharedReadStatus.Good);
        should(decoded(out).value).eql("x".repeat(generation * 10));
        should(store.values.heapSize).be.below(nodes * generation * 10 * 4);
        // a LocalizedText too
        store.values.setObject(
            index[1],
            DataType.LocalizedText,
            { dataType: DataType.LocalizedText, value: new LocalizedText({ text: "hello", locale: "en" }) },
            0,
            1,
            1
        );
        const latest = new SharedStoreReader(store.shareForReaders());
        should(latest.readValue(index[1], out)).eql(SharedReadStatus.Good);
        should((decoded(out).value as LocalizedText).text).eql("hello");
    });

    it("reads whole strings from a worker thread while the owner rewrites them, slots moving and the heap compacted", async () => {
        const nodes = 200;
        const store = build(nodes);
        const index = Array.from({ length: nodes }, (_, i) => store.find(numeric(1000 + i)));
        const dist = pathToFileURL(path.join(here, "../dist/index.js")).href;
        const variant = import.meta.resolve("node-opcua-variant");
        const stream = import.meta.resolve("node-opcua-binary-stream");
        // the owner writes "v<n>:" padded to a length that depends on n, with both timestamps n:
        // a torn read shows as a string that does not match its timestamp
        const code = `
            const { workerData, parentPort } = require("node:worker_threads");
            Promise.all([import(workerData.dist), import(workerData.variant), import(workerData.stream)]).then(
                async ([{ SharedStoreReader, SharedReadStatus }, { decodeVariant }, { BinaryStream }]) => {
                    let reader = new SharedStoreReader(workerData.descriptor);
                    parentPort.on("message", (descriptor) => { reader = new SharedStoreReader(descriptor); });
                    const out = {};
                    let reads = 0, torn = 0, stale = 0, refused = 0;
                    const stop = Date.now() + 500;
                    while (Date.now() < stop) {
                        await new Promise((resolve) => setImmediate(resolve));
                        if (!reader.isCurrent()) stale++;
                        for (const i of workerData.index) {
                            const status = reader.readValue(i, out);
                            if (status === SharedReadStatus.NotShared) { refused++; continue; }
                            if (status !== SharedReadStatus.Good || !out.encoded) continue;
                            reads++;
                            const text = decodeVariant(new BinaryStream(Buffer.from(out.encoded))).value;
                            const n = out.sourceTimestamp;
                            if (!text.startsWith("v" + n + ":") || text.length !== 8 + (n % 97)) torn++;
                        }
                    }
                    parentPort.postMessage({ reads, torn, stale, refused });
                });`;
        const text = (n: number) => `v${n}:`.padEnd(8 + (n % 97), "#");
        for (let k = 0; k < nodes; k++) {
            store.values.setObject(index[k], DataType.String, { dataType: DataType.String, value: text(1) }, 0, 1, 1);
        }
        const worker = new Worker(code, {
            eval: true,
            workerData: { dist, variant, stream, descriptor: store.shareForReaders(), index }
        });
        const result = new Promise<{ reads: number; torn: number; stale: number; refused: number }>((resolve, reject) => {
            worker.on("message", resolve);
            worker.on("error", reject);
        });
        let v = 1;
        let layout = Atomics.load(store.space.layout, 0);
        const writing = setInterval(() => {
            for (let n = 0; n < 1000; n++) {
                v++;
                store.values.setObject(index[v % nodes], DataType.String, { dataType: DataType.String, value: text(v) }, 0, v, v);
            }
            // the new buffers to the reader, as the engine sends them to the fronts
            if (Atomics.load(store.space.layout, 0) !== layout) {
                layout = Atomics.load(store.space.layout, 0);
                worker.postMessage(store.shareForReaders());
            }
        }, 1);
        const { reads, torn, stale, refused } = await result;
        clearInterval(writing);
        await worker.terminate();
        should(reads).be.above(1000);
        should(torn).eql(0);
        // the heap was compacted while the worker read: from then on, the owner answers
        should(stale).be.above(0);
        should(refused).be.above(0);
    });
});
