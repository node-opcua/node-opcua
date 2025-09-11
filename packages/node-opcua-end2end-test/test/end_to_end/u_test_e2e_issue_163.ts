import "should";
import {
    OPCUAClient,
    AttributeIds,
    ClientSubscription,
    StatusCodes,
    Variant,
    DataType,
    ClientMonitoredItem
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

interface TestHarness { endpointUrl: string; server: any; [k: string]: any }

/**
 * Bug #163 - Variable alternating between Good values and Bad status should not cause internal errors.
 * The server variable returns StatusCodes.Bad when exceeding threshold then resets to lower value.
 * Test ensures monitored item continues receiving notifications without server internal error.
 */
export function t(test: TestHarness) {
    describe("Bug #163 monitored variable alternates Good/Bad status", () => {
        it("monitors variable with intermittent Bad status", async () => {
            const server = test.server;
            const refreshRate = 500; // ms
            const addressSpace = server.engine.addressSpace;
            const namespace = addressSpace.getOwnNamespace();
            let variable2 = 16.0;

            const theVariable = namespace.addVariable({
                organizes: addressSpace.rootFolder.objects,
                nodeId: "ns=1;b=1020FFAA",
                browseName: "MyVariable2",
                dataType: "Double",
                minimumSamplingInterval: 100,
                value: {
                    get: () => {
                        if (variable2 >= 20.0) {
                            variable2 = 10.0;
                            return StatusCodes.Bad; // simulate transient failure
                        }
                        variable2 += 1.0;
                        return new Variant({ dataType: DataType.Double, value: variable2 });
                    },
                    set: (variant: any) => {
                        variable2 = parseFloat(variant.value);
                        return StatusCodes.Good;
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

                let changes = 0;
                const monitoredItem = ClientMonitoredItem.create(
                    subscription,
                    { nodeId: theVariable.nodeId, attributeId: AttributeIds.Value },
                    { samplingInterval: refreshRate / 2, discardOldest: true, queueSize: 100 }
                );
                monitoredItem.on("changed", () => { changes++; });

                await new Promise(r => setTimeout(r, 3000));
                changes.should.be.greaterThan(0, "should have received notifications, even with intermittent Bad status");

                await subscription.terminate();
                await session.close();
            } finally {
                await client.disconnect();
            }
        });
    });
}
