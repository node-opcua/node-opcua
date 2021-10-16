/* eslint-disable max-statements */
/**
 * @module node-opcua-address-space
 */
import { assert } from "node-opcua-assert";
import { NodeClass } from "node-opcua-data-model";
import { StatusCodes } from "node-opcua-status-code";
import { CallMethodResultOptions } from "node-opcua-types";
import { lowerFirstLetter } from "node-opcua-utils";
import { VariantLike, DataType } from "node-opcua-variant";
import { UAFolder, UAAnalogItem } from "node-opcua-nodeset-ua";
import {
    AddressSpace,
    BaseNode,
    InstantiateObjectOptions,
    Namespace,
    UATransitionEventType,
    UAMethod,
    UAObject,
    UAObjectType,
    UAReferenceType,
    UAVariable,
    promoteToStateMachine,
    ISessionContext,
    UAProgramStateMachineEx
} from "..";

import { UAStateMachineImpl } from "../src/state_machine/finite_state_machine";

export interface FlowToReference extends UAReferenceType {}

export interface HotFlowToReference extends UAReferenceType {}

export interface SignalToReference extends UAReferenceType {}

export interface BoilerHaltedEventType extends UATransitionEventType {}

export interface CustomControllerB {
    input1: UAVariable;
    input2: UAVariable;
    input3: UAVariable;
    controlOut: UAVariable;
    // conflict here !    description: UAVariable;
}

export interface CustomControllerType extends CustomControllerB, UAObjectType {}

export interface CustomController extends CustomControllerB, UAObject {}

export interface GenericSensorB {
    output: UAAnalogItem<number, DataType.Double>;
}

export interface GenericSensorType extends GenericSensorB, UAObjectType {}

export interface GenericSensor extends GenericSensorB, UAObject {}

export interface GenericControllerB {
    controlOut: UAVariable;
    measurement: UAVariable;
    setPoint: UAVariable;
}

export interface GenericControllerType extends GenericControllerB, UAObjectType {}

export interface GenericController extends GenericControllerB, UAObject {}

export interface FlowControllerType extends GenericControllerType {}

export interface FlowController extends GenericController {}

export interface LevelControllerType extends GenericControllerType {}

export interface LevelController extends GenericController {}

export interface FlowTransmitterType extends GenericSensorType {}

export interface FlowTransmitter extends GenericSensor {}

export interface LevelIndicatorType extends GenericSensorType {}

export interface LevelIndicator extends GenericSensor {}

export interface GenericActuatorType extends UAObjectType {
    input: UAAnalogItem<number, DataType.Double>;
}

export interface GenericActuator extends UAObject {
    input: UAAnalogItem<number, DataType.Double>;
}

export interface ValveType extends GenericActuatorType {}

export interface Valve extends GenericActuator {}

export interface BoilerInputPipeType extends UAObjectType {
    flowTransmitter: FlowTransmitter;
    valve: Valve;
}

export interface BoilerInputPipe extends UAFolder {
    flowTransmitter: FlowTransmitter;
    valve: Valve;
}

export interface BoilerOutputPipeType extends UAObjectType {
    flowTransmitter: FlowTransmitter;
}

export interface BoilerOutputPipe extends UAFolder {
    flowTransmitter: FlowTransmitter;
}

export interface BoilerDrumType extends UAObjectType {
    levelIndicator: LevelIndicator;
}

export interface BoilerDrum extends UAFolder {
    levelIndicator: LevelIndicator;
}

export interface BoilerStateMachineType extends UAObjectType {}

export interface BoilerStateMachine extends UAObject, UAProgramStateMachineEx {}

export interface BoilerType extends UAObjectType {
    customController: CustomController;
    flowController: FlowController;
    levelController: LevelController;
    inputPipe: BoilerInputPipe;
    boilerDrum: BoilerDrum;
    outputPipe: BoilerOutputPipe;
    boilerDrum2: BoilerDrum;
    simulation: BoilerStateMachine;

    instantiate(options: InstantiateObjectOptions): Boiler;
}

export interface Boiler extends UAObject {
    customController: CustomController;
    flowController: FlowController;
    levelController: LevelController;
    inputPipe: BoilerInputPipe;
    boilerDrum: BoilerDrum;
    outputPipe: BoilerOutputPipe;
    boilerDrum2: BoilerDrum;
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
                namespace: programStateMachine.namespace,
                componentOf: programStateMachine
            });
            method = programStateMachine.getMethodByName(methodName)!;
            assert(method !== null, "Method clone should cause parent object to be extended");
        }
        assert(method.nodeClass === NodeClass.Method);

        method._getExecutableFlag = function (/* sessionContext: SessionContext */) {
            // must use  a function here to capture 'this'
            return MygetExecutableFlag(this as UAMethod, toState, methodName);
        };

        method.bindMethod(function (
            this: UAMethod,
            inputArguments: VariantLike[],
            context: ISessionContext,
            callback: (err: Error | null, callMethodResult: CallMethodResultOptions) => void
        ) {
            const stateMachineW = this.parent! as UAStateMachineImpl;
            stateMachineW.setState(toState);
            callback(null, {
                outputArguments: [],
                statusCode: StatusCodes.Good
            });
        });

        assert(
            programStateMachine.getMethodByName(methodName) !== null,
            "Method " + methodName + " should be added to parent object (checked with getMethodByName)"
        );
        const lc_name = lowerFirstLetter(methodName);
    }

    installMethod("Halt", "Halted");
    installMethod("Reset", "Ready");
    installMethod("Start", "Running");
    installMethod("Suspend", "Suspended");
    installMethod("Resume", "Running");
}

function addRelation(srcNode: BaseNode, referenceType: UAReferenceType | string, targetNode: BaseNode) {
    assert(srcNode, "expecting srcNode !== null");
    assert(targetNode, "expecting targetNode !== null");
    if (typeof referenceType === "string") {
        const nodes = srcNode.findReferencesAsObject(referenceType, true);
        assert(nodes.length === 1);
        referenceType = nodes[0] as UAReferenceType;
    }
    srcNode.addReference({ referenceType: referenceType.nodeId, nodeId: targetNode });
}

export function createBoilerType(namespace: Namespace): BoilerType {
    // istanbul ignore next
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

    const addressSpace = namespace.addressSpace;
    flowTo.isSupertypeOf(addressSpace.findReferenceType("References")!);
    flowTo.isSupertypeOf(addressSpace.findReferenceType("NonHierarchicalReferences")!);
    hotFlowTo.isSupertypeOf(addressSpace.findReferenceType("References")!);
    hotFlowTo.isSupertypeOf(addressSpace.findReferenceType("NonHierarchicalReferences")!);
    hotFlowTo.isSupertypeOf(addressSpace.findReferenceType("FlowTo", namespace.index)!);

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
        propertyOf: customControllerType
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
        browseName: "FlowTransmitter",
        componentOf: boilerInputPipeType,
        modellingRule: "Mandatory",
        notifierOf: boilerInputPipeType
    }) as FlowTransmitter;
    assert(ftx1.output.browseName.toString() === `${namespace.index}:Output`);

    const valve1 = valveType.instantiate({
        browseName: "Valve",
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
        browseName: "FlowTransmitter",
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
        browseName: "LevelIndicator",
        componentOf: boilerDrumType,
        modellingRule: "Mandatory",
        notifierOf: boilerDrumType
    }) as LevelIndicator;

    const programFiniteStateMachineType = addressSpace.findObjectType("ProgramStateMachineType")!;

    // --------------------------------------------------------
    // define boiler State Machine
    // --------------------------------------------------------
    const boilerStateMachineType = namespace.addObjectType({
        browseName: "BoilerStateMachineType",
        postInstantiateFunc: implementProgramStateMachine,
        subtypeOf: programFiniteStateMachineType!
    }) as BoilerStateMachineType;

    // programStateMachineType has Optional placeHolder for method "Halt", "Reset","Start","Suspend","Resume")

    function addMethod(baseType: UAObjectType, objectType: UAObjectType, methodName: string) {
        assert(!objectType.getMethodByName(methodName));
        const method = baseType.getMethodByName(methodName)!;
        const m = method.clone({
            namespace,
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
        browseName: "BoilerType",
        eventNotifier: 0x1
    }) as BoilerType;

    // BoilerType.CustomController (CustomControllerType)
    const customController = customControllerType.instantiate({
        browseName: "CustomController",
        componentOf: boilerType,
        modellingRule: "Mandatory"
    }) as CustomController;

    // BoilerType.FlowController (FlowController)
    const flowController = flowControllerType.instantiate({
        browseName: "FlowController",
        componentOf: boilerType,
        modellingRule: "Mandatory"
    }) as FlowController;

    // BoilerType.LevelController (LevelControllerType)
    const levelController = levelControllerType.instantiate({
        browseName: "LevelController",
        componentOf: boilerType,
        modellingRule: "Mandatory"
    }) as LevelController;

    // BoilerType.LevelIndicator (BoilerInputPipeType)
    const inputPipe = boilerInputPipeType.instantiate({
        browseName: "InputPipe",
        componentOf: boilerType,
        modellingRule: "Mandatory",
        notifierOf: boilerType
    }) as BoilerInputPipe;

    // BoilerType.BoilerDrum (BoilerDrumType)
    const boilerDrum = boilerDrumType.instantiate({
        browseName: "BoilerDrum",
        componentOf: boilerType,
        modellingRule: "Mandatory",
        notifierOf: boilerType
    }) as BoilerDrum;

    // BoilerType.OutputPipe (BoilerOutputPipeType)
    const outputPipe = boilerOutputPipeType.instantiate({
        browseName: "OutputPipe",
        componentOf: boilerType,
        modellingRule: "Mandatory",
        notifierOf: boilerType
    }) as BoilerOutputPipe;

    // BoilerType.Simulation (BoilerStateMachineType)
    const simulation = boilerStateMachineType.instantiate({
        browseName: "Simulation",
        componentOf: boilerType,
        eventSourceOf: boilerType,
        modellingRule: "Mandatory"
    }) as BoilerStateMachine;

    addRelation(inputPipe, flowTo, boilerDrum);
    addRelation(boilerDrum, hotFlowTo, outputPipe);

    assert(boilerType.inputPipe.flowTransmitter);
    assert(boilerType.inputPipe.flowTransmitter.output);
    assert(boilerType.flowController.measurement);

    addRelation(boilerType.inputPipe.flowTransmitter.output, signalTo, boilerType.flowController.measurement);
    addRelation(boilerType.inputPipe.flowTransmitter.output, signalTo, boilerType.customController.input2);
    addRelation(boilerType.flowController.controlOut, signalTo, boilerType.inputPipe.valve.input);

    // indicates that the level controller gets its measurement from the drum's level indicator.
    addRelation(boilerType.boilerDrum.levelIndicator.output, signalTo, boilerType.levelController.measurement);

    addRelation(boilerType.outputPipe.flowTransmitter.output, signalTo, boilerType.customController.input3);

    addRelation(boilerType.levelController.controlOut, signalTo, boilerType.customController.input1);

    addRelation(boilerType.customController.controlOut, signalTo, boilerType.flowController.setPoint);

    return boilerType;
}

export function makeBoiler(
    addressSpace: AddressSpace,
    options: {
        browseName: string;
        organizedBy: BaseNode;
    }
): Boiler {
    const namespace = addressSpace.getOwnNamespace();

    assert(options);
    let boilerType: UAObjectType | null;
    boilerType = namespace.findObjectType("BoilerType");

    // istanbul ignore next
    if (!boilerType) {
        createBoilerType(namespace);
        boilerType = namespace.findObjectType("BoilerType")!;
    }
    // now instantiate boiler
    const boiler1 = boilerType.instantiate({
        browseName: options.browseName,
        organizedBy: addressSpace.rootFolder.objects
    }) as Boiler;

    promoteToStateMachine(boiler1.simulation);

    const boilerStateMachine = boiler1.simulation;
    const readyState = boilerStateMachine.getStateByName("Ready")!;
    boilerStateMachine.setState(readyState);

    return boiler1;
}
