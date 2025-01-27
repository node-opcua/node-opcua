"use strict";
const should = require("should");
const chalk = require("chalk");

const { OPCUAClient, OPCUAServer, SessionContext } = require("node-opcua");
const context = SessionContext.defaultContext;


const { makeBoiler } = require("node-opcua-address-space/testHelpers");
const { UAProxyManager } = require("node-opcua-client-proxy");

const { make_debugLog, checkDebugFlag } = require("node-opcua-debug");
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing monitoring Executable flags on methods", function () {
    this.timeout(Math.max(60000, this.timeout()));

    let server, client, endpointUrl;

    let boiler_on_server;
    const port = 2006;
    before(async () => {
        const options = { port };
        server = new OPCUAServer(options);

        await server.initialize();

        boiler_on_server = makeBoiler(server.engine.addressSpace, { browseName: "Boiler#1" });

        const haltMethod = boiler_on_server.simulation.getMethodByName("Halt");
        const resetMethod = boiler_on_server.simulation.getMethodByName("Reset");
        const startMethod = boiler_on_server.simulation.getMethodByName("Start");
        const suspendMethod = boiler_on_server.simulation.getMethodByName("Suspend");
        haltMethod.getExecutableFlag(context).should.eql(true);
        resetMethod.getExecutableFlag(context).should.eql(false);
        startMethod.getExecutableFlag(context).should.eql(true);
        suspendMethod.getExecutableFlag(context).should.eql(false);

        boiler_on_server = boiler_on_server.nodeId;

        await server.start();

        endpointUrl = server.getEndpointUrl();
    });

    beforeEach(async () => {
        client = OPCUAClient.create();
    });

    afterEach(async () => {
        client = null;
    });

    after(async () => {
        await server.shutdown();
    });

    it("#187 ...... ", async () => {
        let proxyManager;

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
            const boiler = await proxyManager.getObject(nodeId);
            if (doDebug) {
                debugLog("Current State", boiler.simulation.currentState.toString());
            }
            const value = boiler.simulation.currentState.readValue();
            if (doDebug) {
                debugLog(" Interior temperature updated ...", value.toString());
            }
            await boiler.simulation.halt([]);

            await boiler.simulation.reset([]);
            if (doDebug) {
                debugLog(" Reset => ", err);
            }
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
            if (doDebug) {
                debugLog(" start => ", err);
            }

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

            boiler.simulation.suspend([]);
            if (doDebug) {
                debugLog(" start => ", err);
            }

            await proxyManager.stop();
        });
    });
});
