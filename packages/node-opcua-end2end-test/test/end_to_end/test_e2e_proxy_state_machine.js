"use strict";

const async = require("async");
require("should");
const { UAProxyManager } = require("node-opcua-client-proxy");
const { getAddressSpaceFixture } = require("node-opcua-address-space/testHelpers");

const { build_client_server_session } = require("../../test_helpers/build_client_server_session");



// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing client Proxy State Machine", function() {

    this.timeout(Math.max(200000, this.timeout()));

    const port = 2245;
    const serverOptions = {
        port,
        nodeset_filename: [
            getAddressSpaceFixture("fixture_simple_statemachine_nodeset2.xml"),
        ]
    };

    let session;
    let client_server;

    before(async () => {
        client_server = await build_client_server_session(serverOptions);
        session = client_server.g_session;
    });

    function dumpStats() {
        const client = client_server.g_session._client;
        console.log("            bytesRead  ", client.bytesRead, " bytes");
        console.log("            bytesRead  ", client.bytesRead, " bytes");
        console.log("transactionsPerformed  ", client.transactionsPerformed, " ");

    }
    after( async () => {
        dumpStats();
        await client_server.shutdown();
    });


    /*
     @startuml exclusiveLimitStateMachineType

     9329: HighHigh
     9331: High
     9333: Low
     9335: LowLow
     9335 --> 9333 :   "9337\nLowLowToLow"
     9333 --> 9335 :   "9338\nLowToLowLow"
     9329 --> 9331 :   "9339\nHighHighToHigh"
     9331 --> 9329 :   "9340\nHighToHighHigh"

     @enduml
     */
    it("Z1a should read a state machine", function(done) {

        dumpStats();

        const proxyManager = new UAProxyManager(session);

        async.series([
            function(callback) {
                proxyManager.start(callback);
            },
            function(callback) {
                const exclusiveLimitStateMachineType = "ExclusiveLimitStateMachineType";

                proxyManager.getStateMachineType(exclusiveLimitStateMachineType, function(err, obj) {

                    dumpStats();

                    if (!err) {

                        console.log("InitialState = ", obj.initialState ? obj.initialState.toString() : "<null>");

                        console.log("States       = ", obj.states.map(function(state) {
                            return state.browseName.toString();
                        }));
                        console.log("Transitions  = ", obj.transitions.map(function(transition) {
                            return transition.browseName.toString();
                        }));

                    }
                    callback(err);
                });
            },
            function(callback) {
                proxyManager.stop(callback);
            }
        ], done);
    });

    it("Z1b should read a state machine", function(done) {


        const proxyManager = new UAProxyManager(session);

        async.series([
            function(callback) {
                proxyManager.start(callback);
            },
            function(callback) {
                const ShelvedStateMachineType = "ShelvedStateMachineType";

                proxyManager.getStateMachineType(ShelvedStateMachineType, function(err, obj) {

                    if (!err) {

                        console.log("InitialState = ", obj.initialState ? obj.initialState.toString() : "<null>");

                        console.log("States       = ", obj.states.map(function(state) {
                            return state.browseName.toString();
                        }));
                        console.log("Transitions  = ", obj.transitions.map(function(transition) {
                            return transition.browseName.toString();
                        }));

                    }
                    callback(err);
                });
            },
            function(callback) {
                proxyManager.stop(callback);
            }
        ], done);
    });
});
