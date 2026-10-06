import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { NodeClass } from "node-opcua-data-model";
import { NodeId, NodeIdType } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";
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
    version: 0
});

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
        store.values.setObject(i, DataType.String, { dataType: DataType.String, value: "x" }, 0, 1, 1);
        should(reader.readValue(i, out)).eql(SharedReadStatus.NotShared);
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
});
