const {
    coerceNodeId,
    makeExpandedNodeId,
    coerceExpandedNodeId,
    ExpandedNodeId,
    makeNodeId,
    NodeIdType
} = require("..");

const should = require("should");

describe("testing ExpandedNodeId", function() {

    it("should create a ExpandedNodeId from a integer", function() {
        const exnodeId = makeExpandedNodeId(1);
        exnodeId.identifierType.should.eql(NodeIdType.NUMERIC);
        exnodeId.value.should.eql(1);
        exnodeId.namespace.should.eql(0);
        should(exnodeId.namespaceUri).eql(null);
        should(exnodeId.serverIndex).eql(0);
        exnodeId.toString().should.eql("i=1");
    });

    it("should create a ExpandedNodeId from a integer", function() {

        const exnodeId = makeExpandedNodeId(1);
        should(exnodeId.value).eql(1);
    });
    it("should create a ExpandedNodeId from a ExpandedNodeId", function() {

        const exnodeId1 = new ExpandedNodeId(NodeIdType.NUMERIC, 1, 2, "namespaceURI", 3);
        const exnodeId2 = makeExpandedNodeId(exnodeId1);
        should(exnodeId2.value).eql(1);
    });
    it("should throw when calling makeExpandedNodeId with bad argument", function() {

        should(function() {
            const exnodeId2 = makeExpandedNodeId("BAD");
        }).throw();
    });
    it("ExpandedNodeId#toString", function() {

        const exnodeId = new ExpandedNodeId(NodeIdType.NUMERIC, 1, 2, "namespaceURI", 3);
        should(exnodeId.value).eql(1);
        should(exnodeId.namespace).eql(2);
        should(exnodeId.namespaceUri).eql("namespaceURI");
        should(exnodeId.serverIndex).eql(3);
        should(exnodeId.toString()).eql("svr=3;nsu=namespaceURI;i=1");
    });


    it("should create a ExpandedNodeId from a NodeId", function() {

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


    it("coerceExpandedNodeId should coerce 'i=10'", function() {

        const exNodeId = coerceExpandedNodeId("ns=0;i=10");
        exNodeId.toString().should.eql("i=10");

    });
    it("coerceExpandedNodeId should coerce an ExpandedNodeId", function() {

        const exNodeId = coerceExpandedNodeId("ns=0;i=10");
        const exNodeId2 = coerceExpandedNodeId(exNodeId);
        exNodeId2.toString().should.eql("i=10");

    });


    it("ExpandedNodeId.fromNodeId", () => {


        const serverIndex = 3;
        const nodeId = coerceNodeId("ns=1;s=ABC");
        const expandedNodeId = ExpandedNodeId.fromNodeId(nodeId, "URI", serverIndex);
        expandedNodeId.toString().should.eql("svr=3;nsu=URI;s=ABC");
    });
    it("ExpandedNodeId#toJSON", () => {
        const exNodeId = coerceExpandedNodeId("ns=0;i=10");
        exNodeId.toJSON().should.eql(exNodeId.toString());
    });
    it("makeExpandedNodeId()", () => {
        makeExpandedNodeId().toString().should.eql("i=0");
    })
});
