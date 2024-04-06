/* Copyright Sterfive 2021-2024 */
process.env.DEBUG = "RECONNECTION";
process.env.NODEOPCUADEBUG = "CLIENT{TRACE}SERVER{TRACE}";

/**
 * licence: Copyright Sterfive 2021-2024
 *
 *
 * Workbench for testing reconnection
 *
 * how to use:
 *
 *  open 2 terminals
 *
 *  in the first terminal run:
 *
 *     node reconnectionWorkbench.js  server
 *
 *  in the second terminal run:
 *
 *     node reconnectionWorkbench.js  client
 *
 * follow the instruction on the client terminal to simulate network error in various way
 *
 *     help:
    -----

    CTRL+C : gracefully shutdown the client
    CTRL+Z : abruptly shutdown the client
    b      : simulate a network break
    l      : simulate a long network break      10 seconds
    w      : simulate a very long network break 3 minutes
    r      : toggle random crash
 */
const os = require("os");
const path = require("path");
const readline = require("readline");
const chalk = require("chalk");
const { timestamp, setNextSubscriptionId, OPCUACertificateManager, MessageSecurityMode, SecurityPolicy } = require("node-opcua");

const { OPCUAServer, OPCUAClient, AttributeIds, TimestampsToReturn, ClientTCP_transport } = require("node-opcua");

const port = 26551;

async function startServer() {
    setNextSubscriptionId(1);

    const rootFolder = path.join(os.tmpdir(), "node-opcua-server");

    const serverCertificateManager = new OPCUACertificateManager({
        automaticallyAcceptUnknownCertificate: true,
        rootFolder,
        keySize: 2048
    });
    await serverCertificateManager.initialize();

    const server = new OPCUAServer({
        port,
        defaultSecureTokenLifetime: 20000,
        serverCapabilities: {
            maxSessions: 2
        },
        serverCertificateManager
        // use default timeout: 100000,
    });

    server.on("newChannel", function (channel) {
        console.log(" new channel !!!", channel.remoteAddress, channel.remotePort, channel.channelId);

        channel.on("abort", () => {
            console.log("channel aborted");
        });
    });
    server.on("closeChannel", function (channel) {
        console.log(" close channel !!!", channel.remoteAddress, channel.bytesRead, channel.bytesWritten);
    });

    server.on("connectionRefused", function () {
        console.log(" connection refused !!!", arguments);
    });

    server.on("create_session", function (session) {
        console.log(" create_session !!!", session.name, session.sessionTimeout, session.nodeId.toString(), session.channelId);
        session.on("channel_aborted", () => {
            console.log(
                " channel_aborted !!! on session",
                session.name,
                session.sessionTimeout,
                session.nodeId.toString(),
                session.channelId
            );
        });
        session.on("timeout", () => {
            console.log(
                "  session has timed out",
                session.name,
                session.sessionTimeout,
                session.nodeId.toString(),
                session.channelId
            );
        });
        session.on("new_subscription", (subscription) => {
            console.log("  new_subscription");
            console.log("     session.nodeId                          ", session.nodeId.toString(), session.channelId);
            console.log("     subscription.subscriptionId             ", subscription.subscriptionId);
            console.log("     subscription.publishingInterval         ", subscription.publishingInterval);
            console.log("     subscription.maxLifetimeCount           ", subscription.maxLifetimeCount);
            console.log("     subscription.maxNotificationsPerPublish ", subscription.maxNotificationsPerPublish);
            console.log("     subscription.priority                   ", subscription.priority);
            console.log("     subscription.publishingEnabled          ", subscription.publishingEnabled);
        });
        session.on("subscription_terminated", (subscription) => {
            console.log("  subscription_terminated");
            console.log("     session.nodeId                          ", session.nodeId.toString(), session.channelId);
            console.log("     subscription.subscriptionId             ", subscription.subscriptionId);
            console.log("     subscription.publishingInterval         ", subscription.publishingInterval);
            console.log("     subscription.maxLifetimeCount           ", subscription.maxLifetimeCount);
            console.log("     subscription.maxNotificationsPerPublish ", subscription.maxNotificationsPerPublish);
            console.log("     subscription.priority                   ", subscription.priority);
            console.log("     subscription.publishingEnabled          ", subscription.publishingEnabled);
        });
    });

    server.on("openSecureChannelFailure", function () {
        console.log(" openSecureChannelFailure !!!", arguments);
    });
    server.on("close_session", function () {
        console.log(" close_session !!!", arguments);
    });
    server.on("session_activated", (session) => {
        console.log(" session_activated !!!", session.name, session.sessionTimeout, session.nodeId.toString(), session.channelId);
    });
    server.on("session_closed", (session, deleteSubscription, reason) => {
        console.log(" session_closed !!!");
        console.log("     sessionName", session.name);
        console.log("     timeout    ", session.sessionTimeout);
        console.log("     nodeId     ", session.nodeId?.toString());
        console.log("     channelId  ", session.channelId);
        console.log("     deleteSubscription ", deleteSubscription);
        console.log("     reason     ", reason);
    });

    await server.initialize();
    console.log(server.serverCertificateManager.rootDir);

    if (!server.engine) {
        console.log("server.engine is null");
        return;
    }
    // add a variable with a changing value
    const addressSpace = server.engine.addressSpace;
    const namespace = addressSpace.getOwnNamespace();
    const uaVariable = namespace.addVariable({
        browseName: "Temperature",
        nodeId: "s=Temperature",
        dataType: "Double",
        componentOf: addressSpace.rootFolder.server
    });

    let counter = 0;
    let timerId = setInterval(() => {
        uaVariable.setValueFromSource({ dataType: "Double", value: counter++ });
    }, 500);

    function addBatchVariables(n) {
        for (let i = 0; i < n; i++) {
            namespace.addVariable({
                browseName: `Value${i}`,
                nodeId: `s=Value${i}`,
                dataType: "Double",
                componentOf: addressSpace.rootFolder.server,
                value: {
                    dataType: "Double",
                    value: i
                }
            });
        }
    }
    addBatchVariables(1000);

    addressSpace.registerShutdownTask(() => {
        clearInterval(timerId);
    });
    await server.start();
    console.log("server starting ", server.getEndpointUrl());
    return server;
}

function installDelayedConnection(delay) {
    const oldConnect = ClientTCP_transport.prototype.connect;
    ClientTCP_transport.prototype.connect = function (endpointUrl, callback) {
        console.log(t(), " Simulating long break :", (delay / 1000).toFixed(3), " seconds ....");
        const tick = Date.now();
        const pingInterval = setInterval(() => {
            console.log(
                t(),
                "... network still down ... waiting ",
                Math.ceil((tick - Date.now() + delay) / 1000),
                " seconds to go"
            );
        }, 5000);
        setTimeout(() => {
            clearInterval(pingInterval);

            console.log(t(), " Simulating long break... Done");
            ClientTCP_transport.prototype.connect = oldConnect;
            this.connect(endpointUrl, callback);
        }, delay);
    };
}

function simulateConnectionBreak(client, socketError, breakDuration) {
    if (!client) return;

    console.log(
        t(),
        " ------------------------- Network connection break => duration ",
        (breakDuration / 1000).toFixed(3),
        " seconds"
    );
    if (breakDuration > 0) {
        installDelayedConnection(breakDuration);
    }

    const channel = client._secureChannel;
    if (!channel) {
        return;
    }
    const transport = channel._transport;
    if (!transport) {
        return;
    }
    const clientSocket = transport._socket;
    clientSocket.end();
    clientSocket.destroy();
    clientSocket.emit("error", new Error(socketError));
}
let randomCrashTimer = null;
function stopRandomCrash() {
    if (randomCrashTimer) {
        clearTimeout(randomCrashTimer);
        randomCrashTimer = null;
    }
}
function toggleRandomCrash(client) {
    function crash(minimumDelay) {
        console.log(t(), "   Connection crash ....");
        randomCrashTimer = setTimeout(
            () => {
                const crashType = Math.floor(Math.random() * 100);
                let breakDuration = 0;
                if (crashType >= 0 && crashType < 80) {
                    // outage from [0, 10] seconds
                    breakDuration = Math.random() * 10000;
                } else if (crashType >= 80 && crashType < 99) {
                    // outage from [10, 180] seconds
                    breakDuration = 10 * 1000 + Math.random() * 170 * 1000;
                } else if (crashType >= 20 && crashType < 30) {
                    breakDuration = 18000 + Math.random() * 180 * 1000;
                    breakDuration = Math.random() * 1000;
                }
                console.log(" crashType = ", crashType, breakDuration);
                randomCrashTimer = null;
                simulateConnectionBreak(client, "ECONNRESET", breakDuration);
                crash(breakDuration);
            },
            minimumDelay + Math.ceil(Math.random() * 10000)
        );
    }
    if (!randomCrashTimer) {
        crash();
    } else {
        stopRandomCrash();
    }
}

const t = () => chalk.green(timestamp()) + " $";

async function createClient() {
    const endpointUrl = `opc.tcp://127.0.0.1:${port}`;

    let client = OPCUAClient.create({
        defaultSecureTokenLifetime: 45 * 1000, // 45 seconds
        endpointMustExist: false,
        connectionStrategy: {
            maxDelay: 5000,
            maxRetry: -1,
            initialDelay: 500,
            randomisationFactor: 0.1
        },
        securityMode: MessageSecurityMode.SignAndEncrypt,
        securityPolicy: SecurityPolicy.Basic256Sha256
    });
    client.on("backoff", (retry, delay) => {
        console.log(t(), "backoff", retry, delay, endpointUrl);
    });
    client.on("connected", () => console.log("client.on('connected')"));
    client.on("after_reconnection", () => {
        console.log(t(), "client.on('after_reconnection')");
    });
    client.on("connection_failed", () => {
        console.log(t(), "client.on('connection_failed')");
    });
    client.on("connection_lost", (errMessage) => {
        console.log(t(), "client.on('connection_lost')", errMessage, "isReconnecting", client.isReconnecting);
    });
    client.on("connection_reestablished", () => {
        console.log(t(), "client.on('connection_reestablished')", "isReconnecting", client.isReconnecting);
    });
    client.on("reconnection_attempt_has_failed", () => {
        console.log(t(), "client.on('reconnection_attempt_has_failed')", "isReconnecting", client.isReconnecting);
    });

    client.on("startingDelayBeforeReconnection", (duration) => {
        console.log(t(), "client.on('startingDelayBeforeReconnection')", duration);
    });
    client.on("repairConnectionStarted", () => {
        console.log(t(), "client.on('repairConnectionStarted')");
    });

    await client.connect(endpointUrl);

    console.log(client.toString());

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.prompt(true);

    rl.setPrompt(`

        help:
        -----

        CTRL+C : gracefully shutdown the client
        CTRL+Z : abruptly shutdown the client
        b      : simulate a network break
        l      : simulate a long network break      20 seconds
        m      : simulate a medium break            10 seconds
        w      : simulate a very long network break 3 minutes
        r      : toggle random crash ( 1 or more crash per second )
        z      : client abrupt shutdown (not closing session before stopping)
        c      ; client graceful shutdown
        i      : display active channel info
        press a key to continue:

    `);

    readline.emitKeypressEvents(process.stdin, rl);
    process.stdin.setRawMode(true);
    process.stdin.on("keypress", async (str, key) => {
        console.log(`You pressed the "${str}" key`);

        if (key.ctrl && key.name === "z") {
            stopRandomCrash();
            await disconnect();
            console.log(" Abrupt shutting down");
            process.exit(1);
        } else if (key.name === "i") {
            console.log("------------------------------------------- CHANNEL ");
            console.log(client._secureChannel.toString());
            console.log("------------------------------------------- SUBSCRIPTION ");
            console.log(subscription.toString());
            console.log("monitoredItem", monitoredItem.monitoredItemId);
            console.log("channelId             ", session.channelId());
            console.log("subscriptionId        ", subscription.subscriptionId);
            console.log("session timeout       ", session.timeout / 1000, "seconds");
            //  console.log(subscription);
            const duration = subscription.publishingInterval * subscription.lifetimeCount;
            console.log("subscription duration ", duration / 1000, "seconds");
        } else if (key.ctrl && key.name === "c") {
            console.log(" Gracefully shutting down");
            process.stdin.setRawMode(false);
            rl.close();
            stopRandomCrash();
            await disconnect();
        } else if (key.name === "r") {
            toggleRandomCrash(client);
        } else if (key.name === "b") {
            console.log(" Simulating break");
            simulateConnectionBreak(client, "ECONNRESET", 0);
        } else if (key.name === "w") {
            console.log(" Simulating  a very long break 3 minutes");
            simulateConnectionBreak(client, "ECONNRESET", 180 * 1000);
        } else if (key.name === "l") {
            console.log(" Simulating long break (30 second)");
            simulateConnectionBreak(client, "ECONNRESET", 30 * 1000);
        } else if (key.name === "m") {
            console.log(" Simulating long break (10 second)");
            simulateConnectionBreak(client, "ECONNRESET", 10 * 1000);
        } else if (key.name == "h") {
            rl.prompt();
        } else {
            console.log(`You pressed the "${str}" key ${JSON.stringify(key)}`);
        }
    });
    console.log("Press any key...");

    let timer;
    let session = client.createSession2 ? await client.createSession2() : await client.createSession();
    session.on("keepalive", (lastKnownServerState) => {
        console.log(t(), "session.on('keepalive')", lastKnownServerState);
    });
    session.on("session_closed", () => {
        console.log(t(), "session.on('session closed')");
    });
    session.on("session_repaired", () => {
        console.log(t(), "session.on('session repaired'), isReconnecting", session.isReconnecting);
    });
    session.on("session_restored", () => {
        console.log(t(), "session.on('session restored'), isReconnecting", session.isReconnecting);
        if (!timer) {
            timer = setTimeout(() => {
                console.log("   session. isReconnecting ? = ", session.isReconnecting);
            }, 100);
        }
    });

    const subscription = await session.createSubscription2({
        maxNotificationsPerPublish: 50,
        priority: 100,
        publishingEnabled: true,
        requestedLifetimeCount: 1000,
        requestedMaxKeepAliveCount: 10,
        requestedPublishingInterval: 5000
    });
    subscription.on("terminated", () => {
        console.log("subscription terminated");
    });

    const nodeId = "ns=1;s=Temperature";
    const monitoredItem = await subscription.monitor(
        {
            attributeId: AttributeIds.Value,
            nodeId
        },
        {
            samplingInterval: 250,
            discardOldest: true,
            queueSize: 1000
        },
        TimestampsToReturn.Both
    );

    monitoredItem.on("changed", (dataValue) => {
        const str = dataValue.value ? dataValue.value.value?.toString() : "null";
        const verboseNotification = false;
        if (verboseNotification) {
            const top = "+" + "".padEnd(str.length + 6, "-") + "+";
            console.log(t(), top);
            console.log("              ", "|   ", chalk.green(str) + "  |");
            console.log("              ", top);
        } else {
            console.log(t(), "Value = ", str + " " + dataValue.sourceTimestamp?.toISOString());
        }
    });

    async function createMonitoredItemGroup() {
        const itemsToMonitor1 = [];
        for (let i = 0; i < 1000; i++) {
            itemsToMonitor1.push({ nodeId: "ns=1;s=Value" + i, attributeId: AttributeIds.Value });
        }

        const itemsToMonitor = [...itemsToMonitor1, ...itemsToMonitor1, ...itemsToMonitor1, ...itemsToMonitor1];
        const parameters = {
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100
        };
        const group = await subscription.monitorItems(itemsToMonitor, parameters, TimestampsToReturn.Both);
        group.monitoredItems.forEach((monitoredItem) => {
            if (monitoredItem.statusCode.isNotGood()) {
                console.log(monitoredItem.itemToMonitor.nodeId.toString(), monitoredItem.statusCode.toString());
            }
        });
        group.on("changed", (monitoredItem, dataValue, index) => {
            console.log(t(), "GROUP ", monitoredItem.itemToMonitor.nodeId.toString(), index, dataValue.value.toString());
        });
    }

    await createMonitoredItemGroup();

    const disconnect = async () => {
        session && (await session.close());
        client && (await client.disconnect());
        session = null;
        client = null;
        // process.exit(1);
    };
    return {
        session,
        client,
        disconnect
    };
}

const doServer = process.argv[2] === "server";
const doRandomCrash = process.argv[2] === "randomCrash";

async function mainServer() {
    let server = await startServer();
    await new Promise((resolve) => process.once("SIGINT", resolve));
    console.log("Shutting down server");
    await server.shutdown();
    console.log("Server has been shut down");
}
async function mainClient() {
    try {
        const { client, session } = await createClient();

        //   await client.disconnect();

        await new Promise((resolve) => setTimeout(resolve, 100));

        if (doRandomCrash) {
            toggleRandomCrash(client);
        }
        return client;
    } catch (err) {
        console.log(err);
        process.exit(1);
    }
}
const rand = (min, max) => Math.random() * (max - min) + min;

const doServerPatterCrash = [
    //
    10000,
    1750,
    //
    1750,
    1100 + rand(0, 100),
    //
    10000,
    1100 + rand(0, 100),
    //
    1100,
    1100 + rand(0, 100),
    //
    1100,
    1350,
    //
    1000,
    10000,
    //
    10000,
    1000
];
async function cycleServer() {
    console.log("Cycle server  ");
    let server = null;
    for (let t of doServerPatterCrash) {
        if (!server) {
            console.log("starting server");
            server = await startServer();
        } else {
            console.log("shutting down server");
            await server.shutdown();
            server = null;
        }
        console.log("waiting ", t, "ms");
        await new Promise((resolve) => setTimeout(resolve, t));
    }
}

if (doServer) {
    if (doServerPatterCrash) {
        (async () => {
            do {
                await cycleServer();
            } while (true);
        })();
    } else {
        mainServer();
    }
} else {
    mainClient();
}
