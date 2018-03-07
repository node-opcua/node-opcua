"use strict";

var _ = require("underscore");
var should = require("should");

var async = require("async");
var path = require("path");

var StatusCodes = require("node-opcua-status-code").StatusCodes;
var DataType = require("node-opcua-variant").DataType;
var Variant = require("node-opcua-variant").Variant;
var DataValue = require("node-opcua-data-value").DataValue;
var VariantArrayType = require("node-opcua-variant").VariantArrayType;
var AttributeIds = require("node-opcua-data-model").AttributeIds;
var NodeClass = require("node-opcua-data-model").NodeClass;
var NodeId = require("node-opcua-nodeid").NodeId;
var makeNodeId = require("node-opcua-nodeid").makeNodeId;

var nodeset_filename = path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml");


var address_space = require("..");
var UAVariable = address_space.UAVariable;
var SessionContext = address_space.SessionContext;
var generate_address_space = address_space.generate_address_space;
var context = SessionContext.defaultContext;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Variables ", function () {
    it("accessLevel: CurrentRead | CurrentWrite\tuserAccessLevel: CurrentRead | CurrentWrite", function(){
        var addressSpace = new address_space.AddressSpace();

        var v = new UAVariable({
            browseName: "some variable",
            addressSpace: addressSpace,
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentRead | CurrentWrite",
            userAccessLevel: "CurrentRead | CurrentWrite"
        });

        v.accessLevel.key.should.eql("CurrentRead | CurrentWrite");
        v.userAccessLevel.key.should.eql("CurrentRead | CurrentWrite");

        addressSpace.dispose();
    });

    it("accessLevel: CurrentRead | CurrentWrite\tuserAccessLevel: CurrentRead", function(){
        var addressSpace = new address_space.AddressSpace();

        var v = new UAVariable({
            browseName: "some variable",
            addressSpace: addressSpace,
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentRead",
            userAccessLevel: "CurrentRead | CurrentWrite"
        });

        v.accessLevel.key.should.eql("CurrentRead");
        v.userAccessLevel.key.should.eql("CurrentRead");

        addressSpace.dispose();
    });

    it("accessLevel: CurrentRead | CurrentWrite\tuserAccessLevel: CurrentWrite", function(){
        var addressSpace = new address_space.AddressSpace();

        var v = new UAVariable({
            browseName: "some variable",
            addressSpace: addressSpace,
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentRead | CurrentWrite",
            userAccessLevel: "CurrentWrite"
        });

        v.accessLevel.key.should.eql("CurrentRead | CurrentWrite");
        v.userAccessLevel.key.should.eql("CurrentWrite");

        addressSpace.dispose();
    });

    it("accessLevel: CurrentRead | CurrentWrite\tuserAccessLevel: undefined", function(){
        var addressSpace = new address_space.AddressSpace();

        var v = new UAVariable({
            browseName: "some variable",
            addressSpace: addressSpace,
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentRead | CurrentWrite"
        });

        v.accessLevel.key.should.eql("CurrentRead | CurrentWrite");
        v.userAccessLevel.key.should.eql("CurrentRead | CurrentWrite");

        addressSpace.dispose();
    });

    // accessLevel CurrentRead
    it("accessLevel: CurrentRead \tuserAccessLevel: CurrentRead | CurrentWrite", function(){
        var addressSpace = new address_space.AddressSpace();

        var v = new UAVariable({
            browseName: "some variable",
            addressSpace: addressSpace,
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentRead",
            userAccessLevel: "CurrentRead | CurrentWrite"
        });

        v.accessLevel.key.should.eql("CurrentRead");
        v.userAccessLevel.key.should.eql("CurrentRead");

        addressSpace.dispose();
    });

    it("accessLevel: CurrentRead \tuserAccessLevel: CurrentRead", function(){
        var addressSpace = new address_space.AddressSpace();

        var v = new UAVariable({
            browseName: "some variable",
            addressSpace: addressSpace,
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentRead",
            userAccessLevel: "CurrentRead"
        });

        v.accessLevel.key.should.eql("CurrentRead");
        v.userAccessLevel.key.should.eql("CurrentRead");

        addressSpace.dispose();
    });

    it("accessLevel: CurrentRead \tuserAccessLevel: CurrentWrite", function(){
        var addressSpace = new address_space.AddressSpace();

        var v = new UAVariable({
            browseName: "some variable",
            addressSpace: addressSpace,
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentRead",
            userAccessLevel: "CurrentWrite"
        });

        v.accessLevel.key.should.eql("CurrentRead");
        v.userAccessLevel.key.should.eql("NONE");

        addressSpace.dispose();
    });

    it("accessLevel: CurrentRead \tuserAccessLevel: undefined", function(){
        var addressSpace = new address_space.AddressSpace();

        var v = new UAVariable({
            browseName: "some variable",
            addressSpace: addressSpace,
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentRead"
        });

        v.accessLevel.key.should.eql("CurrentRead");
        v.userAccessLevel.key.should.eql("CurrentRead");

        addressSpace.dispose();
    });

    // accessLevel CurrentWrite
    it("accessLevel: CurrentWrite \tuserAccessLevel: CurrentRead | CurrentWrite", function(){
        var addressSpace = new address_space.AddressSpace();

        var v = new UAVariable({
            browseName: "some variable",
            addressSpace: addressSpace,
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentWrite",
            userAccessLevel: "CurrentRead | CurrentWrite"
        });

        v.accessLevel.key.should.eql("CurrentWrite");
        v.userAccessLevel.key.should.eql("CurrentWrite");

        addressSpace.dispose();
    });

    it("accessLevel: CurrentWrite \tuserAccessLevel: CurrentRead", function(){
        var addressSpace = new address_space.AddressSpace();

        var v = new UAVariable({
            browseName: "some variable",
            addressSpace: addressSpace,
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentWrite",
            userAccessLevel: "CurrentRead"
        });

        v.accessLevel.key.should.eql("CurrentWrite");
        v.userAccessLevel.key.should.eql("NONE");

        addressSpace.dispose();
    });

    it("accessLevel: CurrentWrite \tuserAccessLevel: CurrentWrite", function(){
        var addressSpace = new address_space.AddressSpace();

        var v = new UAVariable({
            browseName: "some variable",
            addressSpace: addressSpace,
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentWrite",
            userAccessLevel: "CurrentWrite"
        });

        v.accessLevel.key.should.eql("CurrentWrite");
        v.userAccessLevel.key.should.eql("CurrentWrite");

        addressSpace.dispose();
    });

    it("accessLevel: CurrentWrite \tuserAccessLevel: undefined", function(){
        var addressSpace = new address_space.AddressSpace();

        var v = new UAVariable({
            browseName: "some variable",
            addressSpace: addressSpace,
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentWrite"
        });

        v.accessLevel.key.should.eql("CurrentWrite");
        v.userAccessLevel.key.should.eql("CurrentWrite");

        addressSpace.dispose();
    });

    // accessLevel undefined
    it("accessLevel: undefined \tuserAccessLevel: CurrentRead | CurrentWrite", function(){
        var addressSpace = new address_space.AddressSpace();

        var v = new UAVariable({
            browseName: "some variable",
            addressSpace: addressSpace,
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            userAccessLevel: "CurrentRead | CurrentWrite"
        });

        v.accessLevel.key.should.eql("CurrentRead | CurrentWrite");
        v.userAccessLevel.key.should.eql("CurrentRead | CurrentWrite");

        addressSpace.dispose();
    });

    it("accessLevel: undefined \tuserAccessLevel: CurrentRead", function(){
        var addressSpace = new address_space.AddressSpace();

        var v = new UAVariable({
            browseName: "some variable",
            addressSpace: addressSpace,
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            userAccessLevel: "CurrentRead"
        });

        v.accessLevel.key.should.eql("CurrentRead | CurrentWrite");
        v.userAccessLevel.key.should.eql("CurrentRead");

        addressSpace.dispose();
    });

    it("accessLevel: undefined \tuserAccessLevel: CurrentWrite", function(){
        var addressSpace = new address_space.AddressSpace();

        var v = new UAVariable({
            browseName: "some variable",
            addressSpace: addressSpace,
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            userAccessLevel: "CurrentWrite"
        });

        v.accessLevel.key.should.eql("CurrentRead | CurrentWrite");
        v.userAccessLevel.key.should.eql("CurrentWrite");

        addressSpace.dispose();
    });

    it("accessLevel: undefined \tuserAccessLevel: undefined", function(){
        var addressSpace = new address_space.AddressSpace();

        var v = new UAVariable({
            browseName: "some variable",
            addressSpace: addressSpace,
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3]
        });

        v.accessLevel.key.should.eql("CurrentRead | CurrentWrite");
        v.userAccessLevel.key.should.eql("CurrentRead | CurrentWrite");

        addressSpace.dispose();
    });
});
