"use strict";
/* global describe,it,before*/

var should = require("should");
var assert = require("node-opcua-assert");

var AddressSpace = require("..").AddressSpace;
var generateAddressSpace = require("..").generate_address_space;
var nodeId = require("node-opcua-nodeid");
var path = require("path");

var nodesetFilename = path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml");
var DataType = require("node-opcua-variant").DataType;


var assertHasMatchingReference = require("../test_helpers/assertHasMatchingReference");

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing github issue https://github.com/node-opcua/node-opcua/issues/104", function () {

    var addressSpace = null;
    var rootFolder;

    before(function (done) {
        addressSpace = new AddressSpace();
        generateAddressSpace(addressSpace, nodesetFilename, function (err) {
            rootFolder = addressSpace.findNode("RootFolder");
            done(err);
        });
    });
    after(function (done) {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        done();
    });

    it("should not happen that node IDs are use twice", function () {
        // Create a variable with an auto-generated node ID
        var var1 = addressSpace.addVariable({
            browseName: "var1",
            dataType: "Double",
            value: {dataType: DataType.Double, value: 0},
            organizedBy: rootFolder
        });

        assertHasMatchingReference(var1, {referenceType: "OrganizedBy", nodeId: rootFolder.nodeId});

        assert(var1.nodeId.identifierType === nodeId.NodeIdType.NUMERIC);

        // Create two variables with the next numeric node IDs
        var var2 = addressSpace.addVariable({
            nodeId: new nodeId.NodeId(var1.nodeId.identifierType, var1.nodeId.value + 1, var1.nodeId.namespace),
            browseName: "var2",
            dataType: "Double",
            value: {dataType: DataType.Double, value: 0},
            organizedBy: rootFolder
        });

        should(var2.nodeId.identifierType).eql(nodeId.NodeIdType.NUMERIC);
        should(var2.nodeId.namespace).eql(var1.nodeId.namespace);
        should(var2.nodeId.value).eql(var1.nodeId.value + 1);

        var var3 = addressSpace.addVariable({
            nodeId: new nodeId.NodeId(var1.nodeId.identifierType, var1.nodeId.value + 2, var1.nodeId.namespace),
            browseName: "var3",
            dataType: "Double",
            value: {dataType: DataType.Double, value: 0},
            organizedBy: rootFolder
        });

        should(var3.nodeId.identifierType).eql(nodeId.NodeIdType.NUMERIC);
        should(var3.nodeId.namespace).eql(var1.nodeId.namespace);
        should(var3.nodeId.value).eql(var1.nodeId.value + 2);

        // Create another value with an auto-generated node ID
        // It must not have the same node ID as the second variable.
        var var4 = addressSpace.addVariable({
            browseName: "var4",
            dataType: "Double",
            value: {dataType: DataType.Double, value: 0},
            organizedBy: rootFolder
        });

        should(var4.nodeId.identifierType).eql(nodeId.NodeIdType.NUMERIC);
        should(var4.nodeId.namespace).eql(var1.nodeId.namespace);
        should(var4.nodeId.value).eql(var1.nodeId.value + 3);
    });

});
