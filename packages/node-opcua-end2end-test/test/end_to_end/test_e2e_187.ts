import should from "should";
import chalk from "chalk";

import { NodeId, OPCUAClient, OPCUAServer, SessionContext, UAObject } from "node-opcua";
import { Boiler, makeBoiler } from "node-opcua-address-space/testHelpers";
import { UAProxyManager } from "node-opcua-client-proxy";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
const context = SessionContext.defaultContext;

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
describe("testing monitoring Executable flags on methods", function (this: any) {

    this.timeout(Math.max(60000, this.timeout()));

    let server: OPCUAServer;
    let client: OPCUAClient | undefined;
    let endpointUrl: string;

    let boiler_on_server: NodeId;

    const port = 2006;
    before(async () => {
        const options = { port };
        server = new OPCUAServer(options);

        await server.initialize();

        const uaBoiler = makeBoiler(server.engine.addressSpace!, {
            browseName: "Boiler#1",
            organizedBy: server.engine!.addressSpace!.rootFolder.objects
        });

        const haltMethod = uaBoiler.simulation.getMethodByName("Halt")!;
        const resetMethod = uaBoiler.simulation.getMethodByName("Reset")!;
        const startMethod = uaBoiler.simulation.getMethodByName("Start")!;
        const suspendMethod = uaBoiler.simulation.getMethodByName("Suspend")!;
        boiler_on_server = uaBoiler.nodeId;

        haltMethod.getExecutableFlag(context).should.eql(true);
        resetMethod.getExecutableFlag(context).should.eql(false);
        startMethod.getExecutableFlag(context).should.eql(true);
        suspendMethod.getExecutableFlag(context).should.eql(false);

        await server.start();

        haltMethod.getExecutableFlag(context).should.eql(true);
        resetMethod.getExecutableFlag(context).should.eql(false);
        startMethod.getExecutableFlag(context).should.eql(true);
        suspendMethod.getExecutableFlag(context).should.eql(false);


        endpointUrl = server.getEndpointUrl();
    });

    beforeEach(async () => {
        client = OPCUAClient.create({ clientName: "1 " + __filename });
    });

    afterEach(async () => {
        if (client ) {
            await client.disconnect();
            client = undefined;
        }
    });

    after(async () => {
        await server.shutdown();
    });

    it("#187 ...... ", async () => {
        let proxyManager;
        if (!client) return;
        await client.withSessionAsync(endpointUrl, async (session) => {
            proxyManager = new UAProxyManager(session);
            const nodeId = boiler_on_server;

            await proxyManager.start();
            const smType = "ProgramStateMachineType";
            const obj = await proxyManager.getStateMachineType(smType);

            if (doDebug) {
                debugLog("InitialState = ", obj.initialState ? obj.initialState.toString() : "<null>");
                debugLog(
                    "States       = ",
                    obj.states.map(function (state) {
                        return state.browseName.toString();
                    })
                );
                debugLog(
                    "Transitions  = ",
                    obj.transitions.map(function (transition) {
                        return transition.browseName.toString();
                    })
                );
            }

            if (doDebug) {
                debugLog(" NodeId = ", nodeId.toString());
            }
            const boiler = await proxyManager.getObject(nodeId) as any;
            if (doDebug) {
                debugLog("Current State", boiler.simulation.currentState.toString());
            }
            const value = boiler.simulation.currentState.readValue();
            if (doDebug) {
                debugLog(" Interior temperature updated ...", value.toString());
            }
            await boiler.simulation.halt([]);

            await boiler.simulation.reset([]);

            await new Promise((resolve) => setTimeout(resolve, 500));
            debugLog(boiler.simulation.currentState.toString());

            boiler.simulation.currentState.dataValue.value.value.text.should.eql("Ready");

            boiler.simulation.$methods["start"].executableFlag.should.eql(
                true,
                "When system is Ready, start method shall be executable"
            );
            boiler.simulation.$methods["suspend"].executableFlag.should.eql(
                false,
                "When system is Ready, suspend method shall not be executable"
            );
            boiler.simulation.$methods["resume"].executableFlag.should.eql(
                true,
                "When system is Ready , start method shall be executable"
            );

            if (doDebug) {
                debugLog(
                    chalk.bgWhite.cyan("    ====================================================================== STARTING .... ")
                );
            }
            await boiler.simulation.start([]);


            await new Promise((resolve) => setTimeout(resolve, 500));

            if (doDebug) {
                debugLog(
                    chalk.bgWhite.cyan("    ====================================================================== STARTED .... ")
                );
            }

            boiler.simulation.currentState.dataValue.value.value.text.should.eql("Running");
            boiler.simulation.$methods["start"].executableFlag.should.eql(
                false,
                "when system is Running, start method shall NOT be executable"
            );
            boiler.simulation.$methods["suspend"].executableFlag.should.eql(
                true,
                "when system is Running, suspend method shall be executable"
            );
            boiler.simulation.$methods["resume"].executableFlag.should.eql(
                false,
                "when system is Running, resume method shall NOT be executable"
            );

            await boiler.simulation.suspend([]);


            await proxyManager.stop();
        });
    });
});
