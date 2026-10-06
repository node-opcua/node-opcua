import { NodeClass } from "node-opcua-data-model";
import { NodeId, NodeIdType } from "node-opcua-nodeid";
import should from "should";
import { NO_NODE, NodeStore } from "../source/index.js";

describe("NodeStore: the index of a deleted node is taken again", () => {
    const numeric = (i: number) => new NodeId(NodeIdType.NUMERIC, i, 1);
    const record = (i: number) => ({
        nodeId: numeric(i),
        nodeClass: NodeClass.Variable,
        browseName: `V${i}`,
        browseNameNamespace: 1
    });

    it("gives a freed index to the next node and moves its generation", () => {
        const store = new NodeStore(16);
        const a = store.add(record(1));
        const b = store.add(record(2));
        should(store.count).eql(2);
        const generation = store.generation(a);
        store.delete(a);
        should(store.isDeleted(a)).eql(true);
        should(store.freeCount).eql(1);
        should(store.find(numeric(1))).eql(NO_NODE);
        const c = store.add(record(3));
        should(c).eql(a, "the freed index");
        should(store.count).eql(2, "no new index was handed out");
        should(store.freeCount).eql(0);
        should(store.isDeleted(c)).eql(false);
        should(store.generation(c)).eql(generation + 1);
        should(store.browseName(c)).eql("V3");
        should(store.find(numeric(3))).eql(c);
        should(store.find(numeric(2))).eql(b);
        // deleting twice is harmless
        store.delete(c);
        store.delete(c);
        should(store.freeCount).eql(1);
    });

    it("keeps the columns bounded under add and delete churn", () => {
        const store = new NodeStore(16);
        for (let round = 0; round < 1000; round++) {
            const i = store.add(record(round));
            store.delete(i);
        }
        should(store.count).eql(1, "one index, reused a thousand times");
    });

    it("carries the reference type and view attributes", () => {
        const store = new NodeStore(16);
        const t = store.add({
            nodeId: numeric(10),
            nodeClass: NodeClass.ReferenceType,
            browseName: "HasThing",
            browseNameNamespace: 1,
            inverseName: "ThingOf",
            symmetric: false
        });
        should(store.inverseName(t)).eql("ThingOf");
        should(store.symmetric(t)).eql(false);
        const v = store.add({
            nodeId: numeric(11),
            nodeClass: NodeClass.View,
            browseName: "V",
            browseNameNamespace: 1,
            containsNoLoops: true
        });
        should(store.containsNoLoops(v)).eql(true);
        should(store.inverseName(v)).eql(null);
    });
});
