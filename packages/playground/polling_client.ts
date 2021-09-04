// compile with  tsc --lib es2018 client_with_custom_datatype.ts
// tslint:disable:no-console
import * as chalk from "chalk";
import * as os from "os";

import {
    AttributeIds,
    BrowseResult,
    ConnectionStrategyOptions,
    MessageSecurityMode,
    OPCUAClient,
    OPCUAClientOptions,
    SecurityPolicy,
    UserTokenType
} from "node-opcua-client";

// this test requires UA C++ Demo Server
const addNodeMethodNodeId = "ns=2;s=Demo.Massfolder_Static.AddNodes";
const endpointUri = "opc.tcp://" + os.hostname() + ":48010";

const doDebug = true;

async function main() {
    const connectionStrategy: ConnectionStrategyOptions = {
        initialDelay: 1000,
        maxDelay: 20000, // retry every 20 seconds
        maxRetry: 2 // maxRetry: 0xFFFFF // we need a large number here
    };

    const options: OPCUAClientOptions = {
        applicationName: "ClientBrowseNextDemo",
        connectionStrategy,
        endpointMustExist: false,
        keepSessionAlive: false,
        requestedSessionTimeout: 60000, // 1 minute
        securityMode: MessageSecurityMode.None,
        securityPolicy: SecurityPolicy.None
    };

    const client = OPCUAClient.create(options);

    client.on("backoff", (retry: number, delay: number) => {
        console.log("Backoff ", retry, " next attempt in ", delay, "ms");
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

    await client.connect(endpointUri);

    const session = await client.createSession();

    // Note: this example demonstrate how polling can be used in OPCUA ,
    // Note that Pooling is **not** the recommended way to monitored
    // change of a UA Variable! Use Subscription instead ....
    const timerId = setInterval(async () => {
        if (client.isReconnecting) {
            console.log(" suspending OPCUA read while connection is lost");
            return;
        }
        try {
            const dataValue = await session.read({
                attributeId: AttributeIds.Value,

                nodeId: "i=2258"
            });
            console.log(dataValue.statusCode.toString(), dataValue.value.toString());
            console.log(" now un-plug and re-plug the network cable to test node-opcua automatic reconnection");
        } catch (err) {
            if (err instanceof Error) {
                console.log(" Error while reading value", err.message);
            }
        }
    }, 2000);

    setTimeout(async () => {
        clearInterval(timerId);

        await session.close();
        await client.disconnect();
        console.log("Done !");
    }, 10 * 60 * 1000);
}

main();
