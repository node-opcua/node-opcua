import should from "should";

import { coerceExpandedNodeId, coerceNodeId, ExpandedNodeId, makeExpandedNodeId, makeNodeId, NodeIdType } from "../dist/index.js";

describe("testing ExpandedNodeId", () => {
    it("should create a ExpandedNodeId from a integer", () => {
        const exnodeId = makeExpandedNodeId(1);
        exnodeId.identifierType.should.eql(NodeIdType.NUMERIC);
        exnodeId.value.should.eql(1);
        exnodeId.namespace.should.eql(0);
        should(exnodeId.namespaceUri).eql(null);
        should(exnodeId.serverIndex).eql(0);
        exnodeId.toString().should.eql("ns=0;i=1");
    });

    it("should create a ExpandedNodeId from a integer", () => {
        const exnodeId = makeExpandedNodeId(1);
        should(exnodeId.value).eql(1);
    });
    it("should create a ExpandedNodeId from a ExpandedNodeId", () => {
        const exnodeId1 = new ExpandedNodeId(NodeIdType.NUMERIC, 1, 2, "namespaceURI", 3);
        const exnodeId2 = makeExpandedNodeId(exnodeId1);
        should(exnodeId2.value).eql(1);
    });
    it("should throw when calling makeExpandedNodeId with bad argument", () => {
        should(() => {
            const _exnodeId2 = makeExpandedNodeId("BAD");
        }).throw();
    });
    it("ExpandedNodeId#toString", () => {
        const exnodeId = new ExpandedNodeId(NodeIdType.NUMERIC, 1, 2, "namespaceURI", 3);
        should(exnodeId.value).eql(1);
        should(exnodeId.namespace).eql(2);
        should(exnodeId.namespaceUri).eql("namespaceURI");
        should(exnodeId.serverIndex).eql(3);
        should(exnodeId.toString()).eql("ns=2;i=1;namespaceUri:namespaceURI;serverIndex:3");
    });

    it("should create a ExpandedNodeId from a NodeId", () => {
        const nodeId = makeNodeId("some_text", 2);
        nodeId.identifierType.should.eql(NodeIdType.STRING);

        const exnodeId = makeExpandedNodeId(nodeId);
        exnodeId.identifierType.should.eql(NodeIdType.STRING);
        exnodeId.value.should.eql("some_text");
        exnodeId.namespace.should.eql(2);
        should(exnodeId.namespaceUri).eql(null);
        should(exnodeId.serverIndex).eql(0);
        exnodeId.toString().should.eql("ns=2;s=some_text");
    });

    it("coerceExpandedNodeId should coerce 'i=10'", () => {
        const exNodeId = coerceExpandedNodeId("ns=0;i=10");
        exNodeId.toString().should.eql("ns=0;i=10");
    });
    it("coerceExpandedNodeId should coerce an ExpandedNodeId", () => {
        const exNodeId = coerceExpandedNodeId("ns=0;i=10");
        const exNodeId2 = coerceExpandedNodeId(exNodeId);
        exNodeId2.toString().should.eql("ns=0;i=10");
    });
    it("coerceExpandedNodeId should preserve namespaceUri and serverIndex of an ExpandedNodeId", () => {
        const exNodeId = new ExpandedNodeId(NodeIdType.STRING, "Temp1", 2, "urn:some:namespace", 3);
        const exNodeId2 = coerceExpandedNodeId(exNodeId);
        exNodeId2.should.not.equal(exNodeId);
        should(exNodeId2.namespaceUri).eql("urn:some:namespace");
        should(exNodeId2.serverIndex).eql(3);
        exNodeId2.toString().should.eql("ns=2;s=Temp1;namespaceUri:urn:some:namespace;serverIndex:3");
    });
    it("coerceExpandedNodeId should preserve namespaceUri and serverIndex of a NodeId-like literal", () => {
        const exNodeId = coerceExpandedNodeId({
            identifierType: NodeIdType.STRING,
            value: "Temp1",
            namespace: 2,
            namespaceUri: "urn:some:namespace",
            serverIndex: 3
        });
        exNodeId.toString().should.eql("ns=2;s=Temp1;namespaceUri:urn:some:namespace;serverIndex:3");
    });

    it("ExpandedNodeId.fromNodeId", () => {
        const serverIndex = 3;
        const nodeId = coerceNodeId("ns=1;s=ABC");
        const expandedNodeId = ExpandedNodeId.fromNodeId(nodeId, "URI", serverIndex);
        expandedNodeId.toString().should.eql("ns=1;s=ABC;namespaceUri:URI;serverIndex:3");
    });
    it("ExpandedNodeId#toJSON", () => {
        const exNodeId = coerceExpandedNodeId("ns=0;i=10");
        exNodeId.toJSON().should.eql(exNodeId.toString());
    });
    it("makeExpandedNodeId()", () => {
        makeExpandedNodeId().toString().should.eql("ns=0;i=0");
    });
});
