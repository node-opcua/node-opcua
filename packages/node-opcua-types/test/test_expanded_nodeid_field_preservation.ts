import { BinaryStream } from "node-opcua-binary-stream";
import { ExpandedNodeId, NodeIdType } from "node-opcua-nodeid";
import { AddNodesItem, AddReferencesItem, BrowsePathTarget, ReferenceDescription } from "..";
import "should";

/**
 * Generated structure constructors coerce every ExpandedNodeId field through
 * coerceExpandedNodeId, which used to rebuild only identifierType/value/namespace
 * and silently drop namespaceUri and serverIndex (github issue: field loss at
 * construction, before any encoding). These tests pin the fix for a scalar
 * field, an array field being covered by test_alias_name_data_type.ts.
 */
describe("ExpandedNodeId fields of generated structures preserve namespaceUri and serverIndex", () => {
    const remote = new ExpandedNodeId(NodeIdType.STRING, "Temp1", 2, "urn:remote:server:ns", 3);
    const expected = "ns=2;s=Temp1;namespaceUri:urn:remote:server:ns;serverIndex:3";

    it("BrowsePathTarget#targetId", () => {
        const obj = new BrowsePathTarget({ targetId: remote, remainingPathIndex: 0 });
        obj.targetId.toString().should.eql(expected);
    });

    it("AddReferencesItem#targetNodeId", () => {
        const obj = new AddReferencesItem({ targetNodeId: remote });
        obj.targetNodeId.toString().should.eql(expected);
    });

    it("AddNodesItem#parentNodeId, #requestedNewNodeId and #typeDefinition", () => {
        const obj = new AddNodesItem({ parentNodeId: remote, requestedNewNodeId: remote, typeDefinition: remote });
        obj.parentNodeId.toString().should.eql(expected);
        obj.requestedNewNodeId.toString().should.eql(expected);
        obj.typeDefinition.toString().should.eql(expected);
    });

    it("ReferenceDescription#nodeId survives a binary round trip", () => {
        const value = new ReferenceDescription({ nodeId: remote, typeDefinition: remote });
        const stream = new BinaryStream(value.binaryStoreSize());
        value.encode(stream);
        stream.rewind();
        const reloaded = new ReferenceDescription();
        reloaded.decode(stream);
        reloaded.nodeId.toString().should.eql(expected);
        reloaded.typeDefinition.toString().should.eql(expected);
    });
});
