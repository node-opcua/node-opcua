"use strict";

const _ = require("underscore");
const should = require("should");

const address_space = require("..");
const get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;
const AccessLevelFlag  = require("node-opcua-data-model").AccessLevelFlag;

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

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);

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

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentRead);

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

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentWrite);

    });

    it("accessLevel: CurrentRead | CurrentWrite\tuserAccessLevel: undefined", function(){

        const v = namespace.addVariable({
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentRead | CurrentWrite"
        });

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);

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

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentRead);

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

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentRead);

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

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead);
        v.userAccessLevel.should.eql(AccessLevelFlag.NONE);

    });

    it("accessLevel: CurrentRead \tuserAccessLevel: undefined", function(){

        const v = namespace.addVariable({
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentRead"
        });

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentRead);

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

        v.accessLevel.should.eql(AccessLevelFlag.CurrentWrite);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentWrite);

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

        v.accessLevel.should.eql(AccessLevelFlag.CurrentWrite);
        v.userAccessLevel.should.eql(AccessLevelFlag.NONE);

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

        v.accessLevel.should.eql(AccessLevelFlag.CurrentWrite);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentWrite);

    });

    it("accessLevel: CurrentWrite \tuserAccessLevel: undefined", function(){

        const v = namespace.addVariable({
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            accessLevel: "CurrentWrite"
        });

        v.accessLevel.should.eql(AccessLevelFlag.CurrentWrite);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentWrite);

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

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);

    });

    it("accessLevel: undefined \tuserAccessLevel: CurrentRead", function(){

        const v = namespace.addVariable({
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            userAccessLevel: "CurrentRead"
        });

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentRead);

    });

    it("accessLevel: undefined \tuserAccessLevel: CurrentWrite", function(){

        const v = namespace.addVariable({
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            userAccessLevel: "CurrentWrite"
        });

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentWrite);

    });

    it("accessLevel: undefined \tuserAccessLevel: undefined", function(){

        const v = namespace.addVariable({
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3]
        });

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);

    });
});
