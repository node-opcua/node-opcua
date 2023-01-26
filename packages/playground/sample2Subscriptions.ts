// tslint:disable:no-console
import * as chalk from "chalk";

import {
    AttributeIds,
    ClientMonitoredItem,
    ClientSession,
    ClientSubscription,
    ConnectionStrategyOptions,
    DataChangeFilter,
    DataChangeTrigger,
    DataValue,
    DeadbandType,
    EventFilter,
    MessageSecurityMode,
    MonitoringParametersOptions,
    OPCUAClient, 
    OPCUAClientOptions,
    ReadValueIdOptions,
    SecurityPolicy,
    TimestampsToReturn, 
    UserTokenType
} from "node-opcua-client";

async function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const connectionStrategy: ConnectionStrategyOptions = {
    initialDelay: 1000,
    maxRetry: 1
};
const options: OPCUAClientOptions = {
    applicationName: "HelloSample2",
    connectionStrategy,
    defaultSecureTokenLifetime: 10000,
    keepPendingSessionsOnDisconnect: false,
    securityMode: MessageSecurityMode.None,
    securityPolicy: SecurityPolicy.None
};

const client = OPCUAClient.create(options);

client.on("backoff", (count: number, delay: number) => {
    console.log("backoff ");
});

async function test1() {

    try {

        await client.connect("opc.tcp://opcuademo.sterfive.com:26543");

        const session: ClientSession = await client.createSession({
            type: UserTokenType.UserName,

            password: "password1",
            userName: "user1"
        });

        const subscription = await session.createSubscription2({
            maxNotificationsPerPublish: 1000,
            publishingEnabled: true,
            requestedLifetimeCount: 100,
            requestedMaxKeepAliveCount: 10,
            requestedPublishingInterval: 1000
        });

        subscription.on("raw_notification", (n) => {
            console.log(n.toString());
        });

        const parameters1: MonitoringParametersOptions = {
            discardOldest: true,
            queueSize: 100,
            samplingInterval: 100,

            filter: new DataChangeFilter({
                deadbandType: DeadbandType.Absolute,
                deadbandValue: 0.1,
                trigger: DataChangeTrigger.StatusValueTimestamp
            })
        };
        const itemToMonitor1: ReadValueIdOptions = {
            attributeId: AttributeIds.Value,
            nodeId: "ns=1;s=FanSpeed"
        };

        const item1 = await subscription.monitor(itemToMonitor1, parameters1, TimestampsToReturn.Source);

        console.log(" Item1 = ", item1.result!.statusCode.toString());

        item1.on("changed", (dataValue: DataValue) => {
            console.log(" Value1 has changed : ", dataValue.toString());
        });
        const itemToMonitor2: ReadValueIdOptions = {
            attributeId: AttributeIds.EventNotifier,
            nodeId: "i=2258"
        };
        const parameters2: MonitoringParametersOptions = {
            discardOldest: true,
            filter: new EventFilter({}),
            queueSize: 100,
            samplingInterval: 0
        };
        const item2 = subscription.monitor(itemToMonitor2, parameters2, TimestampsToReturn.Both);

        await wait(20000);

        await subscription.terminate();

        await client.disconnect();

        console.log(" Done!");

    } catch (e) {
        // Deal with the fact the chain failed
        console.log(chalk.red("Error !"), e);
        process.exit(-1);
    }

}

async function test2() {

    console.log("----------------------------------------------------");

    try {

        await client.connect("opc.tcp://opcuademo.sterfive.com:26543");

        const session: ClientSession = await client.createSession({
            type: UserTokenType.UserName,

            password: "password1",
            userName: "user1"
        });

        const subscription = ClientSubscription.create(session, {
            maxNotificationsPerPublish: 1000,
            publishingEnabled: true,
            requestedLifetimeCount: 100,
            requestedMaxKeepAliveCount: 10,
            requestedPublishingInterval: 500
        });

        subscription.on("error", (err) => {
            console.log(" Error :", err);
        });
        subscription.on("keepalive", () => {
            console.log(" Keep Alive");
        });

        const parameters1: MonitoringParametersOptions = {
            discardOldest: true,
            queueSize: 100,
            samplingInterval: 250
        };
        const itemToMonitor1: ReadValueIdOptions = {
            attributeId: AttributeIds.Value,
            nodeId: "ns=1;s=PumpSpeed"
        };

        const item1 = ClientMonitoredItem.create(subscription, itemToMonitor1, parameters1, TimestampsToReturn.Both);
        item1
            .on("changed", (dataValue: DataValue) => {
                console.log(" Value1 has changed : ", dataValue.toString());
            })
            .on("terminated", () => {
                console.log("item1 has been terminated");
            });

        const itemToMonitor2: ReadValueIdOptions = {
            attributeId: AttributeIds.Value,
            nodeId: "ns=1;s=FanSpeed"
        };
        const item2 = ClientMonitoredItem.create(subscription, itemToMonitor2, parameters1, TimestampsToReturn.Both);
        item2
            .on("changed", (dataValue: DataValue) => {
                console.log(" Value2 has changed : ", dataValue.toString());
            })
            .on("terminated", () => {
                console.log("item2 has been terminated");
            });

        await wait(10000);

        await subscription.terminate();

        await client.disconnect();

        console.log(" Done!");

    } catch (e) {
        // Deal with the fact the chain failed
        console.log(chalk.red("Error !"), e);
        process.exit(-1);
    }

}

(async () => {

    await test1();

    console.log(" ----------- sample2");
    await test2();

})();
