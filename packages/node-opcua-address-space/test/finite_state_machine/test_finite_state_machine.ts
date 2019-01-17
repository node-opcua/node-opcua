// tslint:disable:no-console
import * as path from "path";
import * as should from "should";

import { LocalizedText } from "node-opcua-data-model";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";

import {
    AddressSpace,
    ExclusiveLimitStateMachineType,
    FiniteStateMachineType,
    generateAddressSpace,
    InstantiateObjectOptions,
    promoteToStateMachine,
    StateMachine,
    StateMachineType
} from "../..";

const doDebug = false;

// make sure extra error checking is made on object constructions
// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing Finite State Machine", () => {

    let addressSpace: AddressSpace;

    before(async () => {

        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("MyPrivateNamespace");

        const xml_files = [
            // opcua.mini_nodeset_filename,
            path.join(__dirname, "../../test_helpers/test_fixtures/fixture_simple_statemachine_nodeset2.xml")
        ];
        await generateAddressSpace(addressSpace, xml_files);
    });
    after(() => {
        addressSpace.dispose();
    });

    it("finite state machine should have expected mandatory and optional fields", async () => {

        const stateMachineType = addressSpace.findObjectType("StateMachineType")! as StateMachineType;

        stateMachineType.currentState.modellingRule!.should.eql("Mandatory");
        stateMachineType.currentState.id.modellingRule!.should.eql("Mandatory");

        stateMachineType.lastTransition.modellingRule!.should.eql("Optional");
        stateMachineType.lastTransition.id.modellingRule!.should.eql("Mandatory");

        stateMachineType.currentState.dataTypeObj.browseName.toString().should.eql("LocalizedText");

        // xx no datatype enforced here
        stateMachineType.currentState.id.dataType.isEmpty().should.eql(true);
        stateMachineType.isAbstract.should.eql(false);
        stateMachineType.currentState.typeDefinitionObj.browseName.toString().should.eql("StateVariableType");
        stateMachineType.lastTransition.typeDefinitionObj.browseName.toString().should.eql("TransitionVariableType");

    });

    it("should instantiate a finite state machine", async () => {

        const stateMachineType = addressSpace.findObjectType("StateMachineType")! as StateMachineType;

        const stateMachine = stateMachineType.instantiate({ browseName: "MyStateMachine" });

        stateMachine.getComponentByName("CurrentState")!.browseName.toString().should.eql("CurrentState");

        stateMachine.currentState.browseName.toString().should.eql("CurrentState");
        stateMachine.currentState.id.browseName.toString().should.eql("Id");

        stateMachine.hasOwnProperty("lastTransition").should.eql(false);

    });

    it("should instantiate a finite state machine with lastTransition", async () => {

        const stateMachineType = addressSpace.findObjectType("StateMachineType")! as StateMachineType;

        const stateMachine = stateMachineType.instantiate({
            browseName: "MyStateMachine",
            optionals: ["LastTransition"]
        });

        stateMachine.getComponentByName("CurrentState")!.browseName.toString().should.eql("CurrentState");
        stateMachine.currentState.browseName.toString().should.eql("CurrentState");

        stateMachine.getComponentByName("LastTransition")!.browseName.toString().should.eql("LastTransition");
        stateMachine.lastTransition!.browseName.toString().should.eql("LastTransition");
    });

    it("should bind a finite state machine state variable", async () => {

        const stateMachineType = addressSpace.findObjectType("StateMachineType")! as StateMachineType;

        const stateMachine = stateMachineType.instantiate({
            browseName: "MyStateMachine2",
            optionals: ["LastTransition"]
        });

        stateMachine.currentState.setValueFromSource({
            dataType: DataType.LocalizedText,
            value: new LocalizedText({ text: "NewState" })
        });

    });

    // FiniteStateMachineType are defined in  OPCUA Specification Part 5 : information model
    //
    // StateMachines which have their states completely defined by the type are instances *
    // of a FiniteStateMachineType.
    // - Each FiniteStateMachineType has one or more States. For simplicity, we do not distinguish between different
    //   States like the start or the end states.
    // - Each State can have one or more SubStateMachines.
    // - Each FiniteStateMachineType may have one or more Transitions.
    //   A Transition is directed and points from one State to another State.

    it("should explore FiniteStateMachineType", async () => {

        const finiteStateMachineType = addressSpace.findObjectType("FiniteStateMachineType")! as FiniteStateMachineType;

        finiteStateMachineType.currentState.modellingRule!.should.eql("Mandatory");
        finiteStateMachineType.currentState.id.modellingRule!.should.eql("Mandatory");

        finiteStateMachineType.lastTransition.modellingRule!.should.eql("Optional");
        finiteStateMachineType.lastTransition.id.modellingRule!.should.eql("Mandatory");

        finiteStateMachineType.isAbstract.should.eql(false);

        finiteStateMachineType.currentState.dataTypeObj.browseName.toString().should.eql("LocalizedText");
        finiteStateMachineType.currentState.id.dataTypeObj.browseName.toString().should.eql("NodeId");

        finiteStateMachineType.currentState.typeDefinitionObj.browseName.toString()
          .should.eql("FiniteStateVariableType");

    });

    it("should handle a FiniteStateMachine Type defined in a nodeset.xml file", () => {

        const exclusiveLimitStateMachineType =
          addressSpace.findObjectType("ExclusiveLimitStateMachineType")! as ExclusiveLimitStateMachineType;

        exclusiveLimitStateMachineType.browseName.toString().should.eql("ExclusiveLimitStateMachineType");

        // instantiate a state machine

        const myStateMachine = exclusiveLimitStateMachineType.instantiate({
            browseName: "MyStateMachine"
        });
        if (doDebug) {
            console.log(myStateMachine.toString());
        }
        promoteToStateMachine(myStateMachine);

        // get the states
        const a = myStateMachine.getStates().map((e: any) => {

            const stateNumber = e.stateNumber.readValue().value.value;
            return e.browseName.toString() + ((stateNumber !== null) ? (" ( " + stateNumber + " )") : "");
        });

        if (doDebug) {
            console.log("states      : ", a.join(" "));
        }

        // get the transitions
        const t = myStateMachine.getTransitions().map((e) => {
            const transitionNumber = e.transitionNumber.readValue().value.value;
            return e.browseName.toString() + ((transitionNumber !== null) ? (" ( " + transitionNumber + " )") : "");
        });
        if (doDebug) {
            console.log("transitions : ", t.join(" "));
        }

        // set state and raise event
        myStateMachine.setState(myStateMachine.initialState!);

        if (doDebug) {
            console.log(myStateMachine.currentState.readValue().toString());
        }
        myStateMachine.currentState.readValue().statusCode.should.eql(StatusCodes.BadStateNotActive);

        myStateMachine.setState(myStateMachine.getStates()[0]);
        myStateMachine.setState(myStateMachine.getStates()[1]);
        myStateMachine.setState(myStateMachine.getStates()[2]);
        myStateMachine.setState(myStateMachine.getStates()[3]);

        const lowlowState = myStateMachine.getStateByName("LowLow")!;
        lowlowState.browseName.toString().should.eql("LowLow");

        const lowState = myStateMachine.getStateByName("Low")!;
        lowState.browseName.toString().should.eql("Low");

        const lowToLowLowTransition = myStateMachine.findTransitionNode(lowState, lowlowState)!;

        lowToLowLowTransition.browseName.toString().should.eql("LowToLowLow");

    });

    it("should define a new FiniteMachineStateType", () => {

        /*
         *  BrowseName  AnalyserDeviceStateMachineType
         *  Subtype of the FiniteStateMachineType defined in [UA Part 5]
         *  IsAbstract  False
         *  References      NodeClass   BrowseName                       DataType       TypeDefinition ModellingRule
         *  HasComponent    Object      Powerup                          InitialStateType                   Mandatory
         *  HasComponent    Object      Operating                        StateType                          Mandatory
         *  HasComponent    Object      Local                            StateType                          Mandatory
         *  HasComponent    Object      Maintenance                      StateType                          Mandatory
         *  HasComponent    Object      Shutdown                         StateType                          Mandatory
         *  HasComponent    Object      PowerupToOperatingTransition     TransitionType                     Mandatory
         *  HasComponent    Object      OperatingToLocalTransition       TransitionType                     Mandatory
         *  HasComponent    Object      OperatingToMaintenanceTransition TransitionType                     Mandatory
         *  HasComponent    Object      LocalToOperatingTransition       TransitionType                     Mandatory
         *  HasComponent    Object      LocalToMaintenanceTransition     TransitionType                     Mandatory
         *  HasComponent    Object      MaintenanceToOperatingTransition TransitionType                     Mandatory
         *  HasComponent    Object      MaintenanceToLocalTransition     TransitionType                     Mandatory
         *  HasComponent    Object      OperatingToShutdownTransition    TransitionType                     Mandatory
         *  HasComponent    Object      LocalToShutdownTransition        TransitionType                     Mandatory
         *  HasComponent    Object      MaintenanceToShutdownTransition  TransitionType                     Mandatory
         */

        const namespace = addressSpace.getOwnNamespace();

        const myFiniteStateMachine = namespace.addObjectType({
            browseName: "MyFiniteStateMachine",
            subtypeOf: "FiniteStateMachineType"
        }) as FiniteStateMachineType;

        // The AnalyserDevice is in its power-up sequence and cannot perform any other task.
        namespace.addState(myFiniteStateMachine, "Powerup", 100, true);

        // The AnalyserDevice is in the Operating mode.
        // The ADI Client uses this mode for normal operation: configuration, control and data collection.
        // In this mode, each child AnalyserChannels are free to accept commands from the ADI Client and the
        // Parameter values published in the address space values are expected to be valid.
        // When entering this state, all AnalyserChannels of this AnalyserDevice automatically leave the SlaveMode
        // state and enter their Operating state.
        namespace.addState(myFiniteStateMachine, "Operating", 200);

        // The AnalyserDevice is in the Local mode. This mode is normally used to perform local physical maintenance
        // on the analyser.
        // To enter the Local mode, the operator shall push a button, on the analyser itself. This may be a physical
        // button or a graphical control on the local console screen. To quit the Local mode, the operator shall
        // press the same or another button on the analyser itself.
        // When the analyser is in Local mode, all child AnalyserChannels sit in the SlaveMode state of the
        // AnalyserChannelStateMachine.
        // In this mode, no commands are accepted from the ADI interface and no guarantee is given on the
        // values in the address space.

        namespace.addState(myFiniteStateMachine, "Local", 300);

        // The AnalyserDevice is in the Maintenance mode. This mode is used to perform remote maintenance on the
        // analyser like firmware upgrade.
        // To enter in Maintenance mode, the operator shall call the GotoMaintenance Method from the ADI Client.
        // To return to the Operating mode, the operator shall call the GotoOperating Method from the ADI Client.
        // When the analyser is in the Maintenance mode, all child AnalyserChannels sit in the SlaveMode state of
        // the AnalyserChannelStateMachine.
        // In this mode, no commands are accepted from the ADI interface for the AnalyserChannels and no guarantee
        // is given on the values in the address space.
        namespace.addState(myFiniteStateMachine, "Maintenance", 400);

        // The AnalyserDevice is in its power-down sequence and cannot perform any other task.
        namespace.addState(myFiniteStateMachine, "Shutdown", 500);

        namespace.addTransition(myFiniteStateMachine, "Powerup", "Operating", 1);
        namespace.addTransition(myFiniteStateMachine, "Operating", "Local", 2);
        namespace.addTransition(myFiniteStateMachine, "Operating", "Maintenance", 3);
        namespace.addTransition(myFiniteStateMachine, "Local", "Operating", 4);
        namespace.addTransition(myFiniteStateMachine, "Local", "Maintenance", 5);
        namespace.addTransition(myFiniteStateMachine, "Maintenance", "Operating", 6);
        namespace.addTransition(myFiniteStateMachine, "Maintenance", "Local", 7);
        namespace.addTransition(myFiniteStateMachine, "Operating", "Shutdown", 8);
        namespace.addTransition(myFiniteStateMachine, "Local", "Shutdown", 9);
        namespace.addTransition(myFiniteStateMachine, "Maintenance", "Shutdown", 10);

    });

});
