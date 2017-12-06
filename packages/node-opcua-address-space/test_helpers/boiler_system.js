"use strict";
// see ftp://ftp.nist.gov/pub/mel/michalos/Software/OPC%20UA%20Companion/InformationModel.pdf

var _ = require("underscore");
var assert = require("node-opcua-assert");

var UAMethod = require("..").UAMethod;
var UAObject = require("..").UAObject;
var UAStateMachine = require("..").UAStateMachine;
var context = require("..").SessionContext.defaultContext;

function MygetExecutableFlag(toState,methodName) {
    assert(_.isString(toState));
    assert(this instanceof UAMethod);
    var stateMachineW = UAStateMachine.promote(this.parent);
    return stateMachineW.isValidTransition(toState);
}

function implementProgramStateMachine(programStateMachine) {

    assert(programStateMachine instanceof UAObject);

    function installMethod(methodName, toState) {

        var method = programStateMachine.getMethodByName(methodName);
        assert(method instanceof UAMethod);
        method._getExecutableFlag = function (context) {
            return MygetExecutableFlag.call(this, toState,methodName);
        };

        method.bindMethod(function (inputArguments, context, callback) {

            var stateMachineW = UAStateMachine.promote(this.parent);
            //xx console.log("Hello World ! I will " + methodName + " the process");
            stateMachineW.setState(toState);
            callback();
        });
    }

    installMethod("Halt", "Halted");
    installMethod("Reset", "Ready");
    installMethod("Start", "Running");
    installMethod("Suspend", "Suspended");
    installMethod("Resume", "Running");
}

function addRelation(srcNode,referenceType, targetNode) {
    //xx assert( referenceType instanceof ReferenceType);
    assert( srcNode, "expecting srcNode !== null");
    assert( targetNode, "expecting targetNode !== null");
    if(typeof referenceType === "string") {
        var nodes = srcNode.findReferencesAsObject(referenceType,true);
        assert(nodes.length === 1);
        referenceType = nodes[0];
    }
    srcNode.addReference( { referenceType: referenceType.nodeId, nodeId: targetNode });
}

exports.createBoilerType = function (addressSpace) {


    // --------------------------------------------------------
    // referenceTypes
    // --------------------------------------------------------
    // create new reference Type FlowTo HotFlowTo & SignalTo

    var flowTo = addressSpace.addReferenceType({
        browseName:"FlowTo",
        inverseName:"FlowFrom",
        subtypeOf: "NonHierarchicalReferences",
        description: "a reference that indicates a flow between two objects"
    });


    var hotFlowTo = addressSpace.addReferenceType({
        browseName:"HotFlowTo",
        inverseName:"HotFlowFrom",
        subtypeOf:  flowTo,
        description: "a reference that indicates a high temperature flow between two objects"
    });

    var signalTo = addressSpace.addReferenceType({
        browseName:"SignalTo",
        inverseName:"SignalFrom",
        subtypeOf: "NonHierarchicalReferences",
        description: "a reference that indicates an electrical signal between two variables"
    });

    flowTo.isSupertypeOf(addressSpace.findReferenceType("References"));
    flowTo.isSupertypeOf(addressSpace.findReferenceType("NonHierarchicalReferences"));
    hotFlowTo.isSupertypeOf(addressSpace.findReferenceType("References"));
    hotFlowTo.isSupertypeOf(addressSpace.findReferenceType("NonHierarchicalReferences"));
    hotFlowTo.isSupertypeOf(addressSpace.findReferenceType("FlowTo"));

    var NonHierarchicalReferences = addressSpace.findReferenceType("NonHierarchicalReferences");

    var r = addressSpace.findReferenceType("References").getSubtypeIndex();
    assert(Object.keys(r).indexOf("HotFlowTo") >= 0);

    // --------------------------------------------------------
    // EventTypes
    // --------------------------------------------------------
    var boilerHaltedEventType = addressSpace.addEventType({
        browseName: "BoilerHaltedEventType",
        subTypeof: "TransitionEventType"
    });



    // --------------------------------------------------------
    // CustomControllerType
    // --------------------------------------------------------
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



    // --------------------------------------------------------
    // GenericSensorType
    // --------------------------------------------------------
    var genericSensorType = addressSpace.addObjectType({
        browseName: "GenericSensorType"
    });
    addressSpace.addAnalogDataItem({
        componentOf: genericSensorType,
        modellingRule: "Mandatory",
        browseName:    "Output",
        dataType: "Double",
        engineeringUnitsRange: {low: -100, high: 200}
    });

    // --------------------------------------------------------
    // GenericSensorType  <---- GenericControllerType
    // --------------------------------------------------------
    var genericControllerType = addressSpace.addObjectType({
        browseName: "GenericControllerType"
    });
    addressSpace.addVariable({
        propertyOf: genericControllerType,
        browseName: "ControlOut",
        dataType: "Double",
        modellingRule: "Mandatory"
    });
    addressSpace.addVariable({
        propertyOf: genericControllerType,
        browseName: "Measurement",
        dataType: "Double",
        modellingRule: "Mandatory"
    });
    addressSpace.addVariable({
        propertyOf: genericControllerType,
        browseName: "SetPoint",
        dataType: "Double",
        modellingRule: "Mandatory"
    });

    // --------------------------------------------------------------------------------
    // GenericSensorType  <---- GenericControllerType <--- FlowControllerType
    // --------------------------------------------------------------------------------

    var flowControllerType = addressSpace.addObjectType({
        browseName: "FlowControllerType",
        subtypeOf: genericControllerType
    });


    // --------------------------------------------------------------------------------
    // GenericSensorType  <---- GenericControllerType <--- LevelControllerType
    // --------------------------------------------------------------------------------
    var levelControllerType = addressSpace.addObjectType({
        browseName: "LevelControllerType",
        subtypeOf: genericControllerType
    });


    // --------------------------------------------------------------------------------
    // GenericSensorType  <---- FlowTransmitterType
    // --------------------------------------------------------------------------------
    var flowTransmitterType = addressSpace.addObjectType({
        browseName: "FlowTransmitterType",
        subtypeOf: genericSensorType
    });

    // --------------------------------------------------------------------------------
    // GenericSensorType  <---- LevelIndicatorType
    // --------------------------------------------------------------------------------
    var levelIndicatorType = addressSpace.addObjectType({
        browseName: "LevelIndicatorType",
        subtypeOf: genericSensorType
    });

    // --------------------------------------------------------------------------------
    // GenericActuatorType
    // --------------------------------------------------------------------------------
    var genericActuatorType = addressSpace.addObjectType({
        browseName: "GenericActuatorType"
    });
    addressSpace.addAnalogDataItem({
        componentOf: genericActuatorType,
        modellingRule: "Mandatory",
        browseName: "Input",
        dataType: "Double",
        engineeringUnitsRange: {low: -100, high: 200}
    });


    // --------------------------------------------------------------------------------
    // GenericActuatorType  <---- ValveType
    // --------------------------------------------------------------------------------
    var valveType = addressSpace.addObjectType({
        browseName: "ValveType",
        subtypeOf: genericActuatorType
    });



    // --------------------------------------------------------------------------------
    // FolderType  <---- BoilerInputPipeType
    // --------------------------------------------------------------------------------
    var boilerInputPipeType = addressSpace.addObjectType({
        browseName: "BoilerInputPipeType",
        subtypeOf: "FolderType"
    });

    flowTransmitterType.instantiate({
        browseName: "FTX001",
        componentOf: boilerInputPipeType,
        modellingRule: "Mandatory",
        notifierOf: boilerInputPipeType
    });

    valveType.instantiate({
        browseName: "ValveX001",
        componentOf: boilerInputPipeType,
        modellingRule: "Mandatory"
    });

    // --------------------------------------------------------------------------------
    // FolderType  <---- BoilerOutputPipeType
    // --------------------------------------------------------------------------------

    var boilerOutputPipeType = addressSpace.addObjectType({
        browseName: "BoilerOutputPipeType",
        subtypeOf: "FolderType",
        //xx hasNotifer: flowTransmitterType
    });
    flowTransmitterType.instantiate({
        browseName: "FTX002",
        componentOf: boilerOutputPipeType,
        modellingRule: "Mandatory",
        notifierOf: boilerOutputPipeType
    });


    // --------------------------------)------------------------------------------------
    // FolderType  <---- BoilerDrumType
    // --------------------------------------------------------------------------------
    var boilerDrumType = addressSpace.addObjectType({
        browseName: "BoilerDrumType",
        subtypeOf: "FolderType"
    });
    levelIndicatorType.instantiate({
        browseName: "LIX001",
        componentOf: boilerDrumType,
        modellingRule: "Mandatory",
        notifierOf: boilerDrumType
    });

    //xx assert(boilerDrumType.getNotifiers().map(function(x){ return x.browseName.toString();}).join("").indexOf("LIX001") >=0);

    // --------------------------------------------------------
    // define boiler State Machine
    // --------------------------------------------------------
    var boilerStateMachineType = addressSpace.addObjectType({
        browseName: "BoilerStateMachineType",
        subtypeOf: "ProgramStateMachineType",
        postInstantiateFunc: implementProgramStateMachine
    });

    // --------------------------------------------------------------------------------
    // BoilerType
    // --------------------------------------------------------------------------------
    var boilerType = addressSpace.addObjectType({
        browseName: "BoilerType"
    });

    // BoilerType.CCX001 (CustomControllerType)
    var ccX001 = customControllerType.instantiate({
        browseName: "CCX001",
        componentOf: boilerType,
        modellingRule: "Mandatory"
    });

    boilerType.install_extra_properties();
    assert(boilerType.ccX001);

    // BoilerType.FCX001 (FlowController)
    var FCX001 = flowControllerType.instantiate({
        browseName: "FCX001",
        componentOf: boilerType,
        modellingRule: "Mandatory"
    });

    // BoilerType.LCX001 (LevelControllerType)
    var lcX001 = levelControllerType.instantiate({
        browseName: "LCX001",
        componentOf: boilerType,
        modellingRule: "Mandatory"
    });

    // BoilerType.PipeX001 (BoilerInputPipeType)
    var pipeX001 = boilerInputPipeType.instantiate({
        browseName: "PipeX001",
        componentOf: boilerType,
        modellingRule: "Mandatory",
        notifierOf: boilerType
    });

    // BoilerType.DrumX001 (BoilerDrumType)
    var drumx001 = boilerDrumType.instantiate({
        browseName: "DrumX001",
        componentOf: boilerType,
        modellingRule: "Mandatory",
        notifierOf: boilerType
    });


    // BoilerType.PipeX002 (BoilerOutputPipeType)
    var pipeX002 = boilerOutputPipeType.instantiate({
        browseName: "PipeX002",
        componentOf: boilerType,
        modellingRule: "Mandatory",
        notifierOf: boilerType
    });

    // BoilerType.Simulation (BoilerStateMachineType)
    var simulation = boilerStateMachineType.instantiate({
        browseName: "Simulation",
        componentOf: boilerType,
        modellingRule: "Mandatory",
        eventSourceOf: boilerType
    });

    addRelation(pipeX001,               flowTo,    drumx001);
    addRelation(drumx001,               hotFlowTo, pipeX002);


    assert(boilerType.pipeX001.ftX001.output);
    assert(boilerType.fcX001.measurement);

    addRelation( boilerType.pipeX001.ftX001.output, signalTo, boilerType.fcX001.measurement       );
    addRelation( boilerType.pipeX001.ftX001.output, signalTo, boilerType.ccX001.input2            );
    addRelation( boilerType.fcX001.controlOut     , signalTo, boilerType.pipeX001.valveX001.input );

    // indicates that the level controller gets its measurement from the drum's level indicator.
    addRelation( boilerType.drumX001.liX001.output, signalTo, boilerType.lcX001.measurement );

    addRelation( boilerType.pipeX002.ftX002.output, signalTo, boilerType.ccX001.input3);

    addRelation( boilerType.lcX001.controlOut     , signalTo, boilerType.ccX001.input1);

    addRelation( boilerType.ccX001.controlOut     , signalTo, boilerType.fcX001.setPoint);


    return boilerType;

};

exports.makeBoiler = function makeBoiler(addressSpace, options) {

    //xx assert( addressSpace instanceof AddressSpace);
    assert(options);
    var boilerType = addressSpace.findObjectType("BoilerType");

    if (!boilerType) {
        boilerType = exports.createBoilerType(addressSpace);
    }
    // now instantiate boiler
    var boiler1 = boilerType.instantiate({
        browseName: options.browseName,
        organizedBy: addressSpace.rootFolder.objects
    });

    Object.setPrototypeOf(boiler1.simulation,UAStateMachine.prototype);
    var boilerStateMachine = boiler1.simulation;

    var haltedState = boilerStateMachine.getStateByName("Halted");
    assert(haltedState.browseName.toString() === "Halted");

    var readyState = boilerStateMachine.getStateByName("Ready");
    assert(readyState.browseName.toString() === "Ready");

    var runningState = boilerStateMachine.getStateByName("Running");
    assert(runningState.browseName.toString() === "Running");


    // when state is "Halted" , the Halt method is not executable
    boilerStateMachine.setState(haltedState);
    assert(boilerStateMachine.currentStateNode.browseName.toString() === "Halted");

    assert(!boilerStateMachine.halt.getExecutableFlag(context));

    // when state is "Reset" , the Halt method is  executable
    boilerStateMachine.setState(readyState);
    assert(boilerStateMachine.halt.getExecutableFlag(context));

    return boiler1;
};

