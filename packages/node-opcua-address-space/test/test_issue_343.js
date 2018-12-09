"use strict";
/* global describe,it,before*/
const nodesets = require("node-opcua-nodesets");
const generateAddressSpace = require("..").generate_address_space;
const AddressSpace = require("..").AddressSpace;
const Namespace = require("..").Namespace;

const createBoilerType = require("../test_helpers/boiler_system").createBoilerType;
const should = require("should");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing automatic string nodeid assignment", function () {


    const nodesetFilename = nodesets.standard_nodeset_file;


    let addressSpace = null;
    let boilerType = null;
    before(function (done) {
        addressSpace = new AddressSpace();
        generateAddressSpace(addressSpace, nodesetFilename, function () {
            const namespace = addressSpace.registerNamespace("private");
            namespace.index.should.eql(1);

            const someNamespace1 =addressSpace.registerNamespace("SomeOtherNamespace1");
            someNamespace1.index.should.eql(2);

            const someNamespace2 =addressSpace.registerNamespace("SomeOtherNamespace2");
            someNamespace2.index.should.eql(3);

            boilerType = createBoilerType(addressSpace);
            done();
        });
    });
    after(function (done) {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        done();
    });

    it("should automatically assign string nodeId in same namespace as parent object", function () {

        const someNamespace1 =addressSpace.getNamespace("SomeOtherNamespace1");

        const boiler = boilerType.instantiate({
            browseName: "Boiler#1",
            nodeId: "s=MyBoiler"
        });

        boiler.nodeId.toString().should.eql("ns=1;s=MyBoiler");

        boiler.pipeX001.nodeId.namespace.should.eql(boiler.nodeId.namespace, "expecting namespace index to match");
        boiler.pipeX001.nodeId.toString().should.eql("ns=1;s=MyBoiler-1:PipeX001");

        //  console.log(boiler.toString());

    });

    it("should be possible to specify a custom separator for construction string nodeid during object instantiation", function () {


        const old_nodeIdNameSeparator = Namespace.nodeIdNameSeparator;

        old_nodeIdNameSeparator.should.have.type("string");

        Namespace.nodeIdNameSeparator = "#";

        const boiler = boilerType.instantiate({
            browseName: "Boiler2",
            nodeId: "s=MyBoiler2"
        });

        boiler.nodeId.toString().should.eql("ns=1;s=MyBoiler2");

        boiler.pipeX001.nodeId.namespace.should.eql(boiler.nodeId.namespace, "expecting namespace index to match");
        boiler.pipeX001.nodeId.toString().should.eql("ns=1;s=MyBoiler2#1:PipeX001");

        Namespace.nodeIdNameSeparator = old_nodeIdNameSeparator;

    });

});
