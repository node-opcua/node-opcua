"use strict";

import sinon from "sinon";

import {
    OPCUAClient,
    ClientSubscription,
    AttributeIds,
    resolveNodeId,
    ClientMonitoredItem,
    ClientMonitoredItemGroup,
    TimestampsToReturn,
} from "node-opcua";
import { describeWithLeakDetector  as describe } from "node-opcua-leak-detector";

export function t(test: any) {
    describe("Testing ClientMonitoredItem#on('terminated') event", function () {
        let client: OPCUAClient;
        let endpointUrl: string;

        beforeEach(async () => {
            if ((process as any).gc) {
                (process as any).gc();
            }

            client = OPCUAClient.create({ endpointMustExist: false });

            client.on("backoff", () => {
                console.log("backoff");
            });
            endpointUrl = test.endpointUrl;

            client.on("lifetime_75", (token) => console.log("token about to expire", token ? token.toString() : "" ));
            if (false) {
                client.on("send_chunk", (buf) => console.log("chunk =>", buf.length));
                client.on("receive_chunk", (buf) => console.log("chunk <= ", buf.length));
            }
        });

        afterEach(async () => {
            await client.disconnect();
        });

        async function common(
            preset: (subscription: ClientSubscription) => Promise<void>, 
            next: (subscription: ClientSubscription) => Promise<void>
        ) {
            await client.withSessionAsync(test.endpointUrl, async (session) => {
                const subscription = ClientSubscription.create(session, {
                    requestedPublishingInterval: 150,
                    requestedLifetimeCount: 10 * 60 * 10,
                    requestedMaxKeepAliveCount: 10,
                    maxNotificationsPerPublish: 20000,
                    publishingEnabled: true,
                    priority: 6,
                });

                await new Promise((resolve) => subscription.once("started", resolve));

                try {
                    await preset(subscription);
                } catch (err) {
                    console.log("Preset has failed");
                }

                await new Promise<void>((resolve, reject) => {
                    setTimeout(async () => {
                        try {
                            await next(subscription);
                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    }, 1000);
                });
            });
        }
        const ids = [
            "Scalar_Simulation_Double",
            "Scalar_Simulation_Boolean",
            "Scalar_Simulation_String",
            "Scalar_Simulation_Int64",
            "Scalar_Simulation_LocalizedText",
        ];
        const parameters = { samplingInterval: 10, discardOldest: true, queueSize: 1 };

        it("ClientMonitoredItem should receive an terminated event if terminated implicitly", async () => {
            const terminatedSpies: Record<string, ReturnType<typeof sinon.spy>> = {};

            await common(
                async (subscription: ClientSubscription) => {
                    for (const id of ids) {
                        const nodeId = "ns=2;s=" + id;

                        const monitoredItem = ClientMonitoredItem.create(
                            subscription,
                            { nodeId: resolveNodeId(nodeId), attributeId: AttributeIds.Value },
                            parameters
                        );

                        const spy = sinon.spy();
                        terminatedSpies[id] = spy;
                        monitoredItem.on("terminated", spy);
                    }
                },
                async (subscription: ClientSubscription) => {
                    await subscription.terminate();
                    for (const id of ids) {
                        const spy = terminatedSpies[id];
                        spy.callCount.should.eql(
                            1,
                            "terminated should have been called once for monitoredItem on " + id
                        );
                    }
                }
            );
        });

        it("ClientMonitoredItem should receive an terminated event if terminated explicitly", async () => {
            const terminatedSpies: Record<string, ReturnType<typeof sinon.spy>> = {};

            const monitoredItems: Record<string, ClientMonitoredItem> = {};

            await common(
                async (subscription: ClientSubscription) => {
                    for (const id of ids) {
                        const nodeId = "ns=2;s=" + id;

                        const monitoredItem = ClientMonitoredItem.create(
                            subscription,
                            { nodeId: resolveNodeId(nodeId), attributeId: AttributeIds.Value },
                            parameters
                        );

                        const spy = sinon.spy();
                        terminatedSpies[id] = spy;

                        monitoredItems[id] = monitoredItem;

                        monitoredItem.on("terminated", spy);
                    }
                },
                async (subscription: ClientSubscription) => {
                    for (const id of ids) {
                        await monitoredItems[id].terminate();
                    }
                    for (const id of ids) {
                        const spy = terminatedSpies[id];
                        spy.callCount.should.eql(
                            1,
                            "terminated should have been called once for monitoredItem on " + id
                        );
                    }

                    await subscription.terminate();

                    for (const id of ids) {
                        const spy = terminatedSpies[id];
                        spy.callCount.should.eql(
                            1,
                            "terminated should have been called once for monitoredItem on " + id
                        );
                    }
                }
            );
        });

        it("ClientMonitoredItemGroup should receive an terminated event if terminated explicitly", async () => {
            let terminatedSpy: ReturnType<typeof sinon.spy>;
            let monitoredItemGroup: ClientMonitoredItemGroup;

            await common(
                async (subscription) => {
                    const itemsToMonitor = [];
                    for (const id of ids) {
                        const nodeId = "ns=2;s=" + id;
                        itemsToMonitor.push({ nodeId: resolveNodeId(nodeId), attributeId: AttributeIds.Value });
                    }

                    monitoredItemGroup = ClientMonitoredItemGroup.create(
                        subscription, 
                        itemsToMonitor, 
                        parameters,
                        TimestampsToReturn.Both
                    );

                    terminatedSpy = sinon.spy();
                    monitoredItemGroup.on("terminated", terminatedSpy);

                    await new Promise((resolve) => monitoredItemGroup.once("initialized", resolve));
                },

                async (subscription) => {
                    await monitoredItemGroup.terminate();
                    terminatedSpy.callCount.should.eql(
                        1,
                        "terminated should have been called once for monitoredItemGroup"
                    );

                    await subscription.terminate();

                    terminatedSpy.callCount.should.eql(
                        1,
                        "terminated should have been called once for monitoredItemGroup"
                    );
                }
            );
        });

        it("ClientMonitoredItemGroup should receive an terminated event if terminated explicitly", async () => {
            let terminatedSpy: ReturnType<typeof sinon.spy>;
            let monitoredItemGroup: ClientMonitoredItemGroup;

            await common(
                async (subscription) => {
                    const itemsToMonitor = [];
                    for (const id of ids) {
                        const nodeId = "ns=2;s=" + id;
                        itemsToMonitor.push({ nodeId: resolveNodeId(nodeId), attributeId: AttributeIds.Value });
                    }

                    monitoredItemGroup = ClientMonitoredItemGroup.create(
                        subscription, 
                        itemsToMonitor,
                             parameters,
                        TimestampsToReturn.Both
                    );

                    terminatedSpy = sinon.spy();
                    monitoredItemGroup.on("terminated", terminatedSpy);

                    await new Promise((resolve) => monitoredItemGroup.once("initialized", resolve));
                },

                async (subscription) => {
                    await subscription.terminate();
                    terminatedSpy.callCount.should.eql(
                        1,
                        "terminated should have been called once for monitoredItemGroup"
                    );
                }
            );
        });
    });
};
