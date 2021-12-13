"use strict";

const sinon = require("sinon");

const {
    OPCUAClient,
    ClientSubscription,
    AttributeIds,
    resolveNodeId,
    ClientMonitoredItem,
    ClientMonitoredItemGroup,
} = require("node-opcua");

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function (test) {
    describe("Testing ClientMonitoredItem#on('terminated') event", function () {
        let client, endpointUrl;

        beforeEach(async () => {
            if (process.gc) {
                process.gc();
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
            client = null;
        });

        async function common(preset, next) {
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

                await new Promise((resolve, reject) => {
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
            const terminatedSpies = {};

            await common(
                async (subscription) => {
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
                async (subscription) => {
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
            const terminatedSpies = {};

            const monitoredItems = {};

            await common(
                async (subscription) => {
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
                async (subscription) => {
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
            let terminatedSpy;
            let monitoredItemGroup;

            await common(
                async (subscription) => {
                    const itemsToMonitor = [];
                    for (const id of ids) {
                        const nodeId = "ns=2;s=" + id;
                        itemsToMonitor.push({ nodeId: resolveNodeId(nodeId), attributeId: AttributeIds.Value });
                    }

                    monitoredItemGroup = ClientMonitoredItemGroup.create(subscription, itemsToMonitor, parameters);

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
            let terminatedSpy;
            let monitoredItemGroup;

            await common(
                async (subscription) => {
                    const itemsToMonitor = [];
                    for (const id of ids) {
                        const nodeId = "ns=2;s=" + id;
                        itemsToMonitor.push({ nodeId: resolveNodeId(nodeId), attributeId: AttributeIds.Value });
                    }

                    monitoredItemGroup = ClientMonitoredItemGroup.create(subscription, itemsToMonitor, parameters);

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
