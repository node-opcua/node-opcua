import "should";
import { OPCUAClient, coerceNodeId, ClientMonitoredItem, AttributeIds, TimestampsToReturn } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_subscription } from "../../test_helpers/perform_operation_on_client_session";

interface TestHarness { endpointUrl: string; [k: string]: any }

export function t(test: TestHarness) {
    describe("Issue #313 - monitoring invalid nodeId twice shouldn't crash", () => {
        it("Does not crash when monitoring same invalid nodeId twice", async () => {
            const badNodeId = coerceNodeId("ns=4;s=TestVerzeichnis.TestKnotn"); // miss-typed
            const client = OPCUAClient.create({});
            const endpointUrl = test.endpointUrl;

            await perform_operation_on_subscription(client, endpointUrl, async (_session, subscription) => {
                async function addMonitoredItemExpectingError() {
                    await new Promise<void>((resolve, reject) => {
                        const monitoredItem = ClientMonitoredItem.create(
                            subscription,
                            { nodeId: badNodeId, attributeId: AttributeIds.Value },
                            { samplingInterval: 50, discardOldest: true, queueSize: 1 },
                            TimestampsToReturn.Both
                        );
                        monitoredItem.on("initialized", () => reject(new Error("should not receive initialized event")));
                        monitoredItem.on("changed", () => reject(new Error("should not emit changed for invalid node")));
                        monitoredItem.on("err", () => resolve());
                    });
                }
                await addMonitoredItemExpectingError();
                await addMonitoredItemExpectingError();
            });
        });
    });
}