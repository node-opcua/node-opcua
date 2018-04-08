"use strict";

const _ = require("underscore");
const should = require("should");

const async = require("async");
const path = require("path");

const StatusCodes = require("node-opcua-status-code").StatusCodes;
const DataType = require("node-opcua-variant").DataType;
const Variant = require("node-opcua-variant").Variant;
const DataValue = require("node-opcua-data-value").DataValue;
const VariantArrayType = require("node-opcua-variant").VariantArrayType;
const AttributeIds = require("node-opcua-data-model").AttributeIds;
const NodeClass = require("node-opcua-data-model").NodeClass;
const NodeId = require("node-opcua-nodeid").NodeId;
const makeNodeId = require("node-opcua-nodeid").makeNodeId;

const nodeset_filename = path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml");


const address_space = require("..");
const UAVariable = address_space.UAVariable;
const SessionContext = address_space.SessionContext;
const generate_address_space = address_space.generate_address_space;
const context = SessionContext.defaultContext;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Variables ", function () {
    it("accessLevel: CurrentRead | CurrentWrite\tuserAccessLevel: CurrentRead | CurrentWrite", function(){
        const addressSpace = new address_space.AddressSpace();

        const v = new UAVariable({
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
        const addressSpace = new address_space.AddressSpace();

        const v = new UAVariable({
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
        const addressSpace = new address_space.AddressSpace();

        const v = new UAVariable({
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
        const addressSpace = new address_space.AddressSpace();

        const v = new UAVariable({
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
        const addressSpace = new address_space.AddressSpace();

        const v = new UAVariable({
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
        const addressSpace = new address_space.AddressSpace();

        const v = new UAVariable({
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
        const addressSpace = new address_space.AddressSpace();

        const v = new UAVariable({
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
        const addressSpace = new address_space.AddressSpace();

        const v = new UAVariable({
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
        const addressSpace = new address_space.AddressSpace();

        const v = new UAVariable({
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
        const addressSpace = new address_space.AddressSpace();

        const v = new UAVariable({
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
        const addressSpace = new address_space.AddressSpace();

        const v = new UAVariable({
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
        const addressSpace = new address_space.AddressSpace();

        const v = new UAVariable({
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
        const addressSpace = new address_space.AddressSpace();

        const v = new UAVariable({
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
        const addressSpace = new address_space.AddressSpace();

        const v = new UAVariable({
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
        const addressSpace = new address_space.AddressSpace();

        const v = new UAVariable({
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
        const addressSpace = new address_space.AddressSpace();

        const v = new UAVariable({
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
