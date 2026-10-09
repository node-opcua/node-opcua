import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { BinaryStream } from "node-opcua-binary-stream";
import { LocalizedText, NodeClass } from "node-opcua-data-model";
import { NodeId, NodeIdType } from "node-opcua-nodeid";
import { DataType, decodeVariant, VariantArrayType } from "node-opcua-variant";
import should from "should";
import {
    ACCEPTED_TYPES_KNOWN,
    CompactStore,
    claimValue,
    NO_NODE,
    releaseClaim,
    SharedReadStatus,
    SharedStoreReader,
    type SharedValue,
    ValueKind
} from "../source/index.js";

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

/** a scalar String or ByteString Variant as its binary encoding: the encoding byte, the length, the bytes */
function encodedScalar(dataType: DataType, bytes: Uint8Array): Uint8Array {
    const out = new Uint8Array(5 + bytes.length);
    out[0] = dataType;
    new DataView(out.buffer).setInt32(1, bytes.length, true);
    out.set(bytes, 5);
    return out;
}
const encodedString = (text: string) => encodedScalar(DataType.String, Buffer.from(text, "utf8"));

/** a store whose Variables hold strings, kept as bytes in the shared heap */
function buildStrings(nodes: number, text = "abc"): CompactStore {
    const store = new CompactStore({ expectedNodes: nodes, shared: true });
    for (let i = 0; i < nodes; i++) {
        const index = store.addNode({
            nodeId: numeric(1000 + i),
            nodeClass: NodeClass.Variable,
            browseName: `S${i}`,
            browseNameNamespace: 1,
            accessLevel: 3
        });
        store.values.setObject(index, DataType.String, { dataType: DataType.String, value: text }, 0, 1000, 2000);
    }
    return store;
}

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

    it("tells another thread what a Variable's DataType accepts, and whether it is historized", () => {
        const store = build(2);
        const dataType = store.addNode({
            nodeId: numeric(5000),
            nodeClass: NodeClass.DataType,
            browseName: "SomeDouble",
            browseNameNamespace: 1
        });
        const variable = store.addNode({
            nodeId: numeric(5001),
            nodeClass: NodeClass.Variable,
            browseName: "V",
            browseNameNamespace: 1,
            accessLevel: 3,
            dataType
        });
        const reader = new SharedStoreReader(store.shareForReaders());
        // nothing worked out yet: this thread cannot tell, so it says no
        should(reader.acceptsForWrite(variable, DataType.Double)).eql(false);
        store.nodes.setAcceptedTypes(dataType, (ACCEPTED_TYPES_KNOWN | (1 << DataType.Double)) >>> 0);
        should(reader.acceptsForWrite(variable, DataType.Double)).eql(true);
        should(reader.acceptsForWrite(variable, DataType.String)).eql(false);
        should(reader.acceptsForWrite(variable, DataType.Null)).eql(false);
        should(reader.isHistorized(variable)).eql(false);
        store.nodes.setHistorizing(variable, true);
        should(reader.isHistorized(variable)).eql(true);
    });

    it("makes a write wait while another thread holds the value, so that two writers never interleave", async () => {
        const store = build(4);
        const i = store.find(numeric(1000));
        const descriptor = store.shareForReaders();
        // the worker claims the value as a writer does (even to odd), holds it 150 ms, then releases it
        const code = `
            const { workerData, parentPort } = require("node:worker_threads");
            const version = new Uint32Array(workerData.version);
            const held = Atomics.load(version, workerData.i);
            if (Atomics.compareExchange(version, workerData.i, held, held + 1) !== held) throw new Error("not claimed");
            parentPort.postMessage({ held });
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
            Atomics.add(version, workerData.i, 1);`;
        const worker = new Worker(code, { eval: true, workerData: { version: descriptor.values.version, i } });
        const { held } = await new Promise<{ held: number }>((resolve, reject) => {
            worker.once("message", resolve);
            worker.once("error", reject);
        });
        const started = Date.now();
        store.values.setScalar(i, DataType.Double, 7, 0, 1, 1);
        // the owner's write waited for the release, then claimed and released the value in turn
        should(Date.now() - started).be.aboveOrEqual(100);
        const reader = new SharedStoreReader(descriptor);
        const out = fresh();
        should(reader.readValue(i, out)).eql(SharedReadStatus.Good);
        should(out.value).eql(7);
        should(out.version).eql(held + 4);
        await worker.terminate();
    });

    it("lets another thread write a number into a Variable any session may write, as the owner would", () => {
        const store = build(4);
        const i = store.find(numeric(1001));
        const reader = new SharedStoreReader(store.shareForReaders());
        should(reader.writableInPlace(i)).eql(true);
        const before = store.values.version(i);
        const version = reader.writeScalar(i, reader.generation(i), DataType.Int32, 42, 0, 5000, 6000);
        should(version).eql(before + 2);
        const stored = store.values.get(i);
        should(stored.value).eql(42);
        should(stored.dataType).eql(DataType.Int32);
        should(stored.sourceTimestamp).eql(5000);
        should(stored.serverTimestamp).eql(6000);
        should(reader.writeScalar(i, reader.generation(i), DataType.Boolean, true, 0, 1, 1)).eql(before + 4);
        should(store.values.get(i).value).eql(true);
        // what stays the owner's to write
        store.nodes.setBound(i, true);
        should(reader.writableInPlace(i)).eql(false);
        store.nodes.setBound(i, false);
        store.nodes.setHistorizing(i, true);
        should(reader.writableInPlace(i)).eql(false);
        store.nodes.setHistorizing(i, false);
        store.nodes.setAccessLevels(i, 3, 1);
        should(reader.writableInPlace(i)).eql(false, "a user access level without CurrentWrite");
        store.nodes.setAccessLevels(i, 3, 3);
        store.values.setObject(i, DataType.String, { dataType: DataType.String, value: "x" }, 0, 1, 1);
        should(reader.writableInPlace(i)).eql(false, "an object: its bytes are the owner's to lay out");
    });

    it("writes nothing in place once the node changed, holds an object, or the columns moved", () => {
        const store = build(4);
        const i = store.find(numeric(1002));
        const reader = new SharedStoreReader(store.shareForReaders());
        const generation = reader.generation(i);
        const unchanged = () => {
            should(store.values.version(i) % 2).eql(0, "released");
            should(store.values.get(i).value).eql(2);
        };
        should(reader.writeScalar(i, generation + 1, DataType.Double, 9, 0, 1, 1)).eql(-1);
        unchanged();
        store.values.setObject(i, DataType.String, { dataType: DataType.String, value: "x" }, 0, 1, 1);
        should(reader.writeScalar(i, generation, DataType.Double, 9, 0, 1, 1)).eql(-1);
        store.values.setScalar(i, DataType.Double, 2, 0, 1, 1);
        unchanged();
        // the owner grows its columns: these buffers are no longer the store's
        store.values.ensure(store.values.capacity * 2);
        should(reader.writeScalar(i, generation, DataType.Double, 9, 0, 1, 1)).eql(-1);
        unchanged();
    });

    it("releases a value a thread left half written, and marks it BadResourceUnavailable", () => {
        const store = build(4);
        const i = store.find(numeric(1003));
        const version = new Uint32Array(store.shareForReaders().values.version);
        Atomics.add(version, i, 1); // a writer claimed it, and never released it
        should(store.values.releaseAbandoned(5)).eql(1);
        should(Atomics.load(version, i) % 2).eql(0);
        should(store.values.statusCode(i)).eql(0x80040000);
        should(store.values.releaseAbandoned(5)).eql(0);
    });

    it("takes over a claim held longer than a write can take, and the former holder's release then fails", () => {
        const store = build(4);
        const i = store.find(numeric(1000));
        const version = new Uint32Array(store.shareForReaders().values.version);
        const first = claimValue(version, i);
        const started = Date.now();
        const second = claimValue(version, i, 20);
        should(Date.now() - started).be.aboveOrEqual(20);
        should(second).eql(first + 2, "the claim moved by two: still held, by the new writer");
        should(releaseClaim(version, i, first)).eql(false, "the former holder learns it no longer holds the value");
        should(releaseClaim(version, i, second)).eql(true);
        should(Atomics.load(version, i) % 2).eql(0);
        // a writer left the value claimed: the owner's write waits, takes it over, and stores its value
        claimValue(version, i);
        store.values.setScalar(i, DataType.Double, 5, 0, 1, 1);
        should(store.values.get(i).value).eql(5);
        should(Atomics.load(version, i) % 2).eql(0);
    });

    it("releases an abandoned value without taking the value a live writer holds meanwhile", async () => {
        const store = build(4);
        const abandoned = store.find(numeric(1000));
        const live = store.find(numeric(1001));
        const dist = pathToFileURL(path.join(here, "../dist/index.js")).href;
        // a live but slow writer: it holds the value 1 ms at a time, far less than the patience it is given below
        const code = `
            const { workerData, parentPort } = require("node:worker_threads");
            import(workerData.dist).then(({ claimValue, releaseClaim }) => {
                const version = new Uint32Array(workerData.version);
                const stop = new Int32Array(workerData.stop);
                parentPort.postMessage("ready");
                let written = 0, refused = 0;
                while (Atomics.load(stop, 0) === 0) {
                    const claimed = claimValue(version, workerData.live);
                    const until = performance.now() + 1;
                    while (performance.now() < until);
                    if (releaseClaim(version, workerData.live, claimed)) written++;
                    else refused++;
                }
                parentPort.postMessage({ written, refused });
            });`;
        const stop = new SharedArrayBuffer(4);
        const version = new Uint32Array(store.shareForReaders().values.version);
        const worker = new Worker(code, { eval: true, workerData: { dist, version: version.buffer, live, stop } });
        const result = new Promise<{ written: number; refused: number }>((resolve, reject) => {
            worker.on("message", (message) => message !== "ready" && resolve(message));
            worker.on("error", reject);
        });
        await new Promise((resolve) => worker.once("message", resolve));
        let released = 0;
        for (let round = 0; round < 20; round++) {
            Atomics.add(version, abandoned, 1); // a writer claimed it, and never released it
            // the wait on that value runs out first: the live writer's claims after it must still be waited for
            released += store.values.releaseAbandoned(50);
        }
        Atomics.store(new Int32Array(stop), 0, 1);
        const { written, refused } = await result;
        await worker.terminate();
        should(released).eql(20);
        should(written).be.above(10);
        should(refused).eql(0, "no claim of the live writer was taken over");
        for (let i = 0; i < 4; i++) should(store.values.version(i) % 2).eql(0, "no value left held");
    });

    it("lets another thread write a string as its bytes, in its slot or in a new one at the top of the heap", () => {
        const store = buildStrings(4);
        const i = store.find(numeric(1001));
        const reader = new SharedStoreReader(store.shareForReaders());
        should(reader.writableAsBytes(i)).eql(true);
        const text = (stored: { value: unknown }) => (stored.value as { value: unknown }).value;
        // the same length: the slot the value has
        const used = store.values.heapSize;
        const before = store.values.version(i);
        should(reader.writeBytes(i, reader.generation(i), DataType.String, encodedString("abd"), 0, 5000, 6000)).eql(before + 2);
        should(store.values.heapSize).eql(used, "written in its slot");
        const stored = store.values.get(i);
        should(text(stored)).eql("abd");
        should(stored.dataType).eql(DataType.String);
        should(stored.sourceTimestamp).eql(5000);
        should(stored.serverTimestamp).eql(6000);
        // longer than its slot: a new slot, the old one garbage
        const longer = "a string much longer than the first one";
        should(reader.writeBytes(i, reader.generation(i), DataType.String, encodedString(longer), 0, 1, 1)).be.above(0);
        should(store.values.heapSize).be.above(used, "a new slot at the top");
        should(text(store.values.get(i))).eql(longer);
        const out = fresh();
        should(reader.readValue(i, out)).eql(SharedReadStatus.Good);
        should(decoded(out).value).eql(longer);
        // a ByteString, where the DataType takes it
        const bytes = Buffer.from([1, 2, 3, 255]);
        should(
            reader.writeBytes(i, reader.generation(i), DataType.ByteString, encodedScalar(DataType.ByteString, bytes), 0, 1, 1)
        ).be.above(0);
        should(Buffer.from(text(store.values.get(i)) as Buffer)).eql(bytes);
        // what stays the owner's to write
        store.nodes.setWatched(i, true);
        should(reader.writableAsBytes(i)).eql(false, "a value the owner listens to: its change is told with the value");
        store.nodes.setWatched(i, false);
        store.values.setScalar(i, DataType.Double, 1, 0, 1, 1);
        should(reader.writableAsBytes(i)).eql(false, "a number: written as a number (see writeScalar)");
        should(reader.writeBytes(i, reader.generation(i), DataType.String, encodedString("x"), 0, 1, 1)).eql(-1);
        should(store.values.get(i).value).eql(1);
        store.values.setObject(i, DataType.ExtensionObject, { dataType: DataType.ExtensionObject, value: null }, 0, 1, 1);
        should(reader.writableAsBytes(i)).eql(false, "a structure: the owner keeps it decoded too");
    });

    it("leaves a string that does not fit the heap to the owner, who compacts the heap writing it", () => {
        const store = buildStrings(4);
        const i = store.find(numeric(1002));
        const reader = new SharedStoreReader(store.shareForReaders());
        const large = "x".repeat(60000);
        should(reader.writeBytes(i, reader.generation(i), DataType.String, encodedString(large), 0, 1, 1)).eql(-1);
        should(store.values.version(i) % 2).eql(0, "released");
        should((store.values.get(i).value as { value: unknown }).value).eql("abc", "unchanged");
        store.values.setObject(i, DataType.String, { dataType: DataType.String, value: large }, 0, 1, 1);
        should(reader.isCurrent()).eql(false, "the heap moved: this reader's buffers are old");
        should((store.values.get(i).value as { value: unknown }).value).eql(large);
    });

    it("compacts the heap only once a value another thread is writing is whole, and keeps that value", async () => {
        const store = buildStrings(4);
        const i = store.find(numeric(1001));
        const dist = pathToFileURL(path.join(here, "../dist/index.js")).href;
        // the worker writes "xyz" over "abc" in the value's slot, as writeBytes does, slowly: one byte, 30 ms, the rest
        const code = `
            const { workerData, parentPort } = require("node:worker_threads");
            import(workerData.dist).then(({ claimValue, releaseClaim }) => {
                const { values } = workerData.descriptor;
                const version = new Uint32Array(values.version);
                const bytes = new Uint8Array(values.heap.bytes);
                const offset = new Int32Array(values.heap.offset)[workerData.i];
                const claimed = claimValue(version, workerData.i);
                bytes[offset + 5] = 0x78;
                parentPort.postMessage("claimed");
                Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30);
                bytes[offset + 6] = 0x79;
                bytes[offset + 7] = 0x7a;
                releaseClaim(version, workerData.i, claimed);
                parentPort.postMessage("released");
            });`;
        const worker = new Worker(code, { eval: true, workerData: { dist, descriptor: store.shareForReaders(), i } });
        try {
            await new Promise((resolve, reject) => {
                worker.once("message", resolve);
                worker.once("error", reject);
            });
            // a value larger than the heap's room: the owner compacts it, while the worker holds its claim
            const own = store.addNode({
                nodeId: numeric(5000),
                nodeClass: NodeClass.Variable,
                browseName: "Own",
                browseNameNamespace: 1
            });
            store.values.setObject(own, DataType.String, { dataType: DataType.String, value: "o".repeat(60000) }, 0, 1, 1);
            should((store.values.get(i).value as { value: unknown }).value).eql("xyz", "the value the worker wrote, whole");
        } finally {
            await worker.terminate();
        }
    });

    it("keeps strings whole while a worker writes them in place and the owner reads them and compacts the heap", async () => {
        const nodes = 64;
        const store = buildStrings(nodes);
        const index = Array.from({ length: nodes }, (_, k) => store.find(numeric(1000 + k)));
        const dist = pathToFileURL(path.join(here, "../dist/index.js")).href;
        // the worker writes strings "<n>:" followed by n % 61 dashes, of lengths that change, until stopped,
        // taking new buffers when the owner compacted the heap
        const code = `
            const { workerData, parentPort } = require("node:worker_threads");
            import(workerData.dist).then(({ SharedStoreReader }) => {
                const stop = new Int32Array(workerData.stop);
                const encode = (text) => {
                    const bytes = Buffer.from(text, "utf8");
                    const out = new Uint8Array(5 + bytes.length);
                    out[0] = 12;
                    new DataView(out.buffer).setInt32(1, bytes.length, true);
                    out.set(bytes, 5);
                    return out;
                };
                let reader = null, generations = null;
                parentPort.on("message", (descriptor) => {
                    reader = new SharedStoreReader(descriptor);
                    generations = workerData.index.map((i) => reader.generation(i));
                });
                parentPort.postMessage("ready");
                let n = 0, written = 0, refused = 0;
                const loop = () => {
                    for (let round = 0; round < 200 && reader; round++) {
                        for (let k = 0; k < workerData.index.length; k++) {
                            n++;
                            const text = n + ":" + "-".repeat(n % 61);
                            if (reader.writeBytes(workerData.index[k], generations[k], 12, encode(text), 0, n, n) < 0) refused++;
                            else written++;
                        }
                    }
                    if (Atomics.load(stop, 0) === 0) setImmediate(loop);
                    else parentPort.postMessage({ written, refused });
                };
                loop();
            });`;
        const stop = new SharedArrayBuffer(4);
        const worker = new Worker(code, { eval: true, workerData: { dist, index, stop } });
        const result = new Promise<{ written: number; refused: number }>((resolve, reject) => {
            worker.on("message", (message) => message !== "ready" && resolve(message));
            worker.on("error", reject);
        });
        await new Promise((resolve) => worker.once("message", resolve));
        worker.postMessage(store.shareForReaders());
        // the owner reads the strings, and writes ever larger ones into a node of its own, which fills the
        // heap again and again: each compaction gives the worker new buffers to take
        const own = store.addNode({
            nodeId: numeric(5000),
            nodeClass: NodeClass.Variable,
            browseName: "Own",
            browseNameNamespace: 1
        });
        let reads = 0;
        let torn = 0;
        let compactions = 0;
        let size = 0;
        const until = Date.now() + 1500;
        try {
            while (Date.now() < until) {
                for (const i of index) {
                    const value = (store.values.get(i).value as { value: string }).value;
                    reads++;
                    if (value === "abc") continue;
                    const [count, dashes] = value.split(":");
                    if (dashes.length !== Number(count) % 61) torn++;
                }
                const layout = store.shareForReaders().layoutSeen;
                size = (size + 4096) % 40000;
                store.values.setObject(own, DataType.String, { dataType: DataType.String, value: "o".repeat(size) }, 0, 1, 1);
                if (store.shareForReaders().layoutSeen !== layout) {
                    compactions++;
                    worker.postMessage(store.shareForReaders());
                }
                await new Promise((resolve) => setImmediate(resolve));
            }
        } finally {
            Atomics.store(new Int32Array(stop), 0, 1);
        }
        const { written, refused } = await result;
        await worker.terminate();
        should(torn).eql(0);
        should(reads).be.above(1000);
        should(written).be.above(1000);
        should(compactions).be.above(2, "the heap compacted under the writer");
        should(refused).be.above(0, "the writer left values to the owner once the heap moved");
        for (const i of index) should(store.values.version(i) % 2).eql(0, "no value left held");
    });

    it("keeps values whole while a worker writes in place and the owner reads, and grows its columns under it", async () => {
        const nodes = 2000;
        const store = build(nodes);
        const index = Array.from({ length: nodes }, (_, i) => store.find(numeric(1000 + i)));
        const dist = pathToFileURL(path.join(here, "../dist/index.js")).href;
        // the worker writes value v with both timestamps v, until the columns move under it
        const code = `
            const { workerData, parentPort } = require("node:worker_threads");
            import(workerData.dist).then(({ SharedStoreReader }) => {
                const reader = new SharedStoreReader(workerData.descriptor);
                const generations = workerData.index.map((i) => reader.generation(i));
                parentPort.postMessage("ready");
                let v = 1, written = 0, refused = 0;
                const stop = Date.now() + 3000;
                while (Date.now() < stop && refused === 0) {
                    for (let k = 0; k < workerData.index.length; k++) {
                        v++;
                        if (reader.writeScalar(workerData.index[k], generations[k], 11, v, 0, v, v) < 0) { refused++; break; }
                        written++;
                    }
                }
                parentPort.postMessage({ written, refused });
            });`;
        const descriptor = store.shareForReaders();
        const worker = new Worker(code, { eval: true, workerData: { dist, descriptor, index } });
        const result = new Promise<{ written: number; refused: number }>((resolve, reject) => {
            worker.on("message", (message) => message !== "ready" && resolve(message));
            worker.on("error", reject);
        });
        await new Promise((resolve) => worker.once("message", resolve));
        const reader = new SharedStoreReader(descriptor);
        const out = fresh();
        let reads = 0;
        let torn = 0;
        const stop = Date.now() + 300;
        while (Date.now() < stop) {
            for (const i of index) {
                if (reader.readValue(i, out) === SharedReadStatus.Good) {
                    reads++;
                    if (out.value !== out.sourceTimestamp && out.sourceTimestamp !== 1000) torn++;
                }
            }
        }
        store.values.ensure(store.values.capacity * 2);
        const { written, refused } = await result;
        await worker.terminate();
        should(torn).eql(0);
        should(reads).be.above(1000);
        should(written).be.above(1000);
        should(refused).eql(1, "the worker stopped writing once the columns moved");
        for (const i of index) should(store.values.version(i) % 2).eql(0, "no value left held");
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

    it("keeps a string or an array as its bytes only, and gives the owner a copy decoded from them", () => {
        const store = build(2);
        const [text, array] = [0, 1].map((k) => store.find(numeric(1000 + k)));
        store.values.setObject(text, DataType.String, { dataType: DataType.String, value: "pump" }, 0, 10, 20);
        store.values.setObject(
            array,
            DataType.Double,
            { dataType: DataType.Double, arrayType: VariantArrayType.Array, value: new Float64Array([1, 2, 3]) },
            0,
            10,
            20
        );
        should(store.values.objectCount).eql(0, "no object beside the bytes");
        should((store.values.get(text).value as { value: string }).value).eql("pump");
        const first = (store.values.get(array).value as { value: Float64Array }).value;
        should([...first]).eql([1, 2, 3]);
        // the decoded array is a copy: changing it changes neither the store nor the next read
        first[0] = 99;
        should([...(store.values.get(array).value as { value: Float64Array }).value]).eql([1, 2, 3]);
        const out = fresh();
        should(new SharedStoreReader(store.shareForReaders()).readValue(array, out)).eql(SharedReadStatus.Good);
        should([...(decoded(out).value as Float64Array)]).eql([1, 2, 3]);
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
