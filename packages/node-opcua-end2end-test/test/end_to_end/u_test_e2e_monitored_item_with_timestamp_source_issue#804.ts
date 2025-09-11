import "should";
import {
    TimestampsToReturn,
    OPCUAClient,
    ClientSubscription,
    ClientMonitoredItem,
    AttributeIds,
    resolveNodeId
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_client_session } from "../../test_helpers/perform_operation_on_client_session";

interface TestHarness { endpointUrl: string; [k: string]: any }

/**
 * Issue #804 - Ensure monitoring with TimestampsToReturn.Source produces DataValues with only sourceTimestamp.
 */
export function t(test: TestHarness) {
    describe("MonitoredItem with TimestampsToReturn.Source (#804)", () => {
        it("monitors with SourceTimestamp only", async () => {
            const client = OPCUAClient.create({});
            await perform_operation_on_client_session(client, test.endpointUrl, async (session) => {
                const subscription = ClientSubscription.create(session, {
                    requestedPublishingInterval: 150,
                    requestedLifetimeCount: 10 * 60 * 10,
                    requestedMaxKeepAliveCount: 10,
                    maxNotificationsPerPublish: 20000,
                    publishingEnabled: true,
                    priority: 6
                });

                let sourceTimestampCount = 0;
                let serverTimestampCount = 0;
                let notificationCount = 0;
                const ids = [
                    "Scalar_Simulation_Double",
                    "Scalar_Simulation_Boolean",
                    "Scalar_Simulation_String",
                    "Scalar_Simulation_Int64",
                    "Scalar_Simulation_LocalizedText"
                ];

                for (const id of ids) {
                    const nodeId = "ns=2;s=" + id;
                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        { nodeId: resolveNodeId(nodeId), attributeId: AttributeIds.Value },
                        { samplingInterval: 10, discardOldest: true, queueSize: 1 },
                        TimestampsToReturn.Source
                    );
                    monitoredItem.on("changed", (dataValue) => {
                        if (dataValue.sourceTimestamp) sourceTimestampCount++;
                        if (dataValue.serverTimestamp) serverTimestampCount++;
                        notificationCount++;
                    });
                }

                await new Promise<void>((resolve) => subscription.once("started", () => resolve()));
                await new Promise((r) => setTimeout(r, 3000));

                serverTimestampCount.should.eql(0);
                sourceTimestampCount.should.eql(notificationCount);
                await subscription.terminate();
            });
        });
    });
}
