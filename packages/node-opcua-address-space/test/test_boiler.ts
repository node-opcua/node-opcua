// tslint:disable:no-console
import * as chalk from "chalk";
import { nodesets } from "node-opcua-nodesets";
import * as should from "should";
import { generateAddressSpace } from "../nodeJS";
import { SessionContext, StateMachine } from "..";
import { AddressSpace, BaseNode, Namespace, ProgramFiniteStateMachine, promoteToStateMachine } from "..";

import { createBoilerType, makeBoiler } from "../testHelpers";

const doDebug = false;

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing Boiler System", () => {
    function getBrowseName(x: BaseNode): string {
        return x.browseName.toString();
    }

    const nodesetFilename = nodesets.standard;

    let addressSpace: AddressSpace;
    let namespace: Namespace;
    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, nodesetFilename);
        namespace = addressSpace.registerNamespace("Private");
        namespace.index.should.eql(1);
    });
    after(async () => {
        addressSpace.dispose();
    });

    it("should handle StateMachine derived from ProgramStateMachine", () => {
        const programStateMachine = addressSpace.findObjectType("ProgramStateMachineType")!;

        const psm = programStateMachine.instantiate({
            browseName: "MyStateMachine#2"
        }) as ProgramFiniteStateMachine;
        promoteToStateMachine(psm);

        psm.getStates().map(getBrowseName).sort().should.eql(["Halted", "Ready", "Running", "Suspended"]);
    });

    it("should handle StateMachine derived from ProgramStateMachine", () => {
        const myProgramStateMachine = namespace.addObjectType({
            browseName: "MyProgramStateMachine",
            subtypeOf: "ProgramStateMachineType"
        });

        const psm = myProgramStateMachine.instantiate({
            browseName: "MyStateMachine#2"
        }) as ProgramFiniteStateMachine;

        promoteToStateMachine(psm);

        psm.getStates().map(getBrowseName).sort().should.eql(["Halted", "Ready", "Running", "Suspended"]);

        psm.getTransitions()
            .map(getBrowseName)
            .should.eql([
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

    it("should create a boiler system", async () => {
        const context = SessionContext.defaultContext;

        const boilerType = createBoilerType(namespace);

        boilerType.getNotifiers().length.should.eql(3);
        boilerType.getEventSources().length.should.eql(1);

        const boiler = makeBoiler(addressSpace, {
            browseName: "Boiler#1",
            organizedBy: addressSpace.rootFolder
        });

        boiler.inputPipe.browseName.toString().should.eql("1:InputPipe");
        boiler.outputPipe.browseName.toString().should.eql("1:OutputPipe");
        boiler.boilerDrum.browseName.toString().should.eql("1:BoilerDrum");
        boiler.simulation.browseName.toString().should.eql("1:Simulation");

        // xx boiler.inputPipe.displayName.text.toString().should.eql("Pipe1001");

        boiler.inputPipe.modellingRule!.should.eql("Mandatory");
        boiler.outputPipe.modellingRule!.should.eql("Mandatory");
        boiler.boilerDrum.modellingRule!.should.eql("Mandatory");
        boiler.simulation.modellingRule!.should.eql("Mandatory");

        boiler.getNotifiers().length.should.eql(3);
        boiler.getEventSources().length.should.eql(1);

        boiler
            .getNotifiers()
            .map((x: BaseNode) => {
                return x.browseName.name!.toString();
            })
            .join(" ")
            .should.eql("InputPipe BoilerDrum OutputPipe");
        // xx boiler.inputPipe.notifierOf.nodeId.toString().should.eql(boiler.nodeId.toString());
        // xx boiler.inputPipe.notifierOf.nodeId.toString().should.eql(boiler.nodeId.toString());

        const haltMethod = boiler.simulation.getMethodByName("Halt")!;
        const resetMethod = boiler.simulation.getMethodByName("Reset")!;
        const startMethod = boiler.simulation.getMethodByName("Start")!;
        const suspendMethod = boiler.simulation.getMethodByName("Suspend")!;

        // expecting initial state to be Ready
        haltMethod.getExecutableFlag(context).should.eql(true);
        resetMethod.getExecutableFlag(context).should.eql(false);
        startMethod.getExecutableFlag(context).should.eql(true);
        suspendMethod.getExecutableFlag(context).should.eql(false);

        const callMethodResponse = await haltMethod.execute(null, [], context);
        if (doDebug) {
            console.log(chalk.bgWhite.cyan(" Halt has been called"), callMethodResponse.statusCode!.toString());
        }
        haltMethod.getExecutableFlag(context).should.eql(false);
        resetMethod.getExecutableFlag(context).should.eql(true);
        startMethod.getExecutableFlag(context).should.eql(false);
        suspendMethod.getExecutableFlag(context).should.eql(false);

        const callMethodResponse1 = await resetMethod.execute(null, [], context);
        if (doDebug) {
            console.log(chalk.bgWhite.cyan(" resetMethod has been called"), callMethodResponse1.statusCode!.toString());
        }
        haltMethod.getExecutableFlag(context).should.eql(true);
        resetMethod.getExecutableFlag(context).should.eql(false);
        startMethod.getExecutableFlag(context).should.eql(true);
        suspendMethod.getExecutableFlag(context).should.eql(false);

        const callMethodResponse2 = await startMethod.execute(null,[], context);

        if (doDebug) {
            console.log(chalk.bgWhite.cyan(" startMethod has been called"), callMethodResponse2.statusCode!.toString());
        }
        haltMethod.getExecutableFlag(context).should.eql(true);
        resetMethod.getExecutableFlag(context).should.eql(true);
        startMethod.getExecutableFlag(context).should.eql(false);
        suspendMethod.getExecutableFlag(context).should.eql(true);

        const callMethodResponse3 = await suspendMethod.execute(null,[], context);

        if (doDebug) {
            console.log(chalk.bgWhite.cyan("suspendMethod has been called"), callMethodResponse3.statusCode!.toString());
        }
        haltMethod.getExecutableFlag(context).should.eql(true);
        resetMethod.getExecutableFlag(context).should.eql(true);
        startMethod.getExecutableFlag(context).should.eql(true);
        suspendMethod.getExecutableFlag(context).should.eql(false);
    });
});
