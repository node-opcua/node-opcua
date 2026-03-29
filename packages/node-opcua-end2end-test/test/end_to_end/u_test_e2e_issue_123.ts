import "should";
import { AttributeIds, ClientMonitoredItem, type ClientSession, type ClientSubscription, DataValue, OPCUAClient } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { waitForChange } from "./_helpers_monitoring";

interface TestHarness {
    endpointUrl: string;
    server: any;
    [k: string]: any;
}

const doDebug = false;

/**
 * Bug #123 - Monitoring same variable with multiple monitored items
 * on a single subscription.
 * Ensures both monitored items receive data changes independently.
 */
export function t(test: TestHarness) {
    describe("Bug #123 multiple monitors on same variable", () => {
        it("creates two monitored items for one variable", async () => {
            const server = test.server;
            const refreshRate = 100; // ms
            const namespace = server.engine.addressSpace.getOwnNamespace();
            let counter = 1;
            const variableToMonitor = namespace.addVariable({
                organizedBy: server.engine.addressSpace.rootFolder.objects,
                browseName: "SlowVariable_123",
                dataType: "UInt32",
                value: {
                    refreshFunc: (callback: any) => {
                        setTimeout(() => {
                            counter += 1;
                            callback(
                                null,
                                new DataValue({
                                    value: {
                                        dataType: "UInt32",
                                        value: counter
                                    }
                                })
                            );
                        }, refreshRate);
                    }
                }
            });

            const client = OPCUAClient.create({});
            await client.withSubscriptionAsync(
                test.endpointUrl,
                {
                    requestedPublishingInterval: 150,
                    requestedLifetimeCount: 10 * 60 * 10,
                    requestedMaxKeepAliveCount: 10,
                    maxNotificationsPerPublish: 2,
                    publishingEnabled: true,
                    priority: 6
                },
                async (_session: ClientSession, subscription: ClientSubscription) => {
                    if (doDebug) {
                        subscription.once("started", () => console.log("publishingInterval", subscription.publishingInterval));
                    }

                    const makeMonitor = () =>
                        ClientMonitoredItem.create(
                            subscription,
                            {
                                nodeId: variableToMonitor.nodeId,
                                attributeId: AttributeIds.Value
                            },
                            {
                                samplingInterval: refreshRate,
                                discardOldest: true,
                                queueSize: 100
                            }
                        );

                    let change1 = 0;
                    let change2 = 0;
                    const monitoredItem1 = makeMonitor();
                    monitoredItem1.on("changed", (dv) => {
                        change1++;
                        if (doDebug) {
                            console.log("DataValue1", dv.value.toString());
                        }
                    });
                    const monitoredItem2 = makeMonitor();
                    monitoredItem2.on("changed", (dv) => {
                        change2++;
                        if (doDebug) {
                            console.log("DataValue2", dv.value.toString());
                        }
                    });

                    // Wait for both monitored items to receive at
                    // least one change event (with a 5 s timeout).
                    await Promise.all([waitForChange(monitoredItem1), waitForChange(monitoredItem2)]);

                    change1.should.be.greaterThan(0);
                    change2.should.be.greaterThan(0);
                }
            );
        });
    });
}
