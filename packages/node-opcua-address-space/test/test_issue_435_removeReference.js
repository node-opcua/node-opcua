"use strict";
/* global describe,it,before*/
var should = require("should");
var nodesets = require("node-opcua-nodesets");
var generateAddressSpace = require("..").generate_address_space;
var AddressSpace = require("..").AddressSpace;
var createBoilerType = require("../test_helpers/boiler_system").createBoilerType;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("UANode#removeReference",function() {

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

    it("should be possible to remove a reference ", function () {


        var boiler = boilerType.instantiate({
            browseName: "Boiler#1",
            nodeId: "ns=36;s=MyBoiler"
        });

        boiler.nodeId.toString().should.eql("ns=36;s=MyBoiler");

        const componentsBefore = boiler.getComponents().map(x=>x.browseName.toString());
        console.log(componentsBefore.join(" "));
        componentsBefore.indexOf("PipeX001").should.be.aboveOrEqual(0);


        boiler.removeReference({referenceType:"HasComponent",nodeId: boiler.pipeX001.nodeId});
        const componentsAfter = boiler.getComponents().map(x=>x.browseName.toString());
        console.log(componentsAfter.join(" "));

        componentsAfter.indexOf("PipeX001").should.eql(-1);

        should.not.exist(boiler.pipeX001);

        boiler.removeReference({referenceType:"HasComponent",nodeId: boiler.pipeX002.nodeId});
        should.not.exist(boiler.pipeX002);

    });



});
