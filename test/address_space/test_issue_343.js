"use strict";
/* global describe,it,before*/
require("requirish")._(module);

var path = require("path");
var generateAddressSpace = require("lib/address_space/load_nodeset2").generate_address_space;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var createBoilerType = require("test/helpers/boiler_system").createBoilerType;

describe("Testing automatic string nodeid assignment", function () {

    function getBrowseName(x) {
        return x.browseName.toString();
    }

    require("test/helpers/resource_leak_detector").installResourceLeakDetector(true, function () {

        var nodesetFilename = path.join(__dirname, "../../nodesets/Opc.Ua.NodeSet2.xml");


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

});
