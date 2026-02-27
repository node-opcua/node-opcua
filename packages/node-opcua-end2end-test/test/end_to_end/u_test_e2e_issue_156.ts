import "should";
import {
    DataValue,
    ClientMonitoredItem,
    OPCUAClient,
    AttributeIds,
    ClientSubscription,
    ClientSession
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { waitForChange } from "./_helpers_monitoring";

interface TestHarness { endpointUrl: string; server: any;[k: string]: any }

/**
 * Bug #156 - Monitoring a variable with sampling rate faster than
 * the variable's own refresh cycle.
 * Ensures no errors occur and subscription handles oversampling
 * gracefully (queue/discard behavior).
 */
export function t(test: TestHarness) {
    describe("Bug #156 oversampling monitored variable", () => {
        it("creates slow variable and monitors with faster sampling interval", async () => {
            const server = test.server;
            const refreshRate = 500; // ms
            const addressSpace = server.engine.addressSpace;
            const namespace = addressSpace.getOwnNamespace();

            let counter = 1;
            const slowVar = namespace.addVariable({
                organizedBy: addressSpace.rootFolder.objects,
                browseName: "SlowVariable_156",
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
                async (session: ClientSession, subscription: ClientSubscription) => {
                    let changeCount = 0;
                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: slowVar.nodeId,
                            attributeId: AttributeIds.Value
                        },
                        {
                            samplingInterval: refreshRate / 2,
                            discardOldest: true,
                            queueSize: 100
                        }
                    );
                    monitoredItem.on("changed", () => {
                        changeCount++;
                    });

                    // Wait for at least one change event (5 s timeout).
                    await waitForChange(monitoredItem);
                    changeCount.should.be.greaterThan(
                        0,
                        "should have received at least one change"
                    );
                }
            );
        });
    });
}


