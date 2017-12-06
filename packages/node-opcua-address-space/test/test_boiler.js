"use strict";
/* global describe,it,before*/

var async = require("async");
var generateAddressSpace = require("..").generate_address_space;
var AddressSpace = require("..").AddressSpace;

var UAStateMachine = require("..").UAStateMachine;
var context = require("..").SessionContext.defaultContext;

var createBoilerType = require("../test_helpers/boiler_system").createBoilerType;
var makeBoiler = require("../test_helpers/boiler_system").makeBoiler;


var doDebug = false;
var nodesets = require("node-opcua-nodesets");

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing Boiler System", function () {

    function getBrowseName(x) {
        return x.browseName.toString();
    }


    var nodesetFilename = nodesets.standard_nodeset_file;

    var addressSpace = null;
    before(function (done) {
        addressSpace = new AddressSpace();
        generateAddressSpace(addressSpace, nodesetFilename, function () {
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

    it("XX should handle StateMachine derived from ProgramStateMachine", function () {

        var programStateMachine = addressSpace.findObjectType("ProgramStateMachineType");

        var psm = programStateMachine.instantiate({browseName: "MyStateMachine#2"});

        UAStateMachine.promote(psm);

        psm.getStates().map(getBrowseName).should.eql(['Ready', 'Running', 'Suspended', 'Halted']);


    });


    it("XX should handle StateMachine derived from ProgramStateMachine", function () {

        var myProgramStateMachine = addressSpace.addObjectType({
            browseName: "MyProgramStateMachine",
            subtypeOf: "ProgramStateMachineType"
        });

        var psm = myProgramStateMachine.instantiate({browseName: "MyStateMachine#2"});
        UAStateMachine.promote(psm);

        psm.getStates().map(getBrowseName).should.eql(['Ready', 'Running', 'Suspended', 'Halted']);

        psm.getTransitions().map(getBrowseName).should.eql([
            "HaltedToReady",
            "ReadyToRunning",
            "RunningToHalted",
            "RunningToReady",
            "RunningToSuspended",
            "SuspendedToRunning",
            "SuspendedToHalted",
            "SuspendedToReady",
            "ReadyToHalted"
        ]);
    });


    it("should create a boiler system", function (done) {


        var boilerType = createBoilerType(addressSpace);
        boilerType.getNotifiers().length.should.eql(3);
        boilerType.getEventSources().length.should.eql(1);

        var boiler = makeBoiler(addressSpace, {
            browseName: "Boiler#1"
        });

        boiler.pipeX001.browseName.toString().should.eql("PipeX001");
        boiler.pipeX002.browseName.toString().should.eql("PipeX002");
        boiler.drumX001.browseName.toString().should.eql("DrumX001");
        boiler.simulation.browseName.toString().should.eql("Simulation");

        //xx boiler.pipeX001.displayName.text.toString().should.eql("Pipe1001");

        boiler.pipeX001.modellingRule.should.eql("Mandatory");
        boiler.pipeX002.modellingRule.should.eql("Mandatory");
        boiler.drumX001.modellingRule.should.eql("Mandatory");
        boiler.simulation.modellingRule.should.eql("Mandatory");

        boiler.getNotifiers().length.should.eql(3);
        boiler.getEventSources().length.should.eql(1);

        boiler.getNotifiers().map(function (x) {
            return x.browseName.toString()
        }).join(" ").should.eql("PipeX001 DrumX001 PipeX002");
        //xx boiler.pipeX001.notifierOf.nodeId.toString().should.eql(boiler.nodeId.toString());
        //xx boiler.pipeX001.notifierOf.nodeId.toString().should.eql(boiler.nodeId.toString());


        var haltMethod = boiler.simulation.getMethodByName("Halt");
        var resetMethod = boiler.simulation.getMethodByName("Reset");
        var startMethod = boiler.simulation.getMethodByName("Start");
        var suspendMethod = boiler.simulation.getMethodByName("Suspend");

        async.series([

            function (callback) {
                // expecting initial state to be Ready
                haltMethod.getExecutableFlag(context).should.eql(true);
                resetMethod.getExecutableFlag(context).should.eql(false);
                startMethod.getExecutableFlag(context).should.eql(true);
                suspendMethod.getExecutableFlag(context).should.eql(false);

                haltMethod.execute([], context, function (err, callMethodResponse) {
                    if (doDebug) {
                        console.log(" Halt has been called".bgWhite.cyan, err, callMethodResponse.statusCode.toString());
                    }
                    haltMethod.getExecutableFlag(context).should.eql(false);
                    resetMethod.getExecutableFlag(context).should.eql(true);
                    startMethod.getExecutableFlag(context).should.eql(false);
                    suspendMethod.getExecutableFlag(context).should.eql(false);
                    callback(err);
                });
            },
            function (callback) {
                resetMethod.execute([], context, function (err, callMethodResponse) {
                    if (doDebug) {
                        console.log(" resetMethod has been called".bgWhite.cyan, err, callMethodResponse.statusCode.toString());
                    }
                    haltMethod.getExecutableFlag(context).should.eql(true);
                    resetMethod.getExecutableFlag(context).should.eql(false);
                    startMethod.getExecutableFlag(context).should.eql(true);
                    suspendMethod.getExecutableFlag(context).should.eql(false);
                    callback(err);
                });
            },

            function (callback) {
                startMethod.execute([], context, function (err, callMethodResponse) {
                    if (doDebug) {
                        console.log(" startMethod has been called".bgWhite.cyan, err, callMethodResponse.statusCode.toString());
                    }
                    haltMethod.getExecutableFlag(context).should.eql(true);
                    resetMethod.getExecutableFlag(context).should.eql(true);
                    startMethod.getExecutableFlag(context).should.eql(false);
                    suspendMethod.getExecutableFlag(context).should.eql(true);
                    callback(err);
                });
            },

            function (callback) {
                suspendMethod.execute([], context, function (err, callMethodResponse) {
                    if (doDebug) {
                        console.log(" suspendMethod has been called".bgWhite.cyan, err, callMethodResponse.statusCode.toString());
                    }
                    haltMethod.getExecutableFlag(context).should.eql(true);
                    resetMethod.getExecutableFlag(context).should.eql(true);
                    startMethod.getExecutableFlag(context).should.eql(true);
                    suspendMethod.getExecutableFlag(context).should.eql(false);
                    callback(err);
                });
            },

        ], done);
    });

});

