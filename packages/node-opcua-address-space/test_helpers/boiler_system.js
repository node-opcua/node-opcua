"use strict";
// see ftp://ftp.nist.gov/pub/mel/michalos/Software/OPC%20UA%20Companion/InformationModel.pdf

const _ = require("underscore");
const assert = require("node-opcua-assert").assert;

const UAMethod = require("..").UAMethod;
const UAObject = require("..").UAObject;
const UAStateMachine = require("..").UAStateMachine;
const context = require("..").SessionContext.defaultContext;

function MygetExecutableFlag(toState,methodName) {
    assert(_.isString(toState));
    assert(this instanceof UAMethod);
    const stateMachineW = UAStateMachine.promote(this.parent);
    return stateMachineW.isValidTransition(toState);
}

function implementProgramStateMachine(programStateMachine) {

    assert(programStateMachine instanceof UAObject);

    function installMethod(methodName, toState) {

        const method = programStateMachine.getMethodByName(methodName);
        assert(method instanceof UAMethod);
        method._getExecutableFlag = function (context) {
            return MygetExecutableFlag.call(this, toState,methodName);
        };

        method.bindMethod(function (inputArguments, context, callback) {

            const stateMachineW = UAStateMachine.promote(this.parent);
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
        const nodes = srcNode.findReferencesAsObject(referenceType,true);
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

    const flowTo = addressSpace.addReferenceType({
        browseName:"FlowTo",
        inverseName:"FlowFrom",
        subtypeOf: "NonHierarchicalReferences",
        description: "a reference that indicates a flow between two objects"
    });


    const hotFlowTo = addressSpace.addReferenceType({
        browseName:"HotFlowTo",
        inverseName:"HotFlowFrom",
        subtypeOf:  flowTo,
        description: "a reference that indicates a high temperature flow between two objects"
    });

    const signalTo = addressSpace.addReferenceType({
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

    const NonHierarchicalReferences = addressSpace.findReferenceType("NonHierarchicalReferences");

    const r = addressSpace.findReferenceType("References").getSubtypeIndex();
    assert(Object.keys(r).indexOf("HotFlowTo") >= 0);

    // --------------------------------------------------------
    // EventTypes
    // --------------------------------------------------------
    const boilerHaltedEventType = addressSpace.addEventType({
        browseName: "BoilerHaltedEventType",
        subTypeof: "TransitionEventType"
    });



    // --------------------------------------------------------
    // CustomControllerType
    // --------------------------------------------------------
    const customControllerType = addressSpace.addObjectType({
        browseName: "CustomControllerType",
        description: "a custom PID controller with 3 inputs"
    });

    const input1 = addressSpace.addVariable({
        browseName: "Input1",
        propertyOf: customControllerType,
        dataType: "Double",
        modellingRule: "Mandatory"
    });

    const input2 = addressSpace.addVariable({
        browseName: "Input2",
        propertyOf: customControllerType,
        dataType: "Double",
        modellingRule: "Mandatory"
    });

    const input3 = addressSpace.addVariable({
        browseName: "Input3",
        propertyOf: customControllerType,
        dataType: "Double",
        modellingRule: "Mandatory"
    });

    const controlOut = addressSpace.addVariable({
        browseName: "ControlOut",
        propertyOf: customControllerType,
        dataType: "Double",
        modellingRule: "Mandatory"
    });

    const description = addressSpace.addVariable({
        browseName: "Description",
        propertyOf: customControllerType,
        dataType: "LocalizedText",
        modellingRule: "Mandatory"
    });



    // --------------------------------------------------------
    // GenericSensorType
    // --------------------------------------------------------
    const genericSensorType = addressSpace.addObjectType({
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
    const genericControllerType = addressSpace.addObjectType({
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

    const flowControllerType = addressSpace.addObjectType({
        browseName: "FlowControllerType",
        subtypeOf: genericControllerType
    });


    // --------------------------------------------------------------------------------
    // GenericSensorType  <---- GenericControllerType <--- LevelControllerType
    // --------------------------------------------------------------------------------
    const levelControllerType = addressSpace.addObjectType({
        browseName: "LevelControllerType",
        subtypeOf: genericControllerType
    });


    // --------------------------------------------------------------------------------
    // GenericSensorType  <---- FlowTransmitterType
    // --------------------------------------------------------------------------------
    const flowTransmitterType = addressSpace.addObjectType({
        browseName: "FlowTransmitterType",
        subtypeOf: genericSensorType
    });

    // --------------------------------------------------------------------------------
    // GenericSensorType  <---- LevelIndicatorType
    // --------------------------------------------------------------------------------
    const levelIndicatorType = addressSpace.addObjectType({
        browseName: "LevelIndicatorType",
        subtypeOf: genericSensorType
    });

    // --------------------------------------------------------------------------------
    // GenericActuatorType
    // --------------------------------------------------------------------------------
    const genericActuatorType = addressSpace.addObjectType({
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
    const valveType = addressSpace.addObjectType({
        browseName: "ValveType",
        subtypeOf: genericActuatorType
    });



    // --------------------------------------------------------------------------------
    // FolderType  <---- BoilerInputPipeType
    // --------------------------------------------------------------------------------
    const boilerInputPipeType = addressSpace.addObjectType({
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

    const boilerOutputPipeType = addressSpace.addObjectType({
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
    const boilerDrumType = addressSpace.addObjectType({
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
    const boilerStateMachineType = addressSpace.addObjectType({
        browseName: "BoilerStateMachineType",
        subtypeOf: "ProgramStateMachineType",
        postInstantiateFunc: implementProgramStateMachine
    });

    // --------------------------------------------------------------------------------
    // BoilerType
    // --------------------------------------------------------------------------------
    const boilerType = addressSpace.addObjectType({
        browseName: "BoilerType"
    });

    // BoilerType.CCX001 (CustomControllerType)
    const ccX001 = customControllerType.instantiate({
        browseName: "CCX001",
        componentOf: boilerType,
        modellingRule: "Mandatory"
    });

    boilerType.install_extra_properties();
    assert(boilerType.ccX001);

    // BoilerType.FCX001 (FlowController)
    const FCX001 = flowControllerType.instantiate({
        browseName: "FCX001",
        componentOf: boilerType,
        modellingRule: "Mandatory"
    });

    // BoilerType.LCX001 (LevelControllerType)
    const lcX001 = levelControllerType.instantiate({
        browseName: "LCX001",
        componentOf: boilerType,
        modellingRule: "Mandatory"
    });

    // BoilerType.PipeX001 (BoilerInputPipeType)
    const pipeX001 = boilerInputPipeType.instantiate({
        browseName: "PipeX001",
        componentOf: boilerType,
        modellingRule: "Mandatory",
        notifierOf: boilerType
    });

    // BoilerType.DrumX001 (BoilerDrumType)
    const drumx001 = boilerDrumType.instantiate({
        browseName: "DrumX001",
        componentOf: boilerType,
        modellingRule: "Mandatory",
        notifierOf: boilerType
    });


    // BoilerType.PipeX002 (BoilerOutputPipeType)
    const pipeX002 = boilerOutputPipeType.instantiate({
        browseName: "PipeX002",
        componentOf: boilerType,
        modellingRule: "Mandatory",
        notifierOf: boilerType
    });

    // BoilerType.Simulation (BoilerStateMachineType)
    const simulation = boilerStateMachineType.instantiate({
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
    let boilerType = addressSpace.findObjectType("BoilerType");

    if (!boilerType) {
        boilerType = exports.createBoilerType(addressSpace);
    }
    // now instantiate boiler
    const boiler1 = boilerType.instantiate({
        browseName: options.browseName,
        organizedBy: addressSpace.rootFolder.objects
    });

    Object.setPrototypeOf(boiler1.simulation,UAStateMachine.prototype);
    const boilerStateMachine = boiler1.simulation;

    const haltedState = boilerStateMachine.getStateByName("Halted");
    assert(haltedState.browseName.toString() === "Halted");

    const readyState = boilerStateMachine.getStateByName("Ready");
    assert(readyState.browseName.toString() === "Ready");

    const runningState = boilerStateMachine.getStateByName("Running");
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

