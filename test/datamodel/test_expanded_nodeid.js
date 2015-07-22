/*global describe, it, require*/
require("requirish")._(module);
var makeExpandedNodeId = require("lib/datamodel/expanded_nodeid").makeExpandedNodeId;
var coerceExpandedNodeId = require("lib/datamodel/expanded_nodeid").coerceExpandedNodeId;
var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
var NodeIdType = require("lib/datamodel/nodeid").NodeIdType;
var should = require("should");

describe("testing ExpandedNodeId", function () {

    it("should create a ExpandedNodeId from a integer", function () {
        var exnodeId = makeExpandedNodeId(1);
        exnodeId.identifierType.should.eql(NodeIdType.NUMERIC);
        exnodeId.value.should.eql(1);
        exnodeId.namespace.should.eql(0);
        should(exnodeId.namespaceUri).eql(null);
        should(exnodeId.serverIndex).eql(0);
        exnodeId.toString().should.eql("ns=0;i=1");
    });


    it("should create a ExpandedNodeId from a NodeId", function () {

        var nodeId = makeNodeId("some_text", 2);
        nodeId.identifierType.should.eql(NodeIdType.STRING);

        var exnodeId = makeExpandedNodeId(nodeId);
        exnodeId.identifierType.should.eql(NodeIdType.STRING);
        exnodeId.value.should.eql("some_text");
        exnodeId.namespace.should.eql(2);
        should(exnodeId.namespaceUri).eql(null);
        should(exnodeId.serverIndex).eql(0);
        exnodeId.toString().should.eql("ns=2;s=some_text");
    });


    it("coerceExpandedNodeId should coerce 'i=10'", function () {

        var exNodeId = coerceExpandedNodeId("ns=0;i=10");
        exNodeId.toString().should.eql("ns=0;i=10");

    });

});