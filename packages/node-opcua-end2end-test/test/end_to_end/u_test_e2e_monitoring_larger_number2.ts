import {
    AddressSpace,
    assert,
    AttributeIds,
    ClientSession,
    ClientSidePublishEngine,
    ClientSubscription,
    DataChangeNotification,
    ExtensionObject,
    MonitoredItemNotification,
    MonitoringParametersOptions,
    Namespace,
    NodeIdLike,
    NotificationMessage,
    OPCUAClient,
    OPCUAClientOptions,
    ReadValueIdOptions,
    StatusCode,
    TimestampsToReturn
} from "node-opcua";
import sinon = require("sinon");
import should = require("should");

import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
import { itemsToMonitor1 } from "./_helpers_items_to_monitor";
import { clearTimeout } from "timers";
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

interface ClientSidePublishEnginePrivate extends ClientSidePublishEngine {
    internalSendPublishRequest(): void;
    suspend(suspend: boolean): void;
}
function getInternalPublishEngine(session: ClientSession): ClientSidePublishEnginePrivate {
    const s: ClientSidePublishEnginePrivate = (session as any).getPublishEngine();
    return s;
}
export function t(test: any) {
    const options: OPCUAClientOptions = {
        requestedSessionTimeout: 10000000
    };

    async function createSession() {
        const client = OPCUAClient.create(options);
        const endpointUrl = test.endpointUrl;
        await client.connect(endpointUrl);
        const session = await client.createSession();

        const publishEngine = getInternalPublishEngine(session);
        publishEngine.timeoutHint = 100000000; // for debugging with ease !
        // make sure we control how PublishRequest are send
        // xx publishEngine.suspend(true);

        // create a subscriptions
        const subscription = ClientSubscription.create(session, {
            publishingEnabled: true,
            requestedLifetimeCount: 200000,
            requestedMaxKeepAliveCount: 100,
            requestedPublishingInterval: 2000
        });

        return { client, session, subscription, publishEngine };
    }
    interface Connection {
        client: OPCUAClient;
        session: ClientSession;
        subscription: ClientSubscription;
        publishEngine: ClientSidePublishEnginePrivate;
    }
    let s: Connection;
    async function waitForRawNotifications(): Promise<ExtensionObject[]> {
        const { publishEngine, subscription } = s;
        publishEngine.internalSendPublishRequest();
        return await new Promise((resolve: (result: ExtensionObject[]) => void) => {
            // wait for fist notification
            subscription.once("raw_notification", (notificationMessage: any) => {
                // tslint:disable-next-line: no-console
                debugLog("got notification message ", notificationMessage.toString());
                resolve(notificationMessage.notificationData);
            });
        });
    }
    async function waitForNotificationsValues(): Promise<{ value: number; statusCode: StatusCode }[]> {
        while (true) {
            const notificationData1 = await waitForRawNotifications();
            if (notificationData1.length > 0) {
                const dcn = notificationData1[0] as DataChangeNotification;
                const r = dcn.monitoredItems!.map((item: MonitoredItemNotification) => ({
                    statusCode: item.value.statusCode,
                    value: item.value.value.value
                }));
                return r;
            }
            // tslint:disable-next-line: no-console
            debugLog(" ------- skipping empty publish response");
            return [];
        }
    }

    const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
    describe("Monitoring Large number of node", function (this: any) {
        this.timeout(Math.max(200000, this.timeout()));

        before(() => {
            const addressSpace = test.server.engine.addressSpace as AddressSpace;
            const namespace = test.server.engine.addressSpace.getOwnNamespace() as Namespace;
        });
        beforeEach(async () => {
            const addressSpace = test.server.engine.addressSpace as AddressSpace;
            s = await createSession();
        });
        afterEach(async () => {
            await s.subscription.terminate();
            await s.session.close();
            await s.client.disconnect();
        });

        it("Should monitor a large number of node efficiently", async () => {
            const { session, subscription, publishEngine } = s;

            const namespaceArray = await session.readNamespaceArray();
            const simulationNamespaceIndex = namespaceArray.indexOf("urn://node-opcua-simulator");
            console.log("simulationNamespaceIndex = ", simulationNamespaceIndex);

            let itemToMonitors: ReadValueIdOptions[] = itemsToMonitor1;
            while (itemToMonitors.length + itemsToMonitor1.length < 10000) {
                itemToMonitors = itemToMonitors.concat([...itemsToMonitor1]);
            }

            const dataValues = await session.read(itemToMonitors);
            console.log(
                dataValues
                    .map((x) => x.statusCode.toString())
                    .filter((x, index) => index % 1000 === 0)
                    .join(" ")
            );

            const requesterParameters: MonitoringParametersOptions = {
                discardOldest: true,
                queueSize: 100,
                samplingInterval: 1000
            };

            subscription.on("raw_notification", (notificationMessage: NotificationMessage) => {
                // console.log("row Notification = ", notificationMessage.toString());
            });
            let counter = 0;
            let _err!: Error;
            try {
                console.time("A");
                const group = await subscription.monitorItems(itemToMonitors, requesterParameters, TimestampsToReturn.Both);
                console.timeEnd("A");

                console.log("set event handler on group");

                console.time("B");

                await new Promise<void>((resolve) => {
                    const timerId = setTimeout(() => resolve(), 12000);
                    group.on("changed", (monitoredItem, dataValue, index) => {
                        counter++;
                        if (counter === itemToMonitors.length) {
                            clearTimeout(timerId);
                            resolve();
                        }
                        if ((index +1)% 5000 === 0) {
                            console.log("index ", index+1);
                        }
                    });
                });

                console.timeEnd("B");
                //   await new Promise((resolve) => setTimeout(resolve, 10000));
            } catch (err) {
                _err = err as Error;
            }
            should.not.exist(_err, "not expecting any exception");
            counter.should.eql(itemToMonitors.length);
        });
    });
}
