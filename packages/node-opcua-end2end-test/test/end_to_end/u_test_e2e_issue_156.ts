import "should";
import { DataValue, ClientMonitoredItem, OPCUAClient, AttributeIds, ClientSubscription } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

interface TestHarness { endpointUrl: string; server: any; [k: string]: any }

/**
 * Bug #156 - Monitoring a variable with sampling rate faster than the variable's own refresh cycle.
 * Ensures no errors occur and subscription handles oversampling gracefully (queue/discard behavior).
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
                browseName: "SlowVariable",
                dataType: "UInt32",
                value: {
                    refreshFunc: (callback: any) => {
                        setTimeout(() => {
                            counter += 1;
                            callback(null, new DataValue({ value: { dataType: "UInt32", value: counter } }));
                        }, refreshRate);
                    }
                }
            });

            const client = OPCUAClient.create({});
            const endpointUrl = test.endpointUrl;
            await client.connect(endpointUrl);
            let session: any;
            try {
                session = await client.createSession();

                const subscription = ClientSubscription.create(session, {
                    requestedPublishingInterval: 150,
                    requestedLifetimeCount: 10 * 60 * 10,
                    requestedMaxKeepAliveCount: 10,
                    maxNotificationsPerPublish: 2,
                    publishingEnabled: true,
                    priority: 6
                });

                let changeCount = 0;
                const monitoredItem = ClientMonitoredItem.create(
                    subscription,
                    { nodeId: slowVar.nodeId, attributeId: AttributeIds.Value },
                    {
                        samplingInterval: refreshRate / 2, // faster than refresh function
                        discardOldest: true,
                        queueSize: 100
                    }
                );
                monitoredItem.on("changed", () => { changeCount++; });

                await new Promise((resolve) => setTimeout(resolve, 3000));
                changeCount.should.be.greaterThan(0, "should have received at least one change");

                await subscription.terminate();
                await session.close();
            } finally {
                await client.disconnect();
            }
        });
    });
}
