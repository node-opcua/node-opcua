"use strict"
const {
    OPCUAClient,
    MessageSecurityMode,
    SecurityPolicy,
    ClientMonitoredItem,
    AttributeIds,
    TimestampsToReturn,
    resolveNodeId

} = require("node-opcua");


const chalk = require("chalk");

// const endpointUri = "opc.tcp://DESKTOP-S6DI4HV:49320";
// const endpointUri = "opc.tcp://opcuademo.sterfive.com:26544";
const endpointUri = "opc.tcp://localhost:48010";
(async () => {

    try {


        const client = OPCUAClient.create({
            applicationName: "ClientBrowseNextDemo",

            endpointMustExist: false,
            keepSessionAlive: true,
            requestedSessionTimeout: 60 * 1000,
            //            securityMode: MessageSecurityMode.SignAndEncrypt,
            //            securityPolicy: SecurityPolicy.Basic256,
            connectionStrategy: {
                maxRetry: -1,
                maxDelay: 500,
                initialDelay: 100,

            },

            defaultSecureTokenLifetime: 20000,
        });

        client.on("backoff", (retry, delay) => {
            console.log("Backoff ", retry, " next attempt in ", delay, "ms", endpointUri);
        });

        client.on("connection_lost", () => {
            console.log("Connection lost");
        });

        client.on("connection_reestablished", () => {
            console.log("Connection re-established");
        });

        client.on("connection_failed", () => {
            console.log("Connection failed");
        });
        client.on("start_reconnection", () => {
            console.log("Starting reconnection");
        });

        client.on("after_reconnection", (err) => {
            console.log("After Reconnection event =>", err);
        });
        client.on("security_token_renewed", () => {
            console.log("security_token_renewed =>");
            console.log(client.toString());
        })
        client.on("lifetime_75", (token) => {
            console.log("lifetime_75 =>", token.toString());
        })

        await client.connect(endpointUri);

        const session = await client.createSession();

        session.on("session_closed", (statusCode) => {
            console.log(" Session has been closed with statusCode = ", statusCode.toString());
        })
        session.on("session_restored", () => {
            console.log(" Session has been restored");
        });
        session.on("keepalive", (lastKnownServerState) => {
            console.log("KeepAlive lastKnownServerState", lastKnownServerState);
        });
        session.on("keepalive_failure", () => {
            console.log("KeepAlive failure");
        });

        console.log("session\n", session.toString());
        console.log("client\n", client.toString());

        const subscription = await session.createSubscription2({
            maxNotificationsPerPublish: 9000,
            publishingEnabled: true,
            requestedLifetimeCount: 10,
            requestedMaxKeepAliveCount: 10,
            requestedPublishingInterval: 1000
        });

        console.log(subscription.toString());

        subscription.on("raw_notification", (n) => {
            //console.log(n.toString());
        });

        const itemToMonitor = {
            attributeId: AttributeIds.Value,
            nodeId: resolveNodeId("ns=0;i=2258")
        };

        const parameters = {
            discardOldest: true,
            queueSize: 10,
            samplingInterval: 2000
        };

        const monitoredItem = ClientMonitoredItem.create(subscription, itemToMonitor, parameters, TimestampsToReturn.Both);

        // subscription.on("item_added",function(monitoredItem){
        monitoredItem.on("initialized", () => {
            console.log(" Initialized !");
        });

        monitoredItem.on("changed", (dataValue) => {
            console.log("Changed on ", dataValue.value.toString());
        });

        const nodeToRead = { nodeId: "i=2258", attributeId: AttributeIds.Value };

        const timer = setInterval(async () => {
            try {
                const dv = await session.read(nodeToRead);
                console.log("dv =", session.sessionId.toString(), session.timeout, dv.statusCode.toString());
            } catch (err) {
                console.log(chalk.red(" session.read error !!! "), err.message, "reconnection =", session.isReconnecting);
                console.log(session.toString());
            }
        }, 10000);


        process.on("SIGINT", async () => {
            console.log(chalk.bgWhite(
                "--------------------------------------------------- NOW STOPPING CLIENT"));

            clearInterval(timer);
            // await monitoredItem.terminate();
            await session.close();
            await client.disconnect();
            console.log("Done !");
            process.exit(1);
        });


    } catch (err) {
        console.log("err", err.message);
        console.log(err);
        console.log("-------------------------------------------- DONE!");
        process.exit(-1)
    }
})();