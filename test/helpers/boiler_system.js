"use strict";

require("requirish")._(module);
var _ = require("underscore");
var assert = require("better-assert");
var should = require("should");


var opcua = require("index.js");
var StatusCodes = opcua.StatusCodes;
var Variant = opcua.Variant;
var DataType = opcua.DataType;
var DataValue = opcua.DataValue;
var standardUnits = opcua.standardUnits;

var UAMethod = require("lib/address_space/ua_method").UAMethod;
var UAObject = require("lib/address_space/ua_object").UAObject;

var UAStateMachine = require("lib/address_space/statemachine_wrapper").UAStateMachine;


function MygetExecutableFlag(toState) {
    assert(_.isString(toState));
    assert(this instanceof UAMethod);
    var stateMachineW = new UAStateMachine(this.parent);
    return stateMachineW.isValidTransition(toState);
}

function implementProgramStateMachine(programStateMachine) {

    assert(programStateMachine instanceof UAObject);
    function installMethod(methodName,toState) {

        var method = programStateMachine.getMethodByName(methodName);
        assert( method instanceof UAMethod);
        method._getExecutableFlag = function() { return MygetExecutableFlag.call(this,toState); };
        method.bindMethod(function (inputArguments, context, callback) {
            var stateMachineW = new UAStateMachine(this.parent);
            console.log("Hello World ! I will " + methodName + " the process");
            stateMachineW.setState(toState);
            callback();
        });
    }
    installMethod("Halt",   "Halted");
    installMethod("Reset",  "Ready");
    installMethod("Start",  "Running");
    installMethod("Suspend","Suspended");
    installMethod("Resume", "Running");
}

exports.createBoilerType = function(addressSpace) {


    var boilerHaltedEventType =  addressSpace.addEventType({
        browseName: "BoilerHaltedEventType"
    });

    // define boiler State Machine
    var boilerStateMachineType  =addressSpace.addObjectType({
        browseName: "BoilerStateMachineType",
        subtypeOf: "ProgramStateMachineType",
        postInstantiateFunc: implementProgramStateMachine
    });

    var customControllerType = addressSpace.addObjectType({
        browseName: "CustomControllerType",
        description: "a custom PID controller with 3 inputs"
    });

    var input1 = addressSpace.addVariable({
        browseName: "Input1",
        propertyOf: customControllerType,
        dataType: "Double",
        modellingRule: "Mandatory"
    });

    var input2 = addressSpace.addVariable({
        browseName: "Input2",
        propertyOf: customControllerType,
        dataType: "Double",
        modellingRule: "Mandatory"
    });

    var input3 = addressSpace.addVariable({
        browseName: "Input3",
        propertyOf: customControllerType,
        dataType: "Double",
        modellingRule: "Mandatory"
    });

    var controlOut = addressSpace.addVariable({
        browseName: "ControlOut",
        propertyOf: customControllerType,
        dataType: "Double",
        modellingRule: "Mandatory"
    });

    var description = addressSpace.addVariable({
        browseName: "Description",
        propertyOf: customControllerType,
        dataType: "LocalizedText",
        modellingRule: "Mandatory"
    });

    var boilerType = addressSpace.addObjectType({
        browseName: "BoilerType"
    });

    var ccx001 = customControllerType.instantiate({
        browseName: "CCX0001",
        componentOf: boilerType,
        modellingRule: "Mandatory"
    });

    var simulation = boilerStateMachineType.instantiate({
        browseName: "Simulation",
        componentOf: boilerType,
        modellingRule: "Mandatory"
    });

    return boilerType;

};

exports.makeBoiler = function(addressSpace,options) {

    var boilerType = addressSpace.findObjectType("BoilerType");

    if (!boilerType) {
        boilerType = exports.createBoilerType(addressSpace);
    }
    // now instantiate boiler
    var boiler1 = boilerType.instantiate({
        browseName : options.browseName,
        organizedBy: addressSpace.rootFolder.objects
    });


    var boilerStateMachine = new UAStateMachine(boiler1.simulation);

    var haltedState =boilerStateMachine.getStateByName("Halted");
    assert(haltedState.browseName.toString() === "Halted");

    var readyState =boilerStateMachine.getStateByName("Ready");
    assert(readyState.browseName.toString() === "Ready");

    var runningState =boilerStateMachine.getStateByName("Running");
    assert(runningState.browseName.toString() === "Running");


    // when state is "Halted" , the Halt method is not executable
    boilerStateMachine.setState(haltedState);
    boilerStateMachine.currentStateNode.browseName.toString().should.eql("Halted");

    boilerStateMachine.node.halt.getExecutableFlag().should.eql(false);

    // when state is "Reset" , the Halt method is  executable
    boilerStateMachine.setState(readyState);
    boilerStateMachine.node.halt.getExecutableFlag().should.eql(true);

    return boiler1;
};

