import { NodeId, NodeIdType } from "node-opcua-nodeid";
import should from "should";
import { NO_NODE, NodeIdIndex, StringArena } from "../source/index.js";

describe("NodeIdIndex", () => {
    const numeric = (ns: number, i: number) => new NodeId(NodeIdType.NUMERIC, i, ns);
    const str = (ns: number, s: string) => new NodeId(NodeIdType.STRING, s, ns);
    const guid = (ns: number, g: string) => new NodeId(NodeIdType.GUID, g, ns);
    const opaque = (ns: number, bytes: number[]) => new NodeId(NodeIdType.BYTESTRING, Buffer.from(bytes), ns);

    it("indexes every identifier kind", () => {
        const index = new NodeIdIndex(new StringArena());
        index.set(numeric(0, 85), 1);
        index.set(str(2, "Pump.Speed"), 2);
        index.set(guid(3, "72962B91-FA75-4AE6-8D28-B404DC7DAF63"), 3);
        index.set(opaque(4, [1, 2, 3, 4]), 4);
        should(index.size).eql(4);
        should(index.get(numeric(0, 85))).eql(1);
        should(index.get(str(2, "Pump.Speed"))).eql(2);
        should(index.get(guid(3, "72962b91-fa75-4ae6-8d28-b404dc7daf63"))).eql(3, "a GUID is matched whatever its case");
        should(index.get(opaque(4, [1, 2, 3, 4]))).eql(4);
    });

    it("tells identifier kinds, namespaces and values apart", () => {
        const index = new NodeIdIndex(new StringArena());
        index.set(numeric(1, 1000), 7);
        should(index.get(numeric(2, 1000))).eql(NO_NODE);
        should(index.get(numeric(1, 1001))).eql(NO_NODE);
        should(index.get(str(1, "1000"))).eql(NO_NODE);
        should(index.get(str(1, "never seen"))).eql(NO_NODE, "an unknown string does not get interned by a lookup");
        should(index.get(opaque(1, []))).eql(NO_NODE);
    });

    it("handles the full 32-bit identifier range and large namespaces", () => {
        const index = new NodeIdIndex(new StringArena());
        index.set(numeric(65535, 0xffffffff), 1);
        index.set(numeric(65535, 0), 2);
        index.set(numeric(0, 0xffffffff), 3);
        should(index.get(numeric(65535, 0xffffffff))).eql(1);
        should(index.get(numeric(65535, 0))).eql(2);
        should(index.get(numeric(0, 0xffffffff))).eql(3);
    });

    it("replaces, deletes, and reuses the freed slot", () => {
        const index = new NodeIdIndex(new StringArena());
        index.set(numeric(1, 5), 10);
        index.set(numeric(1, 5), 11);
        should(index.size).eql(1);
        should(index.get(numeric(1, 5))).eql(11);
        should(index.delete(numeric(1, 5))).eql(true);
        should(index.delete(numeric(1, 5))).eql(false);
        should(index.get(numeric(1, 5))).eql(NO_NODE);
        should(index.size).eql(0);
        index.set(numeric(1, 5), 12);
        should(index.get(numeric(1, 5))).eql(12);
    });

    it("grows and rehashes without losing entries", () => {
        const index = new NodeIdIndex(new StringArena(), 8);
        for (let i = 0; i < 50000; i++) {
            index.set(i % 2 === 0 ? numeric(1, (i * 2654435761) >>> 0) : str(1, `s${i}`), i);
        }
        should(index.size).eql(50000);
        for (let i = 0; i < 50000; i += 97) {
            should(index.get(i % 2 === 0 ? numeric(1, (i * 2654435761) >>> 0) : str(1, `s${i}`))).eql(i);
        }
        // deletions in bulk, then the survivors
        for (let i = 0; i < 50000; i += 2) {
            index.delete(numeric(1, (i * 2654435761) >>> 0));
        }
        should(index.size).eql(25000);
        should(index.get(str(1, "s12345"))).eql(12345);
        should(index.get(numeric(1, (2 * 2654435761) >>> 0))).eql(NO_NODE);
    });

    it("remembers the string identifiers looked up lately, and forgets what moved", () => {
        const index = new NodeIdIndex(new StringArena(), 8);
        index.set(str(1, "Pump"), 1);
        index.set(str(2, "Pump"), 2);
        // the same string in two namespaces: the memory answers by namespace, not by text
        should(index.get(str(1, "Pump"))).eql(1);
        should(index.get(str(2, "Pump"))).eql(2);
        should(index.get(str(1, "Pump"))).eql(1);
        should(index.get(str(3, "Pump"))).eql(NO_NODE);
        // a deleted identifier is gone from the memory too; set again, found again
        index.delete(str(1, "Pump"));
        should(index.get(str(1, "Pump"))).eql(NO_NODE);
        index.set(str(1, "Pump"), 3);
        should(index.get(str(1, "Pump"))).eql(3);
        // a growth moves every slot: what was remembered is still answered right
        for (let i = 0; i < 1000; i++) index.set(numeric(1, i), 100 + i);
        should(index.get(str(1, "Pump"))).eql(3);
        should(index.get(str(2, "Pump"))).eql(2);
        // many more distinct strings than the memory holds: still every one is answered
        for (let i = 0; i < 40000; i++) index.set(str(1, `x${i}`), i);
        for (let i = 0; i < 40000; i += 7) should(index.get(str(1, `x${i}`))).eql(i);
        for (let i = 0; i < 40000; i += 7) should(index.get(str(1, `x${i}`))).eql(i);
        should(index.get(str(1, "Pump"))).eql(3);
    });
});
