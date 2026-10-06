import { NodeId, NodeIdType } from "node-opcua-nodeid";
import should from "should";
import { ReferenceImpl } from "../impl/reference_impl.js";
import { ReferenceIndex } from "../impl/reference_index.js";

describe("ReferenceIndex", () => {
    // the index reads the key a reference caches once it has been computed
    const ordinals = { referenceTypeOrdinal: (referenceType: NodeId) => referenceType.value as number };
    const reference = (i: number, isForward = true) => {
        const ref = new ReferenceImpl({
            referenceType: new NodeId(NodeIdType.NUMERIC, 47, 0),
            nodeId: new NodeId(NodeIdType.NUMERIC, 1000 + i, 0),
            isForward
        });
        return { ref, key: ref.key(ordinals) };
    };

    it("starts empty", () => {
        const index = new ReferenceIndex();
        should(index.size).eql(0);
        should(index.has(1)).eql(false);
        should(index.get(1)).eql(undefined);
        should([...index.values()]).eql([]);
        should(index.delete(1)).eql(false);
    });

    it("holds a few references in insertion order", () => {
        const index = new ReferenceIndex();
        const refs = [reference(1), reference(2, false), reference(3)];
        for (const { ref, key } of refs) {
            index.set(key, ref);
        }
        should(index.size).eql(3);
        for (const { ref, key } of refs) {
            should(index.has(key)).eql(true);
            should(index.get(key)).equal(ref);
        }
        should([...index]).eql(refs.map((r) => r.ref));
        should(index.has(reference(4).key)).eql(false);
    });

    it("replaces a reference set twice under the same key", () => {
        const index = new ReferenceIndex();
        const { ref, key } = reference(1);
        index.set(key, ref);
        const again = reference(1).ref;
        index.set(key, again);
        should(index.size).eql(1);
        should(index.get(key)).equal(again);
    });

    it("deletes, and forgets the last one entirely", () => {
        const index = new ReferenceIndex();
        const a = reference(1);
        const b = reference(2);
        index.set(a.key, a.ref);
        index.set(b.key, b.ref);
        should(index.delete(a.key)).eql(true);
        should(index.delete(a.key)).eql(false);
        should(index.size).eql(1);
        should([...index.values()]).eql([b.ref]);
        should(index.delete(b.key)).eql(true);
        should(index.size).eql(0);
        should([...index.values()]).eql([]);
    });

    it("still finds a reference that has been disposed before being removed", () => {
        // BaseNode_remove_backward_reference disposes the reference it removes
        const index = new ReferenceIndex();
        const { ref, key } = reference(1);
        index.set(key, ref);
        ref.dispose();
        should(index.has(key)).eql(true);
        should(index.delete(key)).eql(true);
        should(index.size).eql(0);
    });

    it("behaves the same above the threshold where it switches to a Map", () => {
        const index = new ReferenceIndex();
        const refs = Array.from({ length: 40 }, (_, i) => reference(i, i % 2 === 0));
        for (const { ref, key } of refs) {
            index.set(key, ref);
        }
        should(index.size).eql(40);
        for (const { ref, key } of refs) {
            should(index.get(key)).equal(ref);
        }
        should([...index.values()]).eql(refs.map((r) => r.ref));
        should(index.delete(refs[20].key)).eql(true);
        should(index.has(refs[20].key)).eql(false);
        should(index.size).eql(39);
        index.clear();
        should(index.size).eql(0);
    });
});
