"use strict";
/* global describe,it,before*/
var nodesets = require("node-opcua-nodesets");
var generateAddressSpace = require("..").generate_address_space;
var AddressSpace = require("..").AddressSpace;
var createBoilerType = require("../test_helpers/boiler_system").createBoilerType;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing automatic string nodeid assignment", function () {


    var nodesetFilename = nodesets.standard_nodeset_file;


    var addressSpace = null;
    var boilerType = null;
    before(function (done) {
        addressSpace = new AddressSpace();
        generateAddressSpace(addressSpace, nodesetFilename, function () {
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


        var boiler = boilerType.instantiate({
            browseName: "Boiler#1",
            nodeId: "ns=36;s=MyBoiler"
        });

        boiler.nodeId.toString().should.eql("ns=36;s=MyBoiler");

        boiler.pipeX001.nodeId.namespace.should.eql(boiler.nodeId.namespace, "expecting namespace index to match");
        boiler.pipeX001.nodeId.toString().should.eql("ns=36;s=MyBoiler-PipeX001");

        //  console.log(boiler.toString());

    });

    it("should be possible to specify a custom separator for construction string nodeid during object instantiation", function () {


        var old_nodeIdNameSeparator = AddressSpace.nodeIdNameSeparator;

        AddressSpace.nodeIdNameSeparator = "#";

        var boiler = boilerType.instantiate({
            browseName: "Boiler2",
            nodeId: "ns=36;s=MyBoiler2"
        });

        boiler.nodeId.toString().should.eql("ns=36;s=MyBoiler2");

        boiler.pipeX001.nodeId.namespace.should.eql(boiler.nodeId.namespace, "expecting namespace index to match");
        boiler.pipeX001.nodeId.toString().should.eql("ns=36;s=MyBoiler2#PipeX001");

        AddressSpace.nodeIdNameSeparator = old_nodeIdNameSeparator;

    });

});
