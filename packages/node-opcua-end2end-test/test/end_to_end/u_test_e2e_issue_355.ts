import "should";
import { OPCUAClient, ClientMonitoredItem, AttributeIds, Variant, DataType, TimestampsToReturn } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_subscription } from "../../test_helpers/perform_operation_on_client_session";
import { redirectToFile } from "node-opcua-debug/nodeJS";
import { redirectToFileAsync } from "node-opcua-debug/source_nodejs/redirect_to_file";
import Sinon from "sinon";
import { waitUntilCondition } from "../discovery/_helper";

interface TestHarness { endpointUrl: string; server?: any;[k: string]: any }

export function t(test: TestHarness) {
    describe("Issue #355 - client monitoredItem handler throwing errors shouldn't crash", () => {
        it("#355 protected against exception in user handler", async () => {
            
            
            
            if (!test.server) return; // skip if no embedded server
            
            
            const client = OPCUAClient.create({});

            await perform_operation_on_subscription(client, test.endpointUrl, async (_session, subscription) => {

                // await redirectToFileAsync("issue_355", async () => {


                    const monitoredItem = await subscription.monitor(
                        { nodeId: "ns=1;s=FanSpeed", attributeId: AttributeIds.Value },
                        { samplingInterval: 10, discardOldest: true, queueSize: 10 },
                        TimestampsToReturn.Both
                    );


                    const spy = Sinon.spy();
                    monitoredItem.on("changed", spy);

                    let callCount = 0;
                    monitoredItem.on("changed", () => {
                        callCount++;
                        if (callCount === 5) {
                            throw new Error("Exception in user code");
                        }
                    });

                    const interval = setInterval(() => {
                        const node = test.server.engine.addressSpace.findNode("ns=1;s=FanSpeed");
                        node.setValueFromSource(new Variant({ value: Math.random(), dataType: DataType.Double }));
                    }, 100);

                    await waitUntilCondition(
                        async () => spy.callCount >= 7,
                        5000,
                        "expecting at least 5 calls to monitoredItem handler"
                    );

                    clearInterval(interval);
                    await monitoredItem.terminate();

               // });
            });
        });
    });
}