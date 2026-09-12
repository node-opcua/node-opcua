const { OPCUAClient, UserTokenType, AttributeIds, StatusCodes, ClientSecureChannelLayer } = require("node-opcua");
const chalk = require("chalk");

//const endpointUrl="opc.tcp://e10284073381:26543";
const endpointUrl = "opc.tcp://opcuademo.sterfive.com:26543";
const userName = "";
const password = "";

function publishTopic(topic, dataValue) {
    console.log("publishTopic", topic, dataValue);
}

const userIdentity =
    userName && password
        ? {
              userName,
              password,
              type: UserTokenType.UserName
          }
        : {
              type: UserTokenType.Anonymous
          };

const currentTimeNode = {
    attributeId: AttributeIds.Value,
    nodeId: "ns=0;i=2258"
};

/**
 * @type {import("node-opcua").ClientSession} session
 */
async function keepAliveRead(session) {
    if (session && !session.isReconnecting) {
        try {
            const dataValue = await session.read(currentTimeNode);
            if (dataValue && dataValue.statusCode === StatusCodes.Good) {
                console.debug(chalk.green("OPC UA keepalive/watchdog, server currentTime: ") + chalk.cyan(dataValue.value.value));
                const keepAliveTime = dataValue.value.value.toISOString();
                publishTopic("WATCHDOG", keepAliveTime);
                console.debug(
                    chalk.green("Writer published, topic: ") +
                        chalk.cyan("WATCHDOG") +
                        chalk.green(" value: ") +
                        chalk.cyan(keepAliveTime)
                );
            } else {
                console.error(chalk.red("OPC UA keepalive/watchdog error!"));
                console.error(
                    chalk.red("OPC UA Failed to read currentTime, statuscode: ") +
                        chalk.cyan(dataValue.statusCode) +
                        " " +
                        chalk.cyan(dataValue.statusCode.description)
                );
            }
        } catch (err) {
            console.error(chalk.red("EXCEPTION caught err.message=", err.message));
        }
    }
    setTimeout(keepAliveRead, 500, session); // 30s interval
}

(async () => {
    ClientSecureChannelLayer.defaultTransportTimeout = 10000;
    const client = OPCUAClient.create({
        requestedSessionTimeout: 10000,
        //   defaultSecureTokenLifetime: 1000,
        timeout: 10000,
        keepSessionAlive: true
    });

    client.on("connected", () => console.log("client connected"));
    client.on("connection_failed", () => console.log("client connection failed"));
    client.on("backoff", (count, delay) => console.log("client backoff"));
    client.on("start_reconnection", () => console.log("start reconnection"));
    client.on("reconnection_attempt_has_failed", (err, message) =>
        console.log("reconnection_attempt_has_failed", err.message, message)
    );
    client.on("after_reconnection", (err) => console.log("after_reconnection"));
    client.on("abort", () => console.log("client: abort"));
    client.on("close", () => console.log("client: close"));
    client.on("send_chunk", () => {});
    client.on("receive_chunk", () => {});
    client.on("send_request", (request) => {
        console.log("> ", request.constructor.name);
    });
    client.on("receive_response", (response) => {
        console.log("< ", response.constructor.name);
    });
    client.on("lifetime_75", () => console.log("client: lifetime_75"));
    client.on("security_token_renewed", () => console.log("client: security_token_renewed"));
    client.on("connection_lost", () => console.log("client: connection_lost"));
    client.on("connection_reestablished", () => console.log("client: connection_reestablished"));
    client.on("timed_out_request", (request) => console.log("client: timed_out_request", request.constructor.name));

    console.log(chalk.yellow("Connecting to endpoint: ") + chalk.cyan(endpointUrl));
    await client.connect(endpointUrl);
    console.log("default security token live time = ", client._secureChannel.defaultSecureTokenLifetime);

    console.debug(chalk.yellow("User identity: ") + chalk.cyan(JSON.stringify(userIdentity)));

    console.log(client._secureChannel.toString());

    try {
        // @type {import("node-opcua-client").ClientSession} session
        const session = await client.createSession(userIdentity);

        console.log("session info", session.toString());

        session.on("session_restored", () => console.log(session.sessionId.toString(), "session_restored"));
        session.on("session_closed", () => console.log(session.sessionId.toString(), "session_closed"));
        session.on("keepalive", () => console.log(session.sessionId.toString(), "session => keepalive"));
        session.on("keepalive_failure", () => console.log(session.sessionId.toString(), "session => keepalive failure"));

        console.log(session.sessionId.toString(), "session timeout = ", session.timeout);

        console.info(chalk.yellow("Session created, sessionId: ") + chalk.cyan(session.sessionId.toString()));
        //    keepAliveRead(session);
    } catch (err) {
        console.error(chalk.red("Cannot create session, error: " + err.message));
    }
})();
