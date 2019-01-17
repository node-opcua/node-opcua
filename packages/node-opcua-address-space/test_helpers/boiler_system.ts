// tslint:disable:no-empty-interface
import { assert } from "node-opcua-assert";
import { StatusCodes } from "node-opcua-constants";
import { NodeClass } from "node-opcua-data-model";
import { CallMethodResult } from "node-opcua-service-call";
import { CallMethodResultOptions } from "node-opcua-types";
import { lowerFirstLetter } from "node-opcua-utils";
import { VariantLike } from "node-opcua-variant";
import {
    AddressSpace,
    BaseNode,
    Folder,
    FolderType,
    InstantiateObjectOptions,
    ProgramFiniteStateMachine,
    ProgramFiniteStateMachineType,
    SessionContext,
    StateMachine, TransitionEventType,
    UAAnalogItem,
    UAMethod,
    UAObject,
    UAObjectType,
    UAReferenceType,
    UAVariable
} from "../source";
import {  promoteToStateMachine } from "../src/state_machine/finite_state_machine";

export interface FlowToReference extends UAReferenceType {
}

export interface HotFlowToReference extends UAReferenceType {
}

export interface SignalToReference extends UAReferenceType {
}

export interface BoilerHaltedEventType extends TransitionEventType {
}

export interface CustomControllerB {
    input1: UAVariable;
    input2: UAVariable;
    input3: UAVariable;
    controlOut: UAVariable;
// conflict here !    description: UAVariable;
}

export interface CustomControllerType extends CustomControllerB, UAObjectType {
}

export interface CustomController extends CustomControllerB, UAObject {
}

export interface GenericSensorB {
    output: UAAnalogItem;
}

export interface GenericSensorType extends GenericSensorB, UAObjectType {
}

export interface GenericSensor extends GenericSensorB, UAObject {
}

export interface GenericControllerB {
    controlOut: UAVariable;
    measurement: UAVariable;
    setPoint: UAVariable;
}

export interface GenericControllerType extends GenericControllerB, UAObjectType {
}

export interface GenericController extends GenericControllerB, UAObject {
}

export interface FlowControllerType extends GenericControllerType {
}

export interface FlowController extends GenericController {
}

export interface LevelControllerType extends GenericControllerType {
}

export interface LevelController extends GenericController {
}

export interface FlowTransmitterType extends GenericSensorType {
}

export interface FlowTransmitter extends GenericSensor {
}

export interface LevelIndicatorType extends GenericSensorType {
}

export interface LevelIndicator extends GenericSensor {
}

export interface GenericActuatorType extends UAObjectType {
    input: UAAnalogItem;
}

export interface GenericActuator extends UAObject {
    input: UAAnalogItem;
}

export interface ValveType extends GenericActuatorType {
}

export interface Valve extends GenericActuator {
}

export interface BoilerInputPipeType extends FolderType {
    ftX001: FlowTransmitter;
    valveX001: Valve;
}

export interface BoilerInputPipe extends Folder {
    ftX001: FlowTransmitter;
    valveX001: Valve;
}

export interface BoilerOutputPipeType extends FolderType {
    ftX002: FlowTransmitter;
}

export interface BoilerOutputPipe extends Folder {
    ftX002: FlowTransmitter;

}

export interface BoilerDrumpType extends FolderType {
    liX001: LevelIndicator;
}

export interface BoilerDrump extends Folder {
    liX001: LevelIndicator;
}

export interface BoilerStateMachineType extends ProgramFiniteStateMachineType {
}

export interface BoilerStateMachine extends ProgramFiniteStateMachine {
}

export interface BoilerType extends UAObjectType {

    ccX001: CustomController;
    fcX001: FlowController;
    lcX001: LevelController;
    pipeX001: BoilerInputPipe;
    drumX001: BoilerDrump;
    pipeX002: BoilerOutputPipe;
    drumX002: BoilerDrump;
    simulation: BoilerStateMachine;

    instantiate(options: InstantiateObjectOptions): Boiler;
}

export interface Boiler extends UAObject {
    ccX001: CustomController;
    fcX001: FlowController;
    lcX001: LevelController;
    pipeX001: BoilerInputPipe;
    drumX001: BoilerDrump;
    pipeX002: BoilerOutputPipe;
    drumX002: BoilerDrump;
    simulation: BoilerStateMachine;
}

function MygetExecutableFlag(method: UAMethod, toState: string, methodName: string) {
    const stateMachineW = promoteToStateMachine(method.parent!);
    return stateMachineW.isValidTransition(toState);
}

function implementProgramStateMachine(programStateMachine: UAObject): void {

    function installMethod(methodName: string, toState: string) {

        let method = programStateMachine.getMethodByName(methodName);

        if (!method) {
            // 'method' has ModellingRule=OptionalPlaceholder and should be created from the type definition
            let methodToClone = programStateMachine.typeDefinitionObj.getMethodByName(methodName);
            if (!methodToClone) {
                methodToClone = programStateMachine.typeDefinitionObj!.subtypeOfObj!.getMethodByName(methodName)!;
            }
            methodToClone.clone({
                componentOf: programStateMachine
            });
            method = programStateMachine.getMethodByName(methodName)!;
            assert(method !== null, "Method clone should cause parent object to be extended");

        }
        assert(method.nodeClass === NodeClass.Method);

        method._getExecutableFlag = function(/* sessionContext: SessionContext */) {
            // must use  a function here to capture 'this'
            return MygetExecutableFlag(this as UAMethod, toState, methodName);
        };

        method.bindMethod(
          function(
            this: UAMethod,
            inputArguments: VariantLike[],
            context: SessionContext,
            callback: (err: Error | null, callMethodResult: CallMethodResultOptions) => void
          ) {
              const stateMachineW = this.parent! as StateMachine;
              // tslint:disable-next-line:no-console
              console.log("Boiler System :  " + methodName + " about to process");
              stateMachineW.setState(toState);
              callback(null, {
                  outputArguments: [],
                  statusCode: StatusCodes.Good,
              });
          });

        assert(programStateMachine.getMethodByName(methodName) !== null,
          "Method " + methodName + " should be added to parent object (checked with getMethodByName)");
        assert(programStateMachine.getComponentByName(methodName) !== null,
          "Component (Method) " + methodName + " should be added to parent object (checked with getComponentByName)");
        const lc_name = lowerFirstLetter(methodName);
    }

    installMethod("Halt", "Halted");
    installMethod("Reset", "Ready");
    installMethod("Start", "Running");
    installMethod("Suspend", "Suspended");
    installMethod("Resume", "Running");
}

function addRelation(
  srcNode: BaseNode,
  referenceType: UAReferenceType | string,
  targetNode: BaseNode
) {
    assert(srcNode, "expecting srcNode !== null");
    assert(targetNode, "expecting targetNode !== null");
    if (typeof referenceType === "string") {
        const nodes = srcNode.findReferencesAsObject(referenceType, true);
        assert(nodes.length === 1);
        referenceType = nodes[0] as UAReferenceType;
    }
    srcNode.addReference({ referenceType: referenceType.nodeId, nodeId: targetNode });
}

// tslint:disable:no-console
export function createBoilerType(addressSpace: AddressSpace): BoilerType {

    const namespace = addressSpace.getOwnNamespace();

    if (namespace.findObjectType("BoilerType")) {
        console.warn("createBoilerType has already been called");
        return namespace.findObjectType("BoilerType") as BoilerType;
    }
    // --------------------------------------------------------
    // referenceTypes
    // --------------------------------------------------------
    // create new reference Type FlowTo HotFlowTo & SignalTo

    const flowTo = namespace.addReferenceType({
        browseName: "FlowTo",
        description: "a reference that indicates a flow between two objects",
        inverseName: "FlowFrom",
        subtypeOf: "NonHierarchicalReferences"
    }) as FlowToReference;

    const hotFlowTo = namespace.addReferenceType({
        browseName: "HotFlowTo",
        description: "a reference that indicates a high temperature flow between two objects",
        inverseName: "HotFlowFrom",
        subtypeOf: flowTo
    }) as HotFlowToReference;

    const signalTo = namespace.addReferenceType({
        browseName: "SignalTo",
        description: "a reference that indicates an electrical signal between two variables",
        inverseName: "SignalFrom",
        subtypeOf: "NonHierarchicalReferences"
    }) as SignalToReference;

    flowTo.isSupertypeOf(addressSpace.findReferenceType("References")!);
    flowTo.isSupertypeOf(addressSpace.findReferenceType("NonHierarchicalReferences")!);
    hotFlowTo.isSupertypeOf(addressSpace.findReferenceType("References")!);
    hotFlowTo.isSupertypeOf(addressSpace.findReferenceType("NonHierarchicalReferences")!);
    hotFlowTo.isSupertypeOf(addressSpace.findReferenceType("1:FlowTo")!);

    const NonHierarchicalReferences = addressSpace.findReferenceType("NonHierarchicalReferences");

    // --------------------------------------------------------
    // EventTypes
    // --------------------------------------------------------
    const boilerHaltedEventType = namespace.addEventType({
        browseName: "BoilerHaltedEventType",
        subtypeOf: "TransitionEventType"
    }) as BoilerHaltedEventType;

    // --------------------------------------------------------
    // CustomControllerType
    // --------------------------------------------------------
    const customControllerType = namespace.addObjectType({
        browseName: "CustomControllerType",
        description: "a custom PID controller with 3 inputs"
    }) as CustomControllerType;

    const input1: UAVariable = namespace.addVariable({
        browseName: "Input1",
        dataType: "Double",
        description: "a reference that indicates an electrical signal between two variables",
        modellingRule: "Mandatory",
        propertyOf: customControllerType,
    });

    const input2: UAVariable = namespace.addVariable({
        browseName: "Input2",
        dataType: "Double",
        modellingRule: "Mandatory",
        propertyOf: customControllerType
    });

    const input3: UAVariable = namespace.addVariable({
        browseName: "Input3",
        dataType: "Double",
        modellingRule: "Mandatory",
        propertyOf: customControllerType
    });

    const controlOut: UAVariable = namespace.addVariable({
        browseName: "ControlOut",
        dataType: "Double",
        modellingRule: "Mandatory",
        propertyOf: customControllerType
    });

    const description: UAVariable = namespace.addVariable({
        browseName: "Description",
        dataType: "LocalizedText",
        modellingRule: "Mandatory",
        propertyOf: customControllerType
    });

    // --------------------------------------------------------
    // GenericSensorType
    // --------------------------------------------------------
    const genericSensorType = namespace.addObjectType({
        browseName: "GenericSensorType"
    });
    namespace.addAnalogDataItem({
        browseName: "Output",
        componentOf: genericSensorType,
        dataType: "Double",
        engineeringUnitsRange: { low: -100, high: 200 },
        modellingRule: "Mandatory"
    });

    genericSensorType.install_extra_properties();

    genericSensorType.getComponentByName("Output");
    assert(genericSensorType.getComponentByName("Output")!.modellingRule === "Mandatory");

    // --------------------------------------------------------
    // GenericSensorType  <---- GenericControllerType
    // --------------------------------------------------------
    const genericControllerType = namespace.addObjectType({
        browseName: "GenericControllerType"
    });
    namespace.addVariable({
        browseName: "ControlOut",
        dataType: "Double",
        modellingRule: "Mandatory",
        propertyOf: genericControllerType
    });
    namespace.addVariable({
        browseName: "Measurement",
        dataType: "Double",
        modellingRule: "Mandatory",
        propertyOf: genericControllerType
    });
    namespace.addVariable({
        browseName: "SetPoint",
        dataType: "Double",
        modellingRule: "Mandatory",
        propertyOf: genericControllerType
    });

    // --------------------------------------------------------------------------------
    // GenericSensorType  <---- GenericControllerType <--- FlowControllerType
    // --------------------------------------------------------------------------------

    const flowControllerType = namespace.addObjectType({
        browseName: "FlowControllerType",
        subtypeOf: genericControllerType
    });

    // --------------------------------------------------------------------------------
    // GenericSensorType  <---- GenericControllerType <--- LevelControllerType
    // --------------------------------------------------------------------------------
    const levelControllerType = namespace.addObjectType({
        browseName: "LevelControllerType",
        subtypeOf: genericControllerType
    });

    // --------------------------------------------------------------------------------
    // GenericSensorType  <---- FlowTransmitterType
    // --------------------------------------------------------------------------------
    const flowTransmitterType = namespace.addObjectType({
        browseName: "FlowTransmitterType",
        subtypeOf: genericSensorType
    });

    // --------------------------------------------------------------------------------
    // GenericSensorType  <---- LevelIndicatorType
    // --------------------------------------------------------------------------------
    const levelIndicatorType = namespace.addObjectType({
        browseName: "LevelIndicatorType",
        subtypeOf: genericSensorType
    });

    // --------------------------------------------------------------------------------
    // GenericActuatorType
    // --------------------------------------------------------------------------------
    const genericActuatorType = namespace.addObjectType({
        browseName: "GenericActuatorType"
    });
    namespace.addAnalogDataItem({
        browseName: "Input",
        componentOf: genericActuatorType,
        dataType: "Double",
        engineeringUnitsRange: { low: -100, high: 200 },
        modellingRule: "Mandatory"
    });

    // --------------------------------------------------------------------------------
    // GenericActuatorType  <---- ValveType
    // --------------------------------------------------------------------------------
    const valveType = namespace.addObjectType({
        browseName: "ValveType",
        subtypeOf: genericActuatorType
    });

    // --------------------------------------------------------------------------------
    // FolderType  <---- BoilerInputPipeType
    // --------------------------------------------------------------------------------
    const boilerInputPipeType = namespace.addObjectType({
        browseName: "BoilerInputPipeType",
        subtypeOf: "FolderType"
    });

    const ftx1 = flowTransmitterType.instantiate({
        browseName: "FTX001",
        componentOf: boilerInputPipeType,
        modellingRule: "Mandatory",
        notifierOf: boilerInputPipeType
    }) as FlowTransmitter;
    assert(ftx1.output.browseName.toString() === "1:Output");

    const valve1 = valveType.instantiate({
        browseName: "ValveX001",
        componentOf: boilerInputPipeType,
        modellingRule: "Mandatory"
    }) as Valve;

    // --------------------------------------------------------------------------------
    // FolderType  <---- BoilerOutputPipeType
    // --------------------------------------------------------------------------------

    const boilerOutputPipeType = namespace.addObjectType({
        browseName: "BoilerOutputPipeType",
        subtypeOf: "FolderType"
    });
    const ftx2 = flowTransmitterType.instantiate({
        browseName: "FTX002",
        componentOf: boilerOutputPipeType,
        modellingRule: "Mandatory",
        notifierOf: boilerOutputPipeType
    }) as FlowTransmitter;

    ftx2.getComponentByName("Output")!.browseName.toString();

    // --------------------------------)------------------------------------------------
    // FolderType  <---- BoilerDrumType
    // --------------------------------------------------------------------------------
    const boilerDrumType = namespace.addObjectType({
        browseName: "BoilerDrumType",
        subtypeOf: "FolderType"
    });

    const levelIndicator = levelIndicatorType.instantiate({
        browseName: "LIX001",
        componentOf: boilerDrumType,
        modellingRule: "Mandatory",
        notifierOf: boilerDrumType
    }) as LevelIndicator;

    const programFiniteStateMachineType: ProgramFiniteStateMachineType =
      addressSpace.findObjectType("ProgramStateMachineType")! as ProgramFiniteStateMachineType;

    // --------------------------------------------------------
    // define boiler State Machine
    // --------------------------------------------------------
    const boilerStateMachineType = namespace.addObjectType({
        browseName: "BoilerStateMachineType",
        postInstantiateFunc: implementProgramStateMachine,
        subtypeOf: programFiniteStateMachineType!,
    }) as BoilerStateMachineType;

    // programStateMachineType has Optional placeHolder for method "Halt", "Reset","Start","Suspend","Resume")

    function addMethod(
      baseType: UAObjectType,
      objectType: UAObjectType,
      methodName: string
    ) {
        assert(!objectType.getMethodByName(methodName));
        const method = baseType.getMethodByName(methodName)!;
        const m = method.clone({
            componentOf: objectType,
            modellingRule: "Mandatory"
        });
        assert(objectType.getMethodByName(methodName));
        assert(objectType.getMethodByName(methodName)!.modellingRule === "Mandatory");
    }

    addMethod(programFiniteStateMachineType, boilerStateMachineType, "Halt");
    addMethod(programFiniteStateMachineType, boilerStateMachineType, "Reset");
    addMethod(programFiniteStateMachineType, boilerStateMachineType, "Start");
    addMethod(programFiniteStateMachineType, boilerStateMachineType, "Suspend");
    addMethod(programFiniteStateMachineType, boilerStateMachineType, "Resume");

    // --------------------------------------------------------------------------------
    // BoilerType
    // --------------------------------------------------------------------------------
    const boilerType = namespace.addObjectType({
        browseName: "BoilerType"
    }) as BoilerType;

    // BoilerType.CCX001 (CustomControllerType)
    const ccX001 = customControllerType.instantiate({
        browseName: "CCX001",
        componentOf: boilerType,
        modellingRule: "Mandatory"
    }) as CustomController;

    // BoilerType.FCX001 (FlowController)
    const fcX001 = flowControllerType.instantiate({
        browseName: "FCX001",
        componentOf: boilerType,
        modellingRule: "Mandatory"
    }) as FlowController;

    // BoilerType.LCX001 (LevelControllerType)
    const lcX001 = levelControllerType.instantiate({
        browseName: "LCX001",
        componentOf: boilerType,
        modellingRule: "Mandatory"
    }) as LevelController;

    // BoilerType.PipeX001 (BoilerInputPipeType)
    const pipeX001 = boilerInputPipeType.instantiate({
        browseName: "PipeX001",
        componentOf: boilerType,
        modellingRule: "Mandatory",
        notifierOf: boilerType
    }) as BoilerInputPipe;

    // BoilerType.DrumX001 (BoilerDrumType)
    const drumx001 = boilerDrumType.instantiate({
        browseName: "DrumX001",
        componentOf: boilerType,
        modellingRule: "Mandatory",
        notifierOf: boilerType
    }) as BoilerDrump;

    // BoilerType.PipeX002 (BoilerOutputPipeType)
    const pipeX002 = boilerOutputPipeType.instantiate({
        browseName: "PipeX002",
        componentOf: boilerType,
        modellingRule: "Mandatory",
        notifierOf: boilerType
    }) as BoilerOutputPipe;

    // BoilerType.Simulation (BoilerStateMachineType)
    const simulation = boilerStateMachineType.instantiate({
        browseName: "Simulation",
        componentOf: boilerType,
        eventSourceOf: boilerType,
        modellingRule: "Mandatory",
    }) as BoilerStateMachine;

    addRelation(pipeX001, flowTo, drumx001);
    addRelation(drumx001, hotFlowTo, pipeX002);

    assert(boilerType.pipeX001.ftX001);
    assert(boilerType.pipeX001.ftX001.output);
    assert(boilerType.fcX001.measurement);

    addRelation(boilerType.pipeX001.ftX001.output, signalTo, boilerType.fcX001.measurement);
    addRelation(boilerType.pipeX001.ftX001.output, signalTo, boilerType.ccX001.input2);
    addRelation(boilerType.fcX001.controlOut, signalTo, boilerType.pipeX001.valveX001.input);

    // indicates that the level controller gets its measurement from the drum's level indicator.
    addRelation(boilerType.drumX001.liX001.output, signalTo, boilerType.lcX001.measurement);

    addRelation(boilerType.pipeX002.ftX002.output, signalTo, boilerType.ccX001.input3);

    addRelation(boilerType.lcX001.controlOut, signalTo, boilerType.ccX001.input1);

    addRelation(boilerType.ccX001.controlOut, signalTo, boilerType.fcX001.setPoint);

    return boilerType;
}

export function makeBoiler(
  addressSpace: AddressSpace,
  options: {
      browseName: string,
      organizedBy: BaseNode
  }
): Boiler {

    const namespace = addressSpace.getOwnNamespace();

    assert(options);
    let boilerType: UAObjectType | null;
    boilerType = namespace.findObjectType("BoilerType");

    if (!boilerType) {
        createBoilerType(addressSpace);
        boilerType = namespace.findObjectType("BoilerType")!;
    }
    // now instantiate boiler
    const boiler1 = boilerType.instantiate({
        browseName: options.browseName,
        organizedBy: addressSpace.rootFolder.objects
    }) as Boiler;

    promoteToStateMachine(boiler1.simulation);

    const boilerStateMachine = boiler1.simulation;

    const haltedState = boilerStateMachine.getStateByName("Halted")!;
    assert(haltedState.browseName.toString() === "Halted");

    const readyState = boilerStateMachine.getStateByName("Ready")!;
    assert(readyState.browseName.toString() === "Ready");

    const runningState = boilerStateMachine.getStateByName("Running")!;
    assert(runningState.browseName.toString() === "Running");

    // when state is "Halted" , the Halt method is not executable
    boilerStateMachine.setState(haltedState);
    assert(boilerStateMachine.currentStateNode.browseName.toString() === "Halted");

    const context = SessionContext.defaultContext;
    // halt method should not be executable when current State is Halted
    assert(!boilerStateMachine.halt.getExecutableFlag(context));

    // when state is "Reset" , the Halt method becomes executable
    boilerStateMachine.setState(readyState);
    assert(boilerStateMachine.halt.getExecutableFlag(context));

    return boiler1;
}
