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

});
