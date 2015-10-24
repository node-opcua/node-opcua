"use strict";
require("requirish")._(module);
var should = require("should");
var assert = require("assert");

var get_mini_address_space = require("test/fixtures/fixture_mininodeset_address_space").get_mini_address_space;

var NodeId = require("lib/datamodel/nodeid").NodeId;

describe("testing address space", function () {

    var addressSpace = null, rootFolder;
    before(function (done) {
        get_mini_address_space(function (err, data) {
            addressSpace = data;
            rootFolder = addressSpace.findObject("RootFolder");
            done(err);
        });
    });
    function findReference(references, nodeId) {
        assert(nodeId instanceof NodeId);
        return references.filter(function (r) {
            return r.nodeId.toString() === nodeId.toString();
        });
    }

    it("should be possible to remove an object previously added to the address space", function () {

        var options = {browseName: "SomeObject"};
        var object = addressSpace.addObjectInFolder("RootFolder", options);

        // object shall  be found with a global nodeId search
        addressSpace.findObject(object.nodeId).should.eql(object);

        // object shall  be found in parent folder
        var references = rootFolder.findReferences("HasComponent", true);
        findReference(references, object.nodeId).length.should.eql(1);


        addressSpace.deleteObject(object.nodeId);

        // object shall not be found with a global nodeId search
        should(addressSpace.findObject(object.nodeId)).eql(undefined);

        // object shall not be found in parent folder anymore
        references = rootFolder.findReferences("HasComponent", true);
        findReference(references, object.nodeId).length.should.eql(0);

    });

    it("should be possible to remove an object and its children previously added to the address space", function () {

        var options = {browseName: "SomeObject"};
        var object = addressSpace.addObjectInFolder("RootFolder", options);
        var innerVar = addressSpace.addVariable(object, {browseName: "Hello", dataType: "String"});

        // object shall  be found with a global nodeId search
        addressSpace.findObject(object.nodeId).should.eql(object);
        addressSpace.findObject(innerVar.nodeId).should.eql(innerVar);

        var references = object.findReferences("HasComponent", true);
        findReference(references, innerVar.nodeId).length.should.eql(1);

        references = rootFolder.findReferences("HasComponent", true);
        findReference(references, object.nodeId).length.should.eql(1);

        addressSpace.deleteObject(object.nodeId);

        // object shall not be found with a global nodeId search
        should(addressSpace.findObject(object.nodeId)).eql(undefined);
        should(addressSpace.findObject(innerVar.nodeId)).eql(undefined);

    });

    describe("AddressSpace#findCorrespondingBasicDataType",function() {

        var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
        var DataTypeIds = require("lib/opcua_node_ids").DataTypeIds;
        var DataType = require("lib/datamodel/variant").DataType;
        var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;

        it("should findCorrespondingBasicDataType i=13 => DataType.String",function() {

            var dataType = addressSpace.findDataType(resolveNodeId("i=12"));
            dataType.browseName.toString().should.eql("String");
            addressSpace.findCorrespondingBasicDataType(dataType).should.eql(DataType.String);

        });

        it("should findCorrespondingBasicDataType i=338 => BuildInfo => DataType.ExtensionObject",function() {

            var dataType = addressSpace.findDataType(makeNodeId( DataTypeIds.BuildInfo)); // ServerStatus
            dataType.browseName.toString().should.eql("BuildInfo");
            addressSpace.findCorrespondingBasicDataType(dataType).should.eql(DataType.ExtensionObject);
        });

        it("should findCorrespondingBasicDataType variation 1 - Alias",function() {
            addressSpace.findCorrespondingBasicDataType("Int32").should.eql(DataType.Int32);
        });
        it("should findCorrespondingBasicDataType variation 2 - nodeId as String",function() {
            addressSpace.findCorrespondingBasicDataType("i=13").should.eql(DataType.DateTime);
        });
        it("should findCorrespondingBasicDataType variation 3 - nodeId as NodeId",function() {
            addressSpace.findCorrespondingBasicDataType(makeNodeId(DataTypeIds.BuildInfo)).should.eql(DataType.ExtensionObject);
        });

        it("should findCorrespondingBasicDataType i=852 (Enumeration ServerState) => UInt32",function() {
            addressSpace.findCorrespondingBasicDataType(makeNodeId(DataTypeIds.ServerState)).should.eql(DataType.Int32);
        });
    });

});
