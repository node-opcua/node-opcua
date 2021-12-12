/* eslint-disable max-statements */
"use strict";
import { Socket } from "net";
import * as fs from "fs";
import * as should from "should";
import * as async from "async";
import {
    DataType,
    MessageSecurityMode,
    SecurityPolicy,
    ClientSubscription,
    AttributeIds,
    OPCUAClient,
    StatusCodes,
    ClientMonitoredItem,
    Variant,
    TimestampsToReturn,
    OPCUAServer,
    NodeId,
    UAVariable,
    ClientSession,
    ConnectionStrategy,
    ConnectionStrategyOptions
} from "node-opcua";
import * as chalk from "chalk";

import { readCertificate } from "node-opcua-crypto";

import { make_debugLog, checkDebugFlag, make_errorLog } from "node-opcua-debug";

const debugLog = make_debugLog("TEST");
const errorLog = make_errorLog("TEST");
const doDebug = checkDebugFlag("TEST");

const port = 2014;

const { build_server_with_temperature_device } = require("../../test_helpers/build_server_with_temperature_device");

const fail_fast_connectivity_strategy = {
    maxRetry: 1,
    initialDelay: 10,
    maxDelay: 20,
    randomisationFactor: 0
};
const robust_connectivity_strategy = {
    maxRetry: 100,
    initialDelay: 10,
    maxDelay: 200,
    randomisationFactor: 0
};
const custom_connectivity_strategy = {
    maxRetry: 100,
    initialDelay: 80,
    maxDelay: 100,
    randomisationFactor: 0
};

const infinite_connectivity_strategy = {
    maxRetry: 1000000,
    initialDelay: 10,
    maxDelay: 200,
    randomisationFactor: 0
};

const f = require("../../test_helpers/display_function_name").f.bind(null, doDebug);

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("KJH1 testing basic Client-Server communication", function (this: Mocha.Test) {
    let server: OPCUAServer;
    let client: OPCUAClient;
    let temperatureVariableId: NodeId;
    let endpointUrl: string;

    this.timeout(Math.max(20000, this.timeout()));

    before(async () => {
        server = await build_server_with_temperature_device({ port });
        endpointUrl = server.getEndpointUrl();
        temperatureVariableId = (server as any).temperatureVariableId;
    });

    beforeEach(async () => {
        // use fail fast connectionStrategy
        const options = {
            connectionStrategy: fail_fast_connectivity_strategy,
            endpointMustExist: false
        };
        client = OPCUAClient.create(options);
        client.on("connection_reestablished", function () {
            debugLog(chalk.bgWhite.black(" !!!!!!!!!!!!!!!!!!!!!!!!  CONNECTION RE-ESTABLISHED !!!!!!!!!!!!!!!!!!!"));
        });
        client.on("backoff", function (number, delay) {
            debugLog(chalk.bgWhite.yellow("backoff  attempt #"), number, " retrying in ", delay / 1000.0, " seconds");
        });
        client.on("start_reconnection", function () {
            debugLog(chalk.bgWhite.black(" !!!!!!!!!!!!!!!!!!!!!!!!  Starting Reconnection !!!!!!!!!!!!!!!!!!!"));
        });
    });

    afterEach(async () => {
        await client.disconnect();
        client = null as any;
    });

    after(async () => {
        should.not.exist(client, "client still running");
        await server.shutdown();
    });

    it("TR01 - a client should connect to a server and disconnect ", async () => {
        server.currentChannelCount.should.equal(0);

        client.protocolVersion.should.eql(0);

        await client.connect(endpointUrl);

        server.currentChannelCount.should.equal(1);

        await client.disconnect();

        await new Promise((resolve) => setTimeout(resolve, 100));
        server.currentChannelCount.should.equal(0);
    });

    it("TR02 - a server should not accept a connection when the protocol version is incompatible", async () => {
        (client as any).protocolVersion = 0xdeadbeef; // set a invalid protocol version
        server.currentChannelCount.should.equal(0);

        debugLog(" connect");
        let _err: Error | undefined = undefined;
        try {
            await client.connect(endpointUrl);
        } catch (err) {
            _err = err as Error;
        }
        debugLog(chalk.yellow.bold(" Error ="), _err);
        if (!_err) {
            throw new Error("Expecting an error here");
        }

        await new Promise<void>((resolve) => setTimeout(resolve, 10));
        server.currentChannelCount.should.equal(0);
    });

    it("TR03 - a client shall be able to create a session with a anonymous token", async () => {
        server.currentChannelCount.should.equal(0);

        debugLog(" connect");
        await client.connect(endpointUrl);
        debugLog(" createSession");
        const session = await client.createSession();

        debugLog("closing session");
        await session.close();
        debugLog("Disconnecting client");
        await client.disconnect();
        // relax a little bit so that server can complete pending operations
        await new Promise((resolve) => setTimeout(resolve, 1));
        await new Promise((resolve) => setTimeout(resolve, 1));
        debugLog("finally");
        server.currentChannelCount.should.equal(0);
    });

    it("TR04 - a client shall be able to reconnect if the first connection has failed", async () => {
        server.currentChannelCount.should.equal(0);

        (client as any).protocolVersion = 0;

        const unused_port = 8909;
        const bad_endpointUrl = "opc.tcp://" + "localhost" + ":" + unused_port;

        let _err: Error | undefined = undefined;
        try {
            await client.connect(bad_endpointUrl);
        } catch (err) {
            _err = err as Error;
        }
        _err!.message.should.match(/connect ECONNREFUSED/);

        await client.connect(endpointUrl);
        await client.disconnect();
    });

    it("TR05 - a client shall be able to connect & disconnect many times", async () => {
        server.currentChannelCount.should.equal(0);

        async function relax_for_a_little_while(): Promise<void> {
            await new Promise<void>((resolve) => setTimeout(resolve, 20));
        }

        await client.connect(endpointUrl);

        server.currentChannelCount.should.equal(1);
        await client.disconnect();

        await relax_for_a_little_while();

        server.currentChannelCount.should.equal(0);
        await client.connect(endpointUrl);
        server.currentChannelCount.should.equal(1);
        await client.disconnect();
        await relax_for_a_little_while();
        server.currentChannelCount.should.equal(0);
        await client.connect(endpointUrl);
        server.currentChannelCount.should.equal(1);
        await client.disconnect();

        await relax_for_a_little_while();
        server.currentChannelCount.should.equal(0);
    });

    it("TR06 - a client shall raise an error when trying to create a session on an invalid endpoint", function (done) {
        // this is explained here : see OPCUA Part 4 Version 1.02 $5.4.1 page 12:
        //   A  Client  shall verify the  HostName  specified in the  Server Certificate  is the same as the  HostName
        //   contained in the  endpointUrl  provided in the  EndpointDescription. If there is a difference  then  the
        //   Client  shall report the difference and may close the  SecureChannel.
        async.series(
            [
                function (callback) {
                    (client as any).endpointMustExist = true;
                    client.connect(endpointUrl + "/someCrap", callback);
                },

                function (callback) {
                    client.createSession(function (err, session) {
                        should.not.exist(session);
                        should.exist(err);
                        callback(err ? null : new Error("Expecting a failure"));
                    });
                },

                function (callback) {
                    client.disconnect(callback);
                }
            ],
            done
        );
    });
    it("TR07 - calling connect on the client twice shall return a error the second time", async () => {
        server.currentChannelCount.should.equal(0);

        (client as any).protocolVersion = 0;
        await client.connect(endpointUrl);

        let _err: Error | undefined = undefined;
        try {
            await client.connect(endpointUrl);
        } catch (err) {
            _err = err as Error;
        }
        await client.disconnect();
        _err!.should.be.instanceOf(Error);
    });
});

describe("KJH2 testing ability for client to reconnect when server close connection", function (this: Mocha.Test) {
    this.timeout(Math.max(60000, this.timeout()));

    let server: OPCUAServer | undefined = undefined;
    let endpointUrl: string;
    let temperatureVariableId: NodeId;

    let counterNode: UAVariable;
    let timerId: NodeJS.Timer | undefined = undefined;
    // -----------------------------------------------------------------------------------------------------------------
    // Common Steps
    // -----------------------------------------------------------------------------------------------------------------

    async function trustClientCertificateOnServer(client: OPCUAClient, server: OPCUAServer): Promise<void> {
        if (!server) {
            return;
        }
        const clientCertificateFilename = client.certificateFile;
        fs.existsSync(clientCertificateFilename).should.eql(true, " certificate must exist");
        const certificate = readCertificate(clientCertificateFilename);
        await server.serverCertificateManager.trustCertificate(certificate);
    }

    async function start_demo_server_async() {
        server = await build_server_with_temperature_device({ port });

        endpointUrl = server!.getEndpointUrl();
        temperatureVariableId = (server as any).temperatureVariableId;

        const namespace = server!.engine.addressSpace!.getOwnNamespace();

        let c = 0;

        counterNode = namespace.addVariable({
            browseName: "Counter",
            organizedBy: server!.engine.addressSpace!.rootFolder.objects,
            dataType: "UInt32",
            value: new Variant({ dataType: DataType.UInt32, value: c })
        });
        timerId = setInterval(function () {
            c = c + 1;
            counterNode.setValueFromSource(new Variant({ dataType: "UInt32", value: c }), StatusCodes.Good);
        }, 100);
    }

    async function shutdown_server_async() {
        should(server).not.eql(null, "server not started ?");
        if (timerId) {
            clearInterval(timerId);
            timerId = undefined;
        }
        await server!.shutdown();
        server = undefined;
    }

    async function start_demo_server() {
        await start_demo_server_async();
    }
    async function shutdown_server() {
        await shutdown_server_async();
    }

    // -----------------------------------------------------------------------------------------------------------------
    async function suspend_demo_server() {
        await server!.suspendEndPoints();
    }

    async function resume_demo_server() {
        await server!.resumeEndPoints();
    }

    async function restart_server() {
        should(server).eql(null, "server already started ?");
        await start_demo_server_async();
    }

    async function verify_that_server_has_no_active_channel() {
        server!.currentChannelCount.should.equal(0);
    }

    async function wait_for(duration: number): Promise<void> {
        await new Promise<void>((resolve) => {
            setTimeout(function () {
                resolve();
            }, duration);
        });
    }

    async function wait_a_little_while() {
        await wait_for(800);
    }

    let client: OPCUAClient | undefined = undefined;
    let client_has_received_close_event = 0;
    let client_has_received_start_reconnection_event = 0;
    let client_has_received_connection_reestablished_event = 0;
    let client_has_received_connection_lost_event = 0;

    let backoff_counter = 0;
    let requestedSessionTimeout = 30000;

    beforeEach(() => {
        requestedSessionTimeout = 30000;
    });
    afterEach(() => {
        should.not.exist(client, "client must have been disposed");
    });

    async function create_client_and_create_a_connection_to_server(_options: any, connectionStrategy: ConnectionStrategyOptions) {
        should.not.exist(client, "expecting no client");

        should.not.exist(client, "Already have a client ");

        client = OPCUAClient.create({
            securityMode: _options.securityMode || MessageSecurityMode.None,
            securityPolicy: _options.securityPolicy || SecurityPolicy.None,
            keepSessionAlive: true,
            // requestedSessionTimeout: _options.requestedSessionTimeout || requestedSessionTimeout,
            connectionStrategy: connectionStrategy,
            requestedSessionTimeout: 120 * 60 * 1000 // 2 hours
        });

        client.on("keepalive", () => {
            debugLog("keep alive");
        });
        client_has_received_close_event = 0;
        client_has_received_start_reconnection_event = 0;
        client_has_received_connection_reestablished_event = 0;
        client_has_received_connection_lost_event = 0;

        client.on("close", (err: Error) => {
            if (err) {
                //xx console.log("err=", err.message);
            }
            client_has_received_close_event += 1;
        });

        client.on("start_reconnection", () => {
            client_has_received_start_reconnection_event += 1;
            debugLog(chalk.whiteBright(" !!!!!!!!!!!!!!!!!!!!!!!!  Starting Reconnection !!!!!!!!!!!!!!!!!!!"));
            debugLog("starting reconnection");
        });
        client.on("backoff", (number, delay) => {
            debugLog(chalk.bgWhite.yellow("backoff  attempt #"), number, " retrying in ", delay / 1000.0, " seconds");
            backoff_counter += 1;
        });
        client.on("connection_reestablished", function () {
            client_has_received_connection_reestablished_event += 1;
            debugLog(chalk.whiteBright(" !!!!!!!!!!!!!!!!!!!!!!!!  CONNECTION RE-ESTABLISHED !!!!!!!!!!!!!!!!!!!"));
        });
        client.on("connection_lost", function () {
            client_has_received_connection_lost_event += 1;
            debugLog(chalk.whiteBright(" !!!!!!!!!!!!!!!!!!!!!!!!  CONNECTION LOST !!!!!!!!!!!!!!!!!!!"));
        });

        await trustClientCertificateOnServer(client, server!);

        if (_options.doNotWaitForConnection) {
            client!.connect(endpointUrl);
        } else {
            await client!.connect(endpointUrl);
        }
    }

    async function disconnect_client() {
        await client!.disconnect();
        client = undefined;
    }

    async function disconnect_client_while_reconnecting() {
        await client!.disconnect();
    }

    async function reset_backoff_counter() {
        backoff_counter = 0;
    }

    async function assert_NO_backoff_event_since_last_reset() {
        backoff_counter.should.eql(0);
    }

    async function assert_has_received_some_backoff_event_since_last_reset() {
        backoff_counter.should.be.greaterThan(0);
    }

    async function verify_that_client_fails_to_connect(connectivity_strategy: ConnectionStrategy) {
        await create_client_and_create_a_connection_to_server({}, connectivity_strategy);
        // ig (-await  disconnect_client();

        //         done(err ? null : new Error("Expecting an error here"));
        //     });
        // });
    }

    async function verify_that_client_has_received_a_single_start_reconnection_event() {
        client_has_received_start_reconnection_event.should.eql(1, "expecting 'start_reconnection' event to be emitted only once");
    }

    async function verify_that_client_has_received_a_single_close_event() {
        client_has_received_close_event.should.eql(1, "expecting close event to be emitted only once");
    }

    async function verify_that_client_is_connected() {
        // to do : do something useful here
    }

    async function verify_that_client_is_trying_to_connect() {
        // wait a little bit and check that client has started the reconnection process
        await new Promise((resolve) => setTimeout(resolve, 1000));
        client!.isReconnecting.should.eql(true, "verify_that_client_is_trying_to_reconnect");
    }

    async function _waitUntil(lambda: () => boolean, timeout: number, errorMessage: string): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            let timerId: NodeJS.Timer | undefined = setTimeout(() => {
                timerId = undefined;
                reject(new Error(errorMessage));
            }, timeout);

            function _waitAndTest() {
                setTimeout(() => {
                    if (lambda()) {
                        if (timerId) {
                            clearTimeout(timerId);
                            timerId = undefined;
                        }
                        resolve();
                    } else {
                        _waitAndTest();
                    }
                }, 100);
            }
            _waitAndTest();
        });
    }

    async function verify_that_client_is_trying_to_reconnect() {
        client_has_received_connection_lost_event.should.be.above(0);
        await verify_that_client_is_trying_to_connect();
    }

    async function verify_that_client_is_NOT_trying_to_reconnect(): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            setImmediate(function () {
                if (!client) {
                    return resolve();
                }
                try {
                    client.isReconnecting.should.eql(false, "verify_that_client_is_NOT_trying_to_reconnect");
                } catch (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }

    async function wait_for_reconnection_to_be_completed() {
        await new Promise<void>((resolve) => {
            client!.once("after_reconnection", () => {
                resolve();
            });
        });
    }

    async function verify_that_client_has_NOT_received_a_close_event() {
        client_has_received_close_event.should.eql(0, "expecting close event NOT to be emitted");
    }

    it("TR10 - should be possible to reconnect client after the server closed the connection", async () => {
        // steps:
        //  -     Given a running demo server
        //  - and Given a client that has been configured  with a fail fast reconnection strategy
        //  - and Given that the client is  connected to the server
        //
        //  -     When the server shuts down
        //  - and When the reconnection time has been exhausted.
        //
        //  -     Then I should verify that client has received a "close" notification, only once
        //
        //  -     Given that the server has been restarted
        //  -     When  we reuse the same client to reconnect to server
        // -      Then I should verify that client can connect successfully
        // cleanup:
        //   - disconnect client
        //   - disconnect server
        //---------------------------------------------------------------

        async function reuse_same_client_to_reconnect_to_server() {
            await client!.connect(endpointUrl);
        }

        await f(start_demo_server);
        // use fail fast connectionStrategy
        await f(create_client_and_create_a_connection_to_server.bind(null, {}, fail_fast_connectivity_strategy));
        await f(shutdown_server);
        //f(wait_a_little_while);
        await f(verify_that_client_is_trying_to_reconnect);
        await f(disconnect_client_while_reconnecting);
        await f(wait_a_little_while);
        await f(verify_that_client_has_received_a_single_close_event);
        await f(restart_server);
        await f(reuse_same_client_to_reconnect_to_server);
        await f(verify_that_client_is_connected);
        await f(disconnect_client);
        await f(verify_that_server_has_no_active_channel);
        await f(shutdown_server);
    });

    it("TR11 - a client should be able to reconnect automatically to the server when the server restarts after a server failure", async () => {
        // steps:
        //  -     Given a running demo server
        //  - and Given a client that has been configured  with a robust reconnection strategy
        //  - and Given that the client is  connected to the server
        //
        //  -     When the server shuts down
        //  - and When the server restarts after a little while
        //
        //  -     Then I should verify that client has *NOT* received a "close" notification
        //  -     and that the client can still communicate with server
        //
        // cleanup:
        //   - disconnect client
        //   - disconnect server

        await f(start_demo_server);
        // use robust  connectionStrategy
        await f(create_client_and_create_a_connection_to_server.bind(null, {}, robust_connectivity_strategy));
        await f(shutdown_server);
        await f(wait_a_little_while);
        await f(verify_that_client_is_trying_to_reconnect);
        await f(wait_a_little_while);
        await f(verify_that_client_has_NOT_received_a_close_event);
        await f(verify_that_client_is_trying_to_reconnect);
        await f(verify_that_client_has_received_a_single_start_reconnection_event);
        await f(restart_server);
        await f(wait_a_little_while);
        await f(wait_a_little_while);
        await f(verify_that_client_is_connected);
        await f(verify_that_client_is_NOT_trying_to_reconnect);
        await f(verify_that_client_has_received_a_single_start_reconnection_event);
        await f(disconnect_client);
        await f(verify_that_server_has_no_active_channel);
        await f(shutdown_server);
    });

    it("TR12 - a client should be able to reconnect automatically to the server when the server restarts after a server failure", async () => {
        await f(start_demo_server);
        // use robust  connectionStrategy
        await f(create_client_and_create_a_connection_to_server.bind(null, {}, robust_connectivity_strategy));

        await f(shutdown_server);
        await f(wait_a_little_while);
        await f(verify_that_client_is_trying_to_reconnect);
        await f(wait_a_little_while);
        await f(verify_that_client_has_NOT_received_a_close_event);
        await f(verify_that_client_is_trying_to_reconnect);
        await f(verify_that_client_has_received_a_single_start_reconnection_event);
        await f(restart_server);
        await f(wait_a_little_while);
        await f(wait_a_little_while);
        await f(verify_that_client_is_connected);
        await f(verify_that_client_is_NOT_trying_to_reconnect);
        await f(verify_that_client_has_received_a_single_start_reconnection_event);

        // reset client reconnection event counter

        client_has_received_start_reconnection_event = 0;

        // Shutdown the server again
        await f(shutdown_server);
        await f(wait_a_little_while);
        await f(verify_that_client_is_trying_to_reconnect);
        await f(wait_a_little_while);
        await f(verify_that_client_has_NOT_received_a_close_event);
        await f(verify_that_client_is_trying_to_reconnect);
        await f(verify_that_client_has_received_a_single_start_reconnection_event);
        await f(restart_server);
        await f(wait_a_little_while);
        await f(wait_a_little_while);
        await f(verify_that_client_is_connected);
        await f(verify_that_client_is_NOT_trying_to_reconnect);
        await f(verify_that_client_has_received_a_single_start_reconnection_event);

        await f(disconnect_client);
        await f(verify_that_server_has_no_active_channel);
        await f(shutdown_server);
    });

    it("TR13 - it should be possible to disconnect a client which is in the middle a reconnection sequence", async () => {
        await f(start_demo_server);
        // use robust connectionStrategy
        await f(create_client_and_create_a_connection_to_server.bind(null, {}, robust_connectivity_strategy));
        await f(shutdown_server);
        await f(wait_a_little_while);
        await f(verify_that_client_is_trying_to_reconnect);
        await f(wait_a_little_while);
        await f(disconnect_client);
        await f(wait_a_little_while);
        await f(verify_that_client_is_NOT_trying_to_reconnect);
        await f(wait_a_little_while);
        await f(verify_that_client_is_NOT_trying_to_reconnect);
    });

    it("TR14 - it should be possible to disconnect a client which is attempting to establish it's first connection to a unavailable server", async () => {
        const endpointUrl = "opc.tcp://localhost:11111"; // uri of an unavailable opcua server

        // use robust connectionStrategy
        await f(
            create_client_and_create_a_connection_to_server.bind(
                null,
                { doNotWaitForConnection: true },
                robust_connectivity_strategy
            )
        );
        await f(wait_a_little_while);
        await f(verify_that_client_is_trying_to_connect);
        await f(wait_a_little_while);
        await f(disconnect_client);
        await f(wait_a_little_while);
        await f(verify_that_client_is_NOT_trying_to_reconnect);
        await f(wait_a_little_while);
        await f(verify_that_client_is_NOT_trying_to_reconnect);
    });

    let session: ClientSession | undefined = undefined;
    async function client_create_and_activate_session() {
        session = await client!.createSession();
    }

    let subscription: ClientSubscription | undefined = undefined;

    async function create_subscription() {
        subscription = await session!.createSubscription2({
            requestedPublishingInterval: 250,
            requestedLifetimeCount: 12000,
            requestedMaxKeepAliveCount: 4 * 60 * 2, // 4 x 250 ms * 60* 2 = 2 min
            maxNotificationsPerPublish: 1000,
            publishingEnabled: true,
            priority: 6
        });
    }

    async function terminate_subscription() {
        //xx console.log(" subscription.publish_engine.subscriptionCount", subscription.publish_engine.subscriptionCount);
        subscription!.on("terminated", function () {
            //xx console.log(" subscription.publish_engine.subscriptionCount", subscription.publish_engine.subscriptionCount);
        });
        await subscription!.terminate();
    }

    let values_to_check: any[] = [];

    let monitoredItem: ClientMonitoredItem | undefined = undefined;

    async function monitor_monotonous_counter() {
        if (monitoredItem) {
            errorLog(" warning = already monitoring");
            monitoredItem.removeAllListeners();
            monitoredItem = undefined;
            // return callback(new Error("Already monitoring"));
        }

        monitoredItem = await subscription!.monitor(
            {
                // nodeId: makeNodeId(VariableIds.Server_ServerStatus_CurrentTime);
                nodeId: counterNode.nodeId,
                attributeId: AttributeIds.Value
            },
            {
                samplingInterval: 0, // 0 : event base => whenever value changes
                discardOldest: true,
                queueSize: 1000
            },
            TimestampsToReturn.Both
        );

        monitoredItem!.on("changed", function (dataValue) {
            if (doDebug) {
                debugLog(" client ", " received value change ", dataValue.value.toString());
            }
            values_to_check.push(dataValue.value.value);
        });
    }

    async function wait_until_next_notification() {
        await new Promise((resolve) => {
            monitoredItem!.once("changed", function (dataValue) {
                setTimeout(resolve, 1);
            });
        });
    }

    let previous_value_count = 0;

    afterEach(async () => {
        if (monitoredItem) {
            monitoredItem!.removeAllListeners();
            monitoredItem = undefined;
        }
    });

    async function reset_continuous() {
        //xx console.log(" resetting value to check");
        values_to_check = [];
        previous_value_count = 0;
    }

    async function ensure_continuous() {
        // ensure we have more value than previous call
        await wait_until_next_notification();

        // ensure that series is continuous
        if (doDebug) {
            console.log(values_to_check.join(" "));
        }

        // let check that new values have been received
        // when the following test fails, this probably means that the publish mechanism is not working as expected
        values_to_check.length.should.be.greaterThan(
            previous_value_count + 1,
            " expecting that new values have been received since last check : values_to_check = " +
                values_to_check +
                " != " +
                (previous_value_count + 1)
        );

        if (values_to_check.length > 0) {
            const lastValue = values_to_check[values_to_check.length - 1];
            const expectedLastValue = values_to_check[0] + values_to_check.length - 1;
            if (lastValue > expectedLastValue) {
                console.log(" Warning ", values_to_check.join(" "));
            }
            // lastValue.should.be.belowOrEqual(expectedLastValue);
        }
        previous_value_count = values_to_check.length;
    }

    async function break_connection(socketError: string) {
        const _client = client as any;
        const clientSocket: Socket = _client._secureChannel._transport._socket;
        clientSocket.end();
        clientSocket.destroy();
        clientSocket.emit("error", new Error(socketError));

        /*
         server.endpoints.forEach(function(endpoint){
             endpoint.killClientSockets(function() {
             });
         });
          */

        await new Promise((resolve) => setImmediate(resolve));
    }

    async function simulate_connection_break(breakage_duration: number, socketError: string): Promise<void> {
        debugLog("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! Breaking connection for ", breakage_duration, " ms");
        await f(suspend_demo_server);
        await f(break_connection.bind(null, socketError));
        await f(wait_for.bind(null, breakage_duration));
        await f(resume_demo_server);
    }

    function get_server_side_subscription() {
        const channels = (server!.endpoints[0] as any)._channels;
        debugLog("channels keys = ", Object.keys(channels).join(" "));

        //xxx var channelKey = Object.keys(channels)[0];
        //xx var channel = channels[channelKey];
        //xx assert(Object.keys(server.engine._sessions).length === 1);

        const sessionKey = Object.keys((server!.engine as any)._sessions)[0];
        const session = (server!.engine as any)._sessions[sessionKey];

        const subscriptionKeys = Object.keys(session.publishEngine._subscriptions);
        subscriptionKeys.length.should.eql(1);
        return session.publishEngine._subscriptions[subscriptionKeys[0]];
    }

    // let make sure it will timeout almost immediately
    async function accelerate_subscription_timeout(subscription: ClientSubscription): Promise<void> {
        const _subscription = subscription as any;
        debugLog(
            "accelerate_subscription_timeout",
            _subscription.id,
            " =>  _life_time_counter = ",
            _subscription._life_time_counter,
            _subscription.lifeTimeCount
        );
        _subscription._life_time_counter = _subscription.lifeTimeCount - 1;

        await new Promise((resolve) => {
            subscription.once("terminated", function () {
                setImmediate(resolve);
            });
        });
    }

    async function wait_until_server_subscription_has_timed_out() {
        const server_subscription = get_server_side_subscription();
        // let's cheat a little bit => we don't really want to wait until subscriptions times out
        await accelerate_subscription_timeout(server_subscription);
    }

    async function simulate_very_long_connection_break_until_subscription_times_out(socketError: string) {
        await f(suspend_demo_server);
        await f(break_connection.bind(null, socketError));
        await f(wait_until_server_subscription_has_timed_out);
        await f(wait_for.bind(null, 40 * 100));
        await f(resume_demo_server);
        // in this case, the server drops all Subscriptions due to max lifetime count exhausted.
    }

    it("TR15 - verify that server can suspend socket connection - useful for testing purposes", async () => {
        await f(start_demo_server);
        await f(create_client_and_create_a_connection_to_server.bind(null, {}, robust_connectivity_strategy));
        await f(disconnect_client);
        await f(suspend_demo_server);

        // verify that client cannot connect anymore
        await f(verify_that_client_fails_to_connect.bind(null, fail_fast_connectivity_strategy));

        await f(resume_demo_server);

        // verify that client can connect again
        await f(create_client_and_create_a_connection_to_server.bind(null, {}, robust_connectivity_strategy));
        await f(disconnect_client);

        await f(shutdown_server);
    });

    it("TR16 - a client with some active monitoring items should be able to seamlessly reconnect after a connection break - and retrieve missed notification without lost ( Republish)", async () => {
        await f(start_demo_server), await f(reset_continuous);
        // use robust connectionStrategy
        await f(create_client_and_create_a_connection_to_server.bind(null, {}, custom_connectivity_strategy));
        await f(client_create_and_activate_session);
        await f(create_subscription);
        await f(monitor_monotonous_counter);
        await f(wait_until_next_notification);
        await f(ensure_continuous);
        await f(wait_until_next_notification);
        await f(ensure_continuous);
        await f(wait_until_next_notification);
        await f(ensure_continuous);
        await f(wait_until_next_notification);
        await f(ensure_continuous);

        // now drop connection  for 1.5 seconds
        await f(simulate_connection_break.bind(null, 5000, "ECONNRESET"));
        // make sure that we have received all notifications
        // (thanks to republish )

        await f(wait_until_next_notification);
        await f(ensure_continuous);
        await f(wait_until_next_notification);
        await f(wait_until_next_notification);
        await f(ensure_continuous);

        await f(terminate_subscription);
        await f(disconnect_client);
        await f(shutdown_server);
    });

    it("TR17 - a client with some active monitoring items should be able to seamlessly reconnect after a very long connection break exceeding subscription lifetime", async () => {
        // a client with some active monitoring items should be able to seamlessly reconnect
        // after a very long connection break exceeding subscription lifetime.
        // In this case, the subscription on the server side has been deleted, therefore the client shall
        // recreate the subscription and resubscribe to the monitored items

        await f(start_demo_server);
        await f(reset_continuous);
        // use robust connectionStrategy
        await f(create_client_and_create_a_connection_to_server.bind(null, {}, custom_connectivity_strategy));
        await f(client_create_and_activate_session);
        await f(create_subscription);
        await f(monitor_monotonous_counter);

        await f(wait_a_little_while);
        await f(wait_until_next_notification);
        await f(ensure_continuous);

        await f(wait_a_little_while);
        await f(wait_until_next_notification);
        await f(ensure_continuous);

        // now drop connection  for a long time, so that server
        // has to delete all pending subscriptions....
        await f(simulate_very_long_connection_break_until_subscription_times_out.bind(null, "ECONNRESET"));

        await f(reset_continuous);
        await f(wait_a_little_while);
        await f(wait_a_little_while);
        await f(wait_a_little_while);
        await f(wait_until_next_notification);
        await f(ensure_continuous);

        await f(wait_a_little_while);
        await f(wait_until_next_notification);
        await f(ensure_continuous);

        await f(wait_a_little_while);
        await f(wait_until_next_notification);
        await f(ensure_continuous);

        await f(terminate_subscription);

        await f(disconnect_client);
        await f(shutdown_server);
    });

    xit("TR18 - a client with some active monitored items should be able to reconnect seamlessly after a very long connection break exceeding session life time", async () => {
        // to do
    });

    it("TR19 -  disconnecting during connect", async () => {
        // Given a client that has a infinite connection retry strategy,
        //   And that client#connect is call to connect to an non-existent server.
        //
        //  When client#disconnect is called
        //
        //  Then the client should complete the client#connect async call with and err;
        //   And the client should stop the automatic reconnection strategy (backoff)
        // to do

        // Given a client that has a infinite connection retry strategy,
        //   And that client#connect is call to connect to an non-existent server.
        //
        let client_has_received_close_event = 0;
        let client_has_received_connected_event = 0;
        let client_has_received_start_reconnection_event = 0;

        const options = { connectionStrategy: infinite_connectivity_strategy };
        const client = OPCUAClient.create(options);

        client.on("close", (err: Error) => {
            if (err) {
                console.log("err=", err.message);
            }
            client_has_received_close_event += 1;
        });
        client.on("connected", () => {
            client_has_received_connected_event += 1;
        });

        client.on("start_reconnection", function () {
            client_has_received_start_reconnection_event += 1;
        });

        let backoff_event_counter = 0;
        client.on("backoff", function () {
            backoff_event_counter += 1;
        });

        endpointUrl = "opc.tcp://somewhere-far-away.in.an.other.__galaxy__.com:4242";

        // let's call connect.
        // because the endpointUrl doesn't exist,  and the the infinite_connectivity_strategy
        // the client with indefinitely try to connect, causing the callback function
        // passed to the client#connect method not to be called.
        let connect_done = false;
        let connect_err = null;
        (async () => {
            client.connect(endpointUrl, function (err) {
                connect_err = err;
                //xx console.log("client.connect(err) err = ",err);
                connect_done = true;
            });
        })();

        async function waitBackoff() {
            await new Promise<void>((resolve) => {
                client.once("backoff", function (/*number,delay*/) {
                    resolve();
                });
            });
        }
        let count_ref = 0;
        // Wait until backoff is raised several times
        await waitBackoff();
        await waitBackoff();
        await waitBackoff();

        backoff_event_counter.should.be.greaterThan(2);
        // client should be still trying to connect
        connect_done.should.eql(false);

        //  When client#disconnect is called
        client_has_received_close_event.should.eql(0);

        await client.disconnect();
        client_has_received_close_event.should.eql(client_has_received_connected_event);
        client_has_received_connected_event.should.eql(0);

        // connect callback should have been called...
        connect_done.should.eql(true);

        count_ref = backoff_event_counter;

        await f(wait_a_little_while);
        client_has_received_close_event.should.eql(0);
        // backoff must be terminated now
        count_ref.should.eql(backoff_event_counter);
    });

    it("TR20 -  disconnecting during reconnect", async () => {
        // Given a client that has a infinite connection retry strategy,
        //   And the client has a lived connection with a server
        //   And that the connection has dropped ( backoff strategy taking place)
        //
        //  When client#disconnect is called
        //
        //   Then the client should stop the  automatic reconnection strategy (backoff)

        //xx  ccc client_has_received_close_event

        await f(start_demo_server);

        await f(create_client_and_create_a_connection_to_server.bind(null, {}, infinite_connectivity_strategy));
        await f(wait_a_little_while);
        await f(shutdown_server);
        await f(reset_backoff_counter);
        await f(wait_for.bind(null, 2000));
        await f(verify_that_client_is_trying_to_reconnect);
        await f(verify_that_client_has_NOT_received_a_close_event);
        await f(verify_that_client_has_received_a_single_start_reconnection_event);
        await f(assert_has_received_some_backoff_event_since_last_reset);

        await f(wait_for.bind(null, 2000));
        await f(disconnect_client);

        await f(reset_backoff_counter);
        await f(wait_for.bind(null, 5000));

        await f(assert_NO_backoff_event_since_last_reset);
        await f(verify_that_client_is_NOT_trying_to_reconnect);
    });

    it("TR21 -  a client should notify that the reconnection attempt is taking place with an event", async () => {
        // Given a client and a server with an established connection
        // When the connection link dropped
        // Then the client shall raise an event to indicate that the reconnection process is now taking place.

        await f(start_demo_server);

        await f(create_client_and_create_a_connection_to_server.bind(null, {}, infinite_connectivity_strategy));
        await f(wait_a_little_while);
        await f(shutdown_server);
        await f(wait_a_little_while);
        await f(verify_that_client_has_received_a_single_start_reconnection_event);

        await f(reset_backoff_counter);
        await f(wait_for.bind(null, 2000));
        await f(assert_has_received_some_backoff_event_since_last_reset);

        await f(reset_backoff_counter);
        await f(wait_for.bind(null, 2000));
        await f(assert_has_received_some_backoff_event_since_last_reset);

        await f(disconnect_client);
    });

    async function test_1(options: any): Promise<void> {
        await f(start_demo_server);
        await f(reset_continuous);
        // use robust connectionStrategy
        await f(create_client_and_create_a_connection_to_server.bind(null, options, custom_connectivity_strategy));
        await f(client_create_and_activate_session);
        await f(create_subscription);
        await f(monitor_monotonous_counter);
        await f(wait_a_little_while);
        await f(wait_until_next_notification);
        await f(ensure_continuous);
        await f(wait_a_little_while);
        await f(wait_until_next_notification);
        await f(ensure_continuous);
        await f(wait_a_little_while);
        await f(wait_until_next_notification);
        await f(ensure_continuous);
        await f(wait_a_little_while);
        await f(wait_until_next_notification);
        await f(ensure_continuous);
        await f(wait_a_little_while);

        // now drop connection  for 1.5 seconds
        await f(simulate_connection_break.bind(null, 5000, "EPIPE"));
        // make sure that we have received all notifications
        // (thanks to republish )

        await f(wait_a_little_while);
        await f(wait_a_little_while);
        await f(wait_until_next_notification);
        await f(ensure_continuous);
        await f(wait_a_little_while);
        await f(wait_until_next_notification);
        await f(ensure_continuous);

        await f(terminate_subscription);

        await f(disconnect_client);
        await f(shutdown_server);
    }

    it("TR22 -  a client with active monitoring should be able to reconnect after a EPIPE connection break cause local socket end has been shut down - no security ", async () => {
        await test_1({ securityMode: MessageSecurityMode.None, securityPolicy: SecurityPolicy.None });
    });
    it("TR23 -  a client with active monitoring should be able to reconnect after a EPIPE connection break cause local socket end has been shut down - with secure channel (#390)", async () => {
        await test_1({
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256
        });
    });

    it("TR24 -  a client with active monitored item should be able to reconnect and transfer subscriptions when session timeout", async () => {
        const requestedSessionTimeout = 5000;

        await f(start_demo_server);
        await f(reset_continuous);
        // use robust connectionStrategy
        await f(
            create_client_and_create_a_connection_to_server.bind(
                null,
                {
                    requestedSessionTimeout: requestedSessionTimeout
                },
                custom_connectivity_strategy
            )
        );
        await f(client_create_and_activate_session);
        await f(create_subscription);
        await f(monitor_monotonous_counter);
        await f(wait_until_next_notification);
        await f(ensure_continuous);
        await f(wait_until_next_notification);
        await f(ensure_continuous);
        await f(wait_until_next_notification);
        await f(ensure_continuous);
        await f(wait_until_next_notification);
        await f(ensure_continuous);
        // now drop connection  for 1.5 times requestedSessionTimeout seconds
        await f(simulate_connection_break.bind(null, 1.5 * requestedSessionTimeout, "EPIPE"));
        // make sure that we have received all notifications
        // (thanks to republish )

        await f(wait_until_next_notification);
        await f(ensure_continuous);
        await f(wait_until_next_notification);
        await f(ensure_continuous);
        await f(terminate_subscription);
        await f(disconnect_client);
        await f(shutdown_server);

        if (server) {
            server.engine.currentSessionCount.should.eql(0);
        }
    });

    it("TR25 - a connected client shall be able to detect when a server has shut down and shall reconnect when server restarts", async () => {
        await f(start_demo_server);
        await f(reset_continuous);
        await f(create_client_and_create_a_connection_to_server.bind(null, {}, robust_connectivity_strategy));
        await f(wait_for.bind(null, 2000));
        await f(shutdown_server);
        await f(verify_that_client_is_trying_to_reconnect);
        await f(start_demo_server);
        await f(wait_for_reconnection_to_be_completed);
        await f(wait_a_little_while);
        await f(disconnect_client);
        await f(shutdown_server);
    });
});
