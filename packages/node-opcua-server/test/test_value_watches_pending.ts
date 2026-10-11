import type { Worker } from "node:worker_threads";
import { SharedStoreReader, StoreAddressSpace } from "node-opcua-address-space-store";
import { NodeClass } from "node-opcua-data-model";
import { NodeId, NodeIdType } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";
import should from "should";
import { decodeMonitoredValues, type EngineToFront, WATCH } from "../source/front_threads/protocol.js";
import { ValueWatches } from "../source/front_threads/value_watches.js";

// A monitored item that reports changes asks the engine to watch its node, a turn after its client has
// the item: values another front writes in place meanwhile must still reach it, every one, in order.
describe("ValueWatches: a watch begun in a front before the engine registers it", () => {
    it("replays the values written in place between the beginning of the watch and its registration", async () => {
        const space = new StoreAddressSpace({ expectedNodes: 1024, shared: true });
        const ns = space.registerNamespace("urn:test:watches");
        // the node as the store holds it: the watch needs no DataType
        const index = space.store.addNode({
            nodeId: new NodeId(NodeIdType.STRING, "Level", ns),
            nodeClass: NodeClass.Variable,
            browseName: "Level",
            browseNameNamespace: ns,
            accessLevel: 3
        });
        space.store.values.setScalar(index, DataType.Double, 0, 0, 0, 0);

        // the front of the item begins its watch, before its client has the item
        const watching = new SharedStoreReader(space.store.shareForReaders());
        const generation = watching.generation(index);
        watching.beginWatch();

        // another front writes the value in place, and tells the engine, which has no watch yet
        const writer = new SharedStoreReader(space.store.shareForReaders());
        should(writer.isWatched(index)).eql(true, "a watch is pending: the writer tells the engine");
        for (let k = 1; k <= 19; k++) {
            const version = writer.writeScalar(index, generation, DataType.Double, k, 0, k, k);
            space.changedElsewhere([index, version, DataType.Double, k, 0, k, k], [null]);
        }
        space.store.values.setScalar(index, DataType.Double, 20, 0, 20, 20);

        // then the engine registers the watch
        const messages: EngineToFront[] = [];
        const front = { postMessage: (message: EngineToFront) => messages.push(message) } as unknown as Worker;
        const watches = new ValueWatches(space);
        watches.apply(front, [WATCH, index, generation]);
        await new Promise((resolve) => setImmediate(resolve));

        const changes = messages.find((message) => message.kind === "changes");
        should(changes).not.eql(undefined);
        if (changes?.kind !== "changes") return;
        const values = decodeMonitoredValues(changes.values).map((dataValue) => dataValue.value.value);
        should(values).eql([...Array.from({ length: 19 }, (_, k) => k + 1), 20], "every value written, then the value now");
        should(changes.versions).eql(
            [...changes.versions].sort((a, b) => a - b),
            "in order"
        );
        should(space.store.watchesPending).eql(false, "the registered watch is no longer pending");
        should(writer.isWatched(index)).eql(true, "the engine listens to the value now");
    });
});
