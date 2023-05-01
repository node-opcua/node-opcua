"use strict";

/// issues: #237 #288
const path = require("path");
const fs = require("fs");
const { hostname } = require("os");
const chalk = require("chalk");
const {
    get_mini_nodeset_filename,
    OPCUAServer,
    OPCUAClient,
    MessageSecurityMode,
    SecurityPolicy,
    coerceNodeId,
    AttributeIds,
    TimestampsToReturn,
    StatusCodes,
    DataType
} = require("node-opcua");

const port = 26540;

async function sleep(duration) {
    await new Promise((resolve) => setTimeout(resolve, duration));
}

const duration1 = 4000;
const duration2 = 30000;
const requestedSessionTimeout = 15000;
const defaultSecureTokenLifetime = 10000;

async function runServer() {
    let server;

    async function startServer() {
        const serverOptions = {
            port: port,
            serverCapabilities: {
                maxSessions: 2
            },
            maxConnectionsPerEndpoint: 2,
            nodeset_filename: [get_mini_nodeset_filename()],
            isAuditing: false
        };
        server = new OPCUAServer(serverOptions);
        try {
            await server.start();
        } catch (err) {
            console.log(chalk.red(" Server failed to start ... exiting"));
            console.log(err);
            process.exit(-3);
        }
        console.log(chalk.yellow("  server on port      :"), server.endpoints[0].port.toString());
    }
    async function stopServer() {
        console.log(chalk.red("---------------------------------- SHUTING DOWN SERVER"));
        await server.shutdownChannels();
        const chnls = server.getChannels();
        chnls.forEach((channel) => {
            if (channel.transport && channel.transport._socket) {
                channel.transport._socket.close();
                channel.transport._socket.destroy();
                channel.transport._socket.emit("error", new Error("EPIPE"));
            }
        });
    }

    await startServer();
    await sleep(duration2);
    await stopServer();
    await sleep(duration1);
    await startServer();
    await sleep(duration1);
    await stopServer();

    await sleep(duration2);
    await startServer();
    await sleep(duration1);
    await stopServer();

    await startServer();
    await sleep(duration2);
    await stopServer();
}

function getTick() {
    return Date.now();
}
const certificateFolder = path.join(__dirname, "../packages/node-opcua-samples/certificates");
const certificateFile = path.join(certificateFolder, "client_selfsigned_cert_2048.pem");
const privateKeyFile = path.join(certificateFolder, "client_key_2048.pem");

const doDebug = true;

async function runClient() {
    const client = OPCUAClient.create({
        endpointMustExist: false,
        keepSessionAlive: true,
        requestedSessionTimeout,
        defaultSecureTokenLifetime,
        certificateFile,
        privateKeyFile,

        securityMode: MessageSecurityMode.SignAndEncrypt,
        securityPolicy: SecurityPolicy.Basic256,

        connectionStrategy: {
            maxRetry: 10000000,
            initialDelay: 1000,
            maxDelay: 2000
        },
        clientName: "ThisIsClient"
    });

    client.on("lifetime_75", () => {
        console.log(chalk.bgWhite.red(" >>>> ned to renew token"));
    });

    const endpointUrl = `opc.tcp://${hostname()}:${port}`;
    const nodeId = coerceNodeId("ns=3;s=Int32");

    client.on("connection_reestablished", function () {
        console.log(chalk.bgWhite.red(" !!!!!!!!!!!!!!!!!!!!!!!!  CONNECTION RE-ESTABLISHED !!!!!!!!!!!!!!!!!!!"));
    });
    client.on("backoff", function (number, delay) {
        console.log(chalk.bgWhite.yellow("backoff  attempt #"), number, " retrying in ", delay / 1000.0, " seconds");
    });

    await client.connect(endpointUrl);
    console.log("connected !");

    const session = await client.createSession();
    console.log("session timeout = ", session.timeout);

    session.on("session_closed", function (statusCode) {
        console.log(chalk.yellow("Session has closed : statusCode = "), statusCode ? statusCode.toString() : "????");
    });

    session.on("keepalive_failure", () => {
        console.log(chalk.bgRedBright.whiteBright("keep alive failure"));
    });
    session.on("keepalive", (reason, count) => {
        console.log(chalk.bgGreenBright.whiteBright("keep alive: ", reason, count));
    });
    const parameters = {
        requestedPublishingInterval: 100,
        requestedLifetimeCount: 1000,
        requestedMaxKeepAliveCount: 12,
        maxNotificationsPerPublish: 10,
        publishingEnabled: true,
        priority: 10
    };

    if (0) {
        const subscription = await session.createSubscription2(parameters);
        session.on("keepalive", function (state) {
            console.log(
                chalk.yellow("KeepAlive state="),
                state.toString(),
                " pending request on server = ",
                subscription.publishEngine.nbPendingPublishRequests
            );
        });

        const t = getTick();

        console.log("started subscription :", subscription.subscriptionId);

        console.log(" revised parameters ");
        console.log(
            "  revised maxKeepAliveCount  ",
            subscription.maxKeepAliveCount,
            " ( requested ",
            parameters.requestedMaxKeepAliveCount + ")"
        );
        console.log(
            "  revised lifetimeCount      ",
            subscription.lifetimeCount,
            " ( requested ",
            parameters.requestedLifetimeCount + ")"
        );
        console.log(
            "  revised publishingInterval ",
            subscription.publishingInterval,
            " ( requested ",
            parameters.requestedPublishingInterval + ")"
        );
        console.log("  suggested timeout hint     ", subscription.publishEngine.timeoutHint);

        subscription
            .on("keepalive", function () {
                const t1 = getTick();
                console.log(
                    chalk.cyan("keepalive "),
                    chalk.cyan(" pending request on server = "),
                    subscription.publishEngine.nbPendingPublishRequests
                );
            })
            .on("terminated", function (err) {
                /** */
            });

        const result = [];
        const requestedParameters = {
            samplingInterval: 250,
            queueSize: 1,
            discardOldest: true
        };
        const item = { nodeId: nodeId, attributeId: AttributeIds.Value };

        const monitoredItem = await subscription.monitor(item, requestedParameters, TimestampsToReturn.Both);
        monitoredItem.on("changed", function (dataValue) {
            doDebug &&
                console.log(
                    chalk.cyan(" ||||||||||| VALUE CHANGED !!!!"),
                    dataValue.statusCode.toString(),
                    dataValue.value.toString()
                );
            result.push(dataValue);
        });
    }
    let counter = 0;
    const intervalId = setInterval(() => {
        console.log(
            " Session channel is valid  ? = ",
            session.isChannelValid(),
            " reconnecting ? = ",
            session.isReconnecting,

            "session will expired in ",
            session.evaluateRemainingLifetime() / 1000,
            " seconds",

            chalk.red("subscription count?"),
            session.subscriptionCount
        );

        if (!session.isChannelValid() && false) {
            //xx console.log(the_session.toString());
            return; // ignore write as session is invalid for the time being
        }

        if (0) {
            let nodeToWrite = {
                nodeId: nodeId,
                attributeId: AttributeIds.Value,
                value: /* DataValue */ {
                    statusCode: StatusCodes.Good,
                    sourceTimestamp: new Date(),
                    value: /* Variant */ {
                        dataType: DataType.Int32,
                        value: counter
                    }
                }
            };
            session.write([nodeToWrite], function (err, statusCode) {
                if (err) {
                    console.log("write has failed with err", err.message);
                } else {
                    counter += 1;
                    console.log("writing ", counter);
                }
                //xx statusCode && statusCode.length===1) ? statusCode[0].toString():"");
            });
        }
    }, 1000);

    await sleep(200000);
    clearInterval(intervalId);
    await session.close();
    await client.disconnect();
}

runServer();
runClient();
