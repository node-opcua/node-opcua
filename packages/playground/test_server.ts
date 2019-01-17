// tslint:disable:no-console
// tslint:disable:object-literal-sort-keys
// tslint:disable:unused-var
import {
    AddressSpace,
    Argument,
    BaseNode,
    CallMethodResponse,
    Folder,
    FolderType,
    OPCUAServer,
    ProgramFiniteStateMachine,
    ProgramFiniteStateMachineType,
    RegisterServerMethod,
    Request,
    Response,
    SessionContext, State, StateMachine,
    StatusCodes,
    TransitionEventType, UAAnalogItem,
    UAMethod,
    UAObject,
    UAObjectType,
    UAReferenceType,
    UAVariable,
    BrowseRequest,
    BrowseResponse,
    ActivateSessionRequest
} from "node-opcua";
import { assert } from "node-opcua-assert";
import { lowerFirstLetter } from "node-opcua-utils";

// tslint:disable:no-empty-interface
interface FlowToReference extends UAReferenceType {}
interface HotFlowToReference extends UAReferenceType {}
interface SignalToReference extends UAReferenceType {}
interface BoilerHaltedEventType extends TransitionEventType {}

interface CustomControllerB {
    input1: UAVariable;
    input2: UAVariable;
    input3: UAVariable;
    controlOut: UAVariable;
// conflict here !    description: UAVariable;
}

interface CustomControllerType extends CustomControllerB, UAObjectType {}
interface CustomController extends CustomControllerB, UAObject {}

interface GenericSensorB {
    output: UAAnalogItem;
}
interface GenericSensorType extends GenericSensorB, UAObjectType {}
interface GenericSensor extends GenericSensorB, UAObject {}

interface GenericControllerB {
    controlOut: UAVariable;
    measurement: UAVariable;
    setPoint: UAVariable;
}
interface GenericControllerType extends GenericControllerB, UAObjectType {}
interface GenericController extends GenericControllerB, UAObject {}

interface FlowControllerType extends GenericControllerType {}
interface FlowController extends GenericController {}

interface LevelControllerType extends GenericControllerType {}
interface LevelController extends GenericController {}

interface FlowTransmitterType extends GenericSensorType {}

interface FlowTransmitter extends GenericSensor {}

interface LevelIndicatorType extends GenericSensorType {}
interface LevelIndicator extends GenericSensor {}

interface GenericActuatorType extends UAObjectType {
    input: UAAnalogItem;
}
interface GenericActuator extends UAObject {
    input: UAAnalogItem;
}
interface ValveType extends GenericActuatorType {
}

interface Valve extends GenericActuator {
}

interface BoilerInputPipeType extends FolderType {
    ftX001: FlowTransmitter;
    valveX001: Valve;
}
interface BoilerInputPipe extends Folder {
    ftX001: FlowTransmitter;
    valveX001: Valve;
}
interface BoilerOutputPipeType extends FolderType {
    ftX002: FlowTransmitter;
}
interface BoilerOutputPipe extends Folder {
    ftX002: FlowTransmitter;

}
interface BoilerDrumpType extends FolderType {
    liX001: LevelIndicator;
}
interface BoilerDrump extends Folder {
    liX001: LevelIndicator;
}
interface BoilerStateMachineType extends ProgramFiniteStateMachineType {
}
interface BoilerStateMachine extends ProgramFiniteStateMachine {
}

interface BoilerType extends UAObjectType {
    ccX001: CustomController;
    fcX001: FlowController;
    lcX001: LevelController;
    pipeX001: BoilerInputPipe;
    drumX001: BoilerDrump;
    pipeX002: BoilerOutputPipe;
    drumX002: BoilerDrump;
    simulation: BoilerStateMachine;
}

interface Boiler extends UAObject {
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
    const stateMachineW = StateMachine.promote(method.parent!);
    return stateMachineW.isValidTransition(toState);
}
function implementProgramStateMachine(programStateMachine: UAObject): void {

    function installMethod(methodName: string, toState: string) {

        let method = programStateMachine.getMethodByName(methodName);

        if (!method) {
            // 'method' has ModellingRule=OptionalPlaceholder and should be created from the type definition
            let methodToClone = programStateMachine.typeDefinitionObj.getMethodByName(methodName);
            if (!methodToClone) {
                methodToClone = programStateMachine.typeDefinitionObj.subtypeOfObj.getMethodByName(methodName)!;
            }
            methodToClone.clone({
                componentOf: programStateMachine
            });
            method = programStateMachine.getMethodByName(methodName)!;
            assert(method !== null, "Method clone should cause parent object to be extended");

        }
        assert(method instanceof UAMethod);

        method._getExecutableFlag =  function(/* sessionContext: SessionContext */) {
            // must use  a function here to capture 'this'
            return MygetExecutableFlag(this as UAMethod, toState, methodName);
        };

        method.bindMethod(
          (
            inputArguments: Argument[],
            context: SessionContext,
            callback: (err: Error | null, callMethodResponse?: CallMethodResponse) => void
          ) => {
            const stateMachineW = StateMachine.promote(method!.parent! as UAObject);
            stateMachineW.setState(toState);
            callback(null, { statusCode: StatusCodes.Good, outputArguments: [] });
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
    assert( srcNode, "expecting srcNode !== null");
    assert( targetNode, "expecting targetNode !== null");
    if (typeof referenceType === "string") {
        const nodes = srcNode.findReferencesAsObject(referenceType, true);
        assert(nodes.length === 1);
        referenceType = nodes[0] as UAReferenceType;
    }
    srcNode.addReference( { referenceType: referenceType.nodeId, nodeId: targetNode });
}

function createBoilerType(addressSpace: AddressSpace): BoilerType {

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
        inverseName: "FlowFrom",
        subtypeOf: "NonHierarchicalReferences",
        description: "a reference that indicates a flow between two objects"
    }) as FlowToReference;

    const hotFlowTo = namespace.addReferenceType({
        browseName: "HotFlowTo",
        inverseName: "HotFlowFrom",
        subtypeOf: flowTo,
        description: "a reference that indicates a high temperature flow between two objects"
    }) as HotFlowToReference;

    const signalTo = namespace.addReferenceType({
        browseName: "SignalTo",
        inverseName: "SignalFrom",
        subtypeOf: "NonHierarchicalReferences",
        description: "a reference that indicates an electrical signal between two variables"
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
        propertyOf: customControllerType,
        dataType: "Double",
        modellingRule: "Mandatory"
    });

    const input2: UAVariable = namespace.addVariable({
        browseName: "Input2",
        propertyOf: customControllerType,
        dataType: "Double",
        modellingRule: "Mandatory"
    });

    const input3: UAVariable = namespace.addVariable({
        browseName: "Input3",
        propertyOf: customControllerType,
        dataType: "Double",
        modellingRule: "Mandatory"
    });

    const controlOut: UAVariable = namespace.addVariable({
        browseName: "ControlOut",
        propertyOf: customControllerType,
        dataType: "Double",
        modellingRule: "Mandatory"
    });

    const description: UAVariable = namespace.addVariable({
        browseName: "Description",
        propertyOf: customControllerType,
        dataType: "LocalizedText",
        modellingRule: "Mandatory"
    });

    // --------------------------------------------------------
    // GenericSensorType
    // --------------------------------------------------------
    const genericSensorType = namespace.addObjectType({
        browseName: "GenericSensorType"
    });
    namespace.addAnalogDataItem({
        componentOf: genericSensorType,
        modellingRule: "Mandatory",
        browseName: "Output",
        dataType: "Double",
        engineeringUnitsRange: { low: -100, high: 200 }
    });

    genericSensorType.install_extra_properties();

    genericSensorType.getComponentByName("Output");
    assert(genericSensorType.getComponentByName("Output").modellingRule === "Mandatory");

    // --------------------------------------------------------
    // GenericSensorType  <---- GenericControllerType
    // --------------------------------------------------------
    const genericControllerType = namespace.addObjectType({
        browseName: "GenericControllerType"
    });
    namespace.addVariable({
        propertyOf: genericControllerType,
        browseName: "ControlOut",
        dataType: "Double",
        modellingRule: "Mandatory"
    });
    namespace.addVariable({
        propertyOf: genericControllerType,
        browseName: "Measurement",
        dataType: "Double",
        modellingRule: "Mandatory"
    });
    namespace.addVariable({
        propertyOf: genericControllerType,
        browseName: "SetPoint",
        dataType: "Double",
        modellingRule: "Mandatory"
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
        componentOf: genericActuatorType,
        modellingRule: "Mandatory",
        browseName: "Input",
        dataType: "Double",
        engineeringUnitsRange: { low: -100, high: 200 }
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
    });

    ftx2.getComponentByName("Output").browseName.toString();

    // --------------------------------)------------------------------------------------
    // FolderType  <---- BoilerDrumType
    // --------------------------------------------------------------------------------
    const boilerDrumType = namespace.addObjectType({
        browseName: "BoilerDrumType",
        subtypeOf: "FolderType"
    });
    levelIndicatorType.instantiate({
        browseName: "LIX001",
        componentOf: boilerDrumType,
        modellingRule: "Mandatory",
        notifierOf: boilerDrumType
    });

    const programFiniteStateMachineType: ProgramFiniteStateMachineType =
      addressSpace.findObjectType("ProgramStateMachineType")! as ProgramFiniteStateMachineType;

    // --------------------------------------------------------
    // define boiler State Machine
    // --------------------------------------------------------
    const boilerStateMachineType = namespace.addObjectType({
        browseName: "BoilerStateMachineType",
        subtypeOf: programFiniteStateMachineType!,
        postInstantiateFunc: implementProgramStateMachine
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
        modellingRule: "Mandatory",
        eventSourceOf: boilerType
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

function makeBoiler(
  addressSpace: AddressSpace,
  options: {
      browseName: string,
      organizedBy: BaseNode
  }
) {

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

    Object.setPrototypeOf(boiler1.simulation, StateMachine.prototype);
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

async function main() {
    try {

        const server = new OPCUAServer({
            registerServerMethod: RegisterServerMethod.LDS
        });

        await server.initialize();

        server.on("request", (request: Request) => {
 
            console.log(request.constructor.name,request.requestHeader.requestHandle);
            
            // you can either check the instance of the request object directl 
            if (request instanceof BrowseRequest) {
                console.log("BrowseRequest.requestedMaxReferencesPerNode=", request.requestedMaxReferencesPerNode);
            } else if ( request instanceof ActivateSessionRequest) {
                console.log(request.toString());
            }
            // ... or check its schema name
            switch(request.schema.name) {
                case "BrowseRequest":
                    const browseRequest = request as BrowseRequest;
                    break;
                // etc... 
            }
        
        });
        server.on("response", (response: Response) => {

            // you can either check the instance of the request object directl 
           if (response instanceof BrowseResponse) {         
                console.log("BrowseResponse.results.length =", response.results ? response.results.length : 0);
            }

            switch(response.schema.name) {
                case "BrowseResponce":
                    const browseRequest = response as BrowseResponse;
                    console.log("BrowseResponse.results.length =", browseRequest.results ? browseRequest.results.length : 0);
                    break;
                // etc... 
            }
        });
        // post-initialize
        const addressSpace = server.engine.addressSpace;

        addressSpace.installAlarmsAndConditionsService();
        const namespace = addressSpace.getOwnNamespace();

        const myEventType = namespace.addEventType({
            browseName: "MyEventType",
            subtypeOf: "TransitionEventType"
        });

        const HVACModuleType = namespace.addObjectType({
            browseName: "HVACModuleType",
        });

        namespace.addAnalogDataItem({
            modellingRule: "Mandatory",
            componentOf: HVACModuleType,
            browseName: "TargetTemperature",
            minimumSamplingInterval: 0, // could be event Based
            dataType: "Double",
            instrumentRange: { low: -70, high: 120 },
            engineeringUnitsRange: { low: -100, high: 200 }
        });

        namespace.addObject({
            browseName: "Test",
            eventNotifier: 0,
            organizedBy: addressSpace.rootFolder.objects
        });

        const boiler1 = makeBoiler(addressSpace, {
            browseName: "Boiler1",
            organizedBy: addressSpace.rootFolder.objects
        });

        await server.start();
        console.log(" Server started ", server.endpoints[0].endpointDescriptions()[0].endpointUrl);
    } catch (err) {
        console.log("Error : ", err.message);
        console.log(err.stack);
    }
}

main();
