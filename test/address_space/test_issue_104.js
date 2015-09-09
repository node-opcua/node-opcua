"use strict";
/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");

var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var assert = require("better-assert");
var generateAddressSpace = require("lib/address_space/load_nodeset2").generate_address_space;
var nodeId = require("lib/datamodel/nodeid");
var path = require("path");
var nodesetFilename = path.join(__dirname,"../../lib/server/mini.Node.Set2.xml");

describe("testing github issue https://github.com/node-opcua/node-opcua/issues/104",function() {

    var addressSpace = new AddressSpace();
    var rootFolder;

    before(function (done) {
        generateAddressSpace(addressSpace, nodesetFilename, function () {
            rootFolder = addressSpace.findObject("RootFolder");
            done();
        });
    });

    it("should not happen that node IDs are use twice",function() {
        // Create a variable with an auto-generated node ID
        var var1 = addressSpace.addVariable(rootFolder,
            {
                browseName: "var1",
                dataType: "Double",
                value: {}
            });

        assert(var1.nodeId.identifierType === nodeId.NodeIdType.NUMERIC);

        // Create two variables with the next numeric node IDs
        var var2 = addressSpace.addVariable(rootFolder,
            {
                nodeId: new nodeId.NodeId(var1.nodeId.identifierType, var1.nodeId.value + 1, var1.nodeId.namespace),
                browseName: "var2",
                dataType: "Double",
                value: {}
            });

        should(var2.nodeId.identifierType).eql(nodeId.NodeIdType.NUMERIC);
        should(var2.nodeId.namespace).eql(var1.nodeId.namespace);
        should(var2.nodeId.value).eql(var1.nodeId.value + 1);

        var var3 = addressSpace.addVariable(rootFolder,
            {
                nodeId: new nodeId.NodeId(var1.nodeId.identifierType, var1.nodeId.value + 2, var1.nodeId.namespace),
                browseName: "var3",
                dataType: "Double",
                value: {}
            });

        should(var3.nodeId.identifierType).eql(nodeId.NodeIdType.NUMERIC);
        should(var3.nodeId.namespace).eql(var1.nodeId.namespace);
        should(var3.nodeId.value).eql(var1.nodeId.value + 2);

        // Create another value with an auto-generated node ID
        // It must not have the same node ID as the second variable.
        var var4 = addressSpace.addVariable(rootFolder,
            {
                browseName: "var4",
                dataType: "Double",
                value: {}
            });

        should(var4.nodeId.identifierType).eql(nodeId.NodeIdType.NUMERIC);
        should(var4.nodeId.namespace).eql(var1.nodeId.namespace);
        should(var4.nodeId.value).eql(var1.nodeId.value + 3);
    });

});
