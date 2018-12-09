"use strict";

const _ = require("underscore");
const should = require("should");

const address_space = require("..");
const get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Variables ", function () {

    let addressSpace ,namespace;
    beforeEach(function(done){
        get_mini_address_space(function (err, __addressSpace__) {
            addressSpace = __addressSpace__;
            namespace = addressSpace.getOwnNamespace();
            done(err);
        });
    });
    afterEach(function() {
        addressSpace.dispose();
        addressSpace = null;
    });
    it("accessLevel: CurrentRead | CurrentWrite\tuserAccessLevel: CurrentRead | CurrentWrite", function(){


        const v = namespace.addVariable({
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentRead | CurrentWrite",
            userAccessLevel: "CurrentRead | CurrentWrite"
        });

        v.accessLevel.key.should.eql("CurrentRead | CurrentWrite");
        v.userAccessLevel.key.should.eql("CurrentRead | CurrentWrite");

       });

    it("accessLevel: CurrentRead | CurrentWrite\tuserAccessLevel: CurrentRead", function(){

        const v = namespace.addVariable({
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentRead",
            userAccessLevel: "CurrentRead | CurrentWrite"
        });

        v.accessLevel.key.should.eql("CurrentRead");
        v.userAccessLevel.key.should.eql("CurrentRead");

    });

    it("accessLevel: CurrentRead | CurrentWrite\tuserAccessLevel: CurrentWrite", function(){

        const v = namespace.addVariable({
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentRead | CurrentWrite",
            userAccessLevel: "CurrentWrite"
        });

        v.accessLevel.key.should.eql("CurrentRead | CurrentWrite");
        v.userAccessLevel.key.should.eql("CurrentWrite");

    });

    it("accessLevel: CurrentRead | CurrentWrite\tuserAccessLevel: undefined", function(){

        const v = namespace.addVariable({
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentRead | CurrentWrite"
        });

        v.accessLevel.key.should.eql("CurrentRead | CurrentWrite");
        v.userAccessLevel.key.should.eql("CurrentRead | CurrentWrite");

    });

    // accessLevel CurrentRead
    it("accessLevel: CurrentRead \tuserAccessLevel: CurrentRead | CurrentWrite", function(){

        const v = namespace.addVariable({
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentRead",
            userAccessLevel: "CurrentRead | CurrentWrite"
        });

        v.accessLevel.key.should.eql("CurrentRead");
        v.userAccessLevel.key.should.eql("CurrentRead");

    });

    it("accessLevel: CurrentRead \tuserAccessLevel: CurrentRead", function(){

        const v = namespace.addVariable({
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentRead",
            userAccessLevel: "CurrentRead"
        });

        v.accessLevel.key.should.eql("CurrentRead");
        v.userAccessLevel.key.should.eql("CurrentRead");

    });

    it("accessLevel: CurrentRead \tuserAccessLevel: CurrentWrite", function(){

        const v = namespace.addVariable({
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentRead",
            userAccessLevel: "CurrentWrite"
        });

        v.accessLevel.key.should.eql("CurrentRead");
        v.userAccessLevel.key.should.eql("NONE");

    });

    it("accessLevel: CurrentRead \tuserAccessLevel: undefined", function(){

        const v = namespace.addVariable({
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentRead"
        });

        v.accessLevel.key.should.eql("CurrentRead");
        v.userAccessLevel.key.should.eql("CurrentRead");

    });

    // accessLevel CurrentWrite
    it("accessLevel: CurrentWrite \tuserAccessLevel: CurrentRead | CurrentWrite", function(){

        const v = namespace.addVariable({
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentWrite",
            userAccessLevel: "CurrentRead | CurrentWrite"
        });

        v.accessLevel.key.should.eql("CurrentWrite");
        v.userAccessLevel.key.should.eql("CurrentWrite");

    });

    it("accessLevel: CurrentWrite \tuserAccessLevel: CurrentRead", function(){

        const v = namespace.addVariable({
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentWrite",
            userAccessLevel: "CurrentRead"
        });

        v.accessLevel.key.should.eql("CurrentWrite");
        v.userAccessLevel.key.should.eql("NONE");

    });

    it("accessLevel: CurrentWrite \tuserAccessLevel: CurrentWrite", function(){

        const v = namespace.addVariable({
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentWrite",
            userAccessLevel: "CurrentWrite"
        });

        v.accessLevel.key.should.eql("CurrentWrite");
        v.userAccessLevel.key.should.eql("CurrentWrite");

    });

    it("accessLevel: CurrentWrite \tuserAccessLevel: undefined", function(){

        const v = namespace.addVariable({
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentWrite"
        });

        v.accessLevel.key.should.eql("CurrentWrite");
        v.userAccessLevel.key.should.eql("CurrentWrite");

    });

    // accessLevel undefined
    it("accessLevel: undefined \tuserAccessLevel: CurrentRead | CurrentWrite", function(){

        const v = namespace.addVariable({
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            userAccessLevel: "CurrentRead | CurrentWrite"
        });

        v.accessLevel.key.should.eql("CurrentRead | CurrentWrite");
        v.userAccessLevel.key.should.eql("CurrentRead | CurrentWrite");

    });

    it("accessLevel: undefined \tuserAccessLevel: CurrentRead", function(){

        const v = namespace.addVariable({
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            userAccessLevel: "CurrentRead"
        });

        v.accessLevel.key.should.eql("CurrentRead | CurrentWrite");
        v.userAccessLevel.key.should.eql("CurrentRead");

    });

    it("accessLevel: undefined \tuserAccessLevel: CurrentWrite", function(){

        const v = namespace.addVariable({
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            userAccessLevel: "CurrentWrite"
        });

        v.accessLevel.key.should.eql("CurrentRead | CurrentWrite");
        v.userAccessLevel.key.should.eql("CurrentWrite");

    });

    it("accessLevel: undefined \tuserAccessLevel: undefined", function(){

        const v = namespace.addVariable({
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3]
        });

        v.accessLevel.key.should.eql("CurrentRead | CurrentWrite");
        v.userAccessLevel.key.should.eql("CurrentRead | CurrentWrite");

    });
});
