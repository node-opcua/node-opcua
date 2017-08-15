/*global describe, it, require*/

var makeExpandedNodeId = require("../src/expanded_nodeid").makeExpandedNodeId;
var coerceExpandedNodeId = require("../src/expanded_nodeid").coerceExpandedNodeId;
var ExpandedNodeId = require("../src/expanded_nodeid").ExpandedNodeId;

var makeNodeId = require("..").makeNodeId;
var NodeIdType = require("..").NodeIdType;

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

    it("should create a ExpandedNodeId from a integer", function () {

        var exnodeId = makeExpandedNodeId(1);
        should(exnodeId.value).eql(1);
    });
    it("should create a ExpandedNodeId from a ExpandedNodeId", function () {

        var exnodeId1 = new ExpandedNodeId(NodeIdType.NUMERIC,1,2,"namespaceURI",3);
        var exnodeId2 = makeExpandedNodeId(exnodeId1);
        should(exnodeId2.value).eql(1);
    });
    it("should throw when calling makeExpandedNodeId with bad argument", function () {

        should(function() {
            var exnodeId2 = makeExpandedNodeId("BAD");
        }).throw();
    });
    it("ExpandedNodeId#toString", function () {

        var exnodeId = new ExpandedNodeId(NodeIdType.NUMERIC,1,2,"namespaceURI",3);
        should(exnodeId.value).eql(1);
        should(exnodeId.namespace).eql(2);
        should(exnodeId.namespaceUri).eql("namespaceURI");
        should(exnodeId.serverIndex).eql(3);
        should(exnodeId.toString()).eql("ns=2;i=1;namespaceUri:namespaceURI;serverIndex:3");
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
    it("coerceExpandedNodeId should coerce an ExpandedNodeId", function () {

        var exNodeId = coerceExpandedNodeId("ns=0;i=10");
        var exNodeId2 = coerceExpandedNodeId(exNodeId);
        exNodeId2.toString().should.eql("ns=0;i=10");

    });


});
