// compile with  tsc --lib es2018 client_with_custom_datatype.ts
// tslint:disable:no-console
import chalk from "chalk";

import {
    AttributeIds,
    BrowseResult, ClientMonitoredItemBase,
    ClientMonitoredItemGroup,
    ConnectionStrategyOptions,
    DataValue,
    MessageSecurityMode,
    OPCUAClient,
    OPCUAClientOptions,
    resolveNodeId,
    SecurityPolicy,
    TimestampsToReturn,
    UserTokenType
} from "node-opcua-client";

const endpointUri = "opc.tcp://localhost:48010";

(async () => {

    try {

        const connectionStrategy: ConnectionStrategyOptions = {
            initialDelay: 1000,
            maxDelay: 20000, // retry every 20 seconds
            maxRetry: 2 // maxRetry: 0xFFFFF // we need a large number here
        };

        const options: OPCUAClientOptions = {
            applicationName: "ClientBrowseNextDemo",
            connectionStrategy,
            endpoint_must_exist: false,
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

        const subscription = await session.createSubscription2({
            maxNotificationsPerPublish: 1000,
            publishingEnabled: true,
            requestedLifetimeCount: 100,
            requestedMaxKeepAliveCount: 10,
            requestedPublishingInterval: 1000
        });

        subscription.on("raw_notification", (n: any) => {
            console.log(n.toString());
        });

        const itemsToMonitor = [
            {
                attributeId: AttributeIds.Value,
                nodeId: resolveNodeId("ns=3;s=AirConditioner_1.Temperature")
            },

            {
                attributeId: AttributeIds.Value,
                nodeId: resolveNodeId("ns=3;s=AirConditioner_2.Temperature")
            },
            {
                attributeId: AttributeIds.Value,
                nodeId: resolveNodeId("ns=3;s=AirConditioner_3.Temperature")
            },
            {
                attributeId: AttributeIds.Value,
                nodeId: resolveNodeId("ns=3;s=AirConditioner_4.Temperature")
            }
        ];

        const optionsGroup = {
            discardOldest: true,
            queueSize: 1,
            samplingInterval: 10
        };

        const monitoredItemGroup = ClientMonitoredItemGroup.create(subscription, itemsToMonitor, optionsGroup, TimestampsToReturn.Both);

        // subscription.on("item_added",function(monitoredItem){
        monitoredItemGroup.on("initialized", async () => {
            console.log(" Initialized !");
        });

        monitoredItemGroup.on("changed",  (monitoredItem: ClientMonitoredItemBase, dataValue: DataValue, index: number) => {
            console.log("Changed on ", index ,  dataValue.value.toString());
        });

        await new Promise((resolve) => setTimeout(resolve, 1000000));

        await monitoredItemGroup.terminate();

        await session.close();
        await client.disconnect();
        console.log(chalk.green("Done !"));

    } catch (err) {
        console.log(chalk.red("Error"), err);
    }
})();
