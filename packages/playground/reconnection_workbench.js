/* Copyright Sterfive 2021 */
/**
 * licence: Copyright Sterfive 2021
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
process.env.NODEOPCUADEBUG = "CLIENT{TRACE}SERVER{TRACE}";
const readline = require("readline");
const chalk = require("chalk");
const { timestamp } = require("node-opcua");

const { OPCUAServer, OPCUAClient, AttributeIds, TimestampsToReturn, ClientTCP_transport } = require("node-opcua");
const { cli } = require("winston/lib/winston/config");

async function startServer() {
    const server = new OPCUAServer({
        maxAllowedSessionNumber: 1,
        defaultSecureTokenLifetime: 20000
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
            console.log("     subscription.maxNotificationsPerPublish ", subscription.maxNotificationsPerPublish);
            console.log("     subscription.priority                   ", subscription.priority);
            console.log("     subscription.publishingEnabled          ", subscription.publishingEnabled);
        });
        session.on("subscription_terminated", (subscription) => {
            console.log("  subscription_terminated");
            console.log("     session.nodeId                          ", session.nodeId.toString(), session.channelId);
            console.log("     subscription.subscriptionId             ", subscription.subscriptionId);
            console.log("     subscription.publishingInterval         ", subscription.publishingInterval);
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

    server.start();

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
let ramdonCrashTimer = null;
function stopRandomCrash() {
    if (ramdonCrashTimer) {
        clearTimeout(ramdonCrashTimer);
        ramdonCrashTimer = null;
    }
}
function toggleRandomCrash(client) {
    function crash(minimumDelay) {
        console.log(t(), "   Connection crash ....");
        ramdonCrashTimer = setTimeout(() => {
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
            ramdonCrashTimer = null;
            simulateConnectionBreak(client, "ECONNRESET", breakDuration);
            crash(breakDuration);
        }, minimumDelay + Math.ceil(Math.random() * 10000));
    }
    if (!ramdonCrashTimer) {
        crash();
    } else {
        stopRandomCrash();
    }
}

const t = () => chalk.green(timestamp()) + " $";

async function createClient() {
    let client = OPCUAClient.create({
        defaultSecureTokenLifetime: 15 * 1000, // 15 seconds
        endpointMustExist: false
    });
    client.on("backoff", (retry, delay) => {
        console.log(t(), "backoff", retry, delay);
    });
    client.on("connected", () => console.log("connected"));
    client.on("after_reconnection", () => {
        console.log(t(), "after_reconnection");
    });
    client.on("connection_failed", () => {
        console.log(t(), "connection_failed");
    });
    client.on("connection_lost", (errMessage) => {
        console.log(t(), "connection_lost", errMessage);
    });
    client.on("connection_reestablished", () => {
        console.log(t(), "connection_reestablished");
    });
    client.on("reconnection_attempt_has_failed", () => {
        console.log(t(), "reconnection_attempt_has_failed");
    });

    await client.connect("opc.tcp://localhost:26543");

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
        l      : simulate a long network break      10 seconds
        w      : simulate a very long network break 3 minutes
        r      : toggle random crash ( 1 or more crash per second )
    
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
            console.log(" Simulating  a very long break");
            simulateConnectionBreak(client, "ECONNRESET", 180 * 1000);
        } else if (key.name === "l") {
            console.log(" Simulating long break");
            simulateConnectionBreak(client, "ECONNRESET", 10 * 10000);
        } else {
            console.log(`You pressed the "${str}" key`);
            console.log();
            console.log(key);
            console.log();
            rl.prompt();
        }
    });
    console.log("Press any key...");

    let session = client.createSession2 ? await client.createSession2() : await client.createSession();
    session.on("keepalive", (lastKnownServerState) => {
        console.log(t(), "keepalive", lastKnownServerState);
    });
    session.on("session_closed", () => {
        console.log(t(), "session closed");
    });
    session.on("session_restored", () => {
        console.log(t(), "session restored");
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

    const nodeId = "ns=0;i=2258";
    const monitoredItem = await subscription.monitor(
        {
            attributeId: AttributeIds.Value,
            nodeId
        },
        {
            samplingInterval: 1000,
            discardOldest: true,
            queueSize: 1000
        },
        TimestampsToReturn.Both
    );

    monitoredItem.on("changed", (dataValue) => {
        const str = dataValue.value.value.toString();
        const top = "+" + "".padEnd(str.length + 6, "-") + "+";
        console.log(t(), top);
        console.log("              ", "|   ", chalk.green(str) + "  |");
        console.log("              ", top);
    });

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
    const server = await startServer();

    process.once("SIGINT", async () => {
        console.log("Shutting down server");
        await server.shutdown();
    });
}
async function mainClient() {
    try {
        const client = await createClient();

        //   await client.disconnect();

        await new Promise((resolve) => setTimeout(resolve, 100));

        if (doRandomCrash) {
            toggleRandomCrash(client);
        }
    } catch (err) {
        console.log(err);
        process.exit(1);
    }
}

if (doServer) {
    mainServer();
} else {
    mainClient();
}
