import "should";
import { OPCUAClient, DataValue, AttributeIds, ClientSubscription, ClientMonitoredItem } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

interface TestHarness { endpointUrl: string; server: any; [k: string]: any }

const doDebug = false;

/**
 * Bug #123 - Monitoring same variable with multiple monitored items on a single subscription.
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
            await client.connect(test.endpointUrl);
            try {
                const session = await client.createSession();
                const subscription = ClientSubscription.create(session, {
                    requestedPublishingInterval: 150,
                    requestedLifetimeCount: 10 * 60 * 10,
                    requestedMaxKeepAliveCount: 10,
                    maxNotificationsPerPublish: 2,
                    publishingEnabled: true,
                    priority: 6
                });

                if (doDebug) {
                    subscription.once("started", () => console.log("publishingInterval", subscription.publishingInterval));
                }

                const makeMonitor = () => ClientMonitoredItem.create(
                    subscription,
                    { nodeId: variableToMonitor.nodeId, attributeId: AttributeIds.Value },
                    { samplingInterval: refreshRate, discardOldest: true, queueSize: 100 }
                );

                let change1 = 0; let change2 = 0;
                const monitoredItem1 = makeMonitor();
                monitoredItem1.on("changed", (dv) => { change1++; if (doDebug) console.log("DataValue1", dv.value.toString()); });
                const monitoredItem2 = makeMonitor();
                monitoredItem2.on("changed", (dv) => { change2++; if (doDebug) console.log("DataValue2", dv.value.toString()); });

                await new Promise(r => setTimeout(r, 1000));
                change1.should.be.greaterThan(0);
                change2.should.be.greaterThan(0);

                await subscription.terminate();
                await session.close();
            } finally {
                await client.disconnect();
            }
        });
    });
}
