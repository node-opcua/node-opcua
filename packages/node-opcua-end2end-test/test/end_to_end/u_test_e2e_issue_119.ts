import "should";
import {
    OPCUAClient,
    VariableIds,
    makeNodeId,
    resolveNodeId,
    AttributeIds,
    Variant,
    DataType,
    TimestampsToReturn
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { wait_until_condition, wait } from "../../test_helpers/utils";

interface TestHarness { endpointUrl: string; server: any; [k: string]: any }

export function t(test: TestHarness) {
    describe("Testing bug #119 - monitored item reports only real value changes", () => {
        let client: OPCUAClient; let endpointUrl: string;

        beforeEach(() => {
            client = OPCUAClient.create({ keepSessionAlive: true, requestedSessionTimeout: 40 * 60 * 1000 });
            endpointUrl = test.endpointUrl;
        });
        afterEach(async () => {
            if (client) { await client.disconnect(); }
            // @ts-ignore
            client = null;
        });

        it("monitoring variables shall only report real value changes (bug #119)", async () => {
            await client.withSessionAsync(endpointUrl, async (session) => {
                const requestedPublishingInterval = 150;
                const subscription = await session.createSubscription2({
                    requestedPublishingInterval,
                    requestedLifetimeCount: 6000,
                    requestedMaxKeepAliveCount: 100,
                    maxNotificationsPerPublish: 20,
                    publishingEnabled: true,
                    priority: 6
                });

                const nodeId = makeNodeId(VariableIds.Server_ServerStatus_BuildInfo_ProductName);
                const samplingInterval = 1000; // variable minimumSamplingInterval is 1000 ms
                const monitoredItem = await subscription.monitor(
                    { nodeId: resolveNodeId(nodeId), attributeId: AttributeIds.Value },
                    { samplingInterval, discardOldest: true, queueSize: 1 },
                    TimestampsToReturn.Both
                );
                (monitoredItem.result!).revisedSamplingInterval.should.eql(samplingInterval);

                let change_count = 0;
                monitoredItem.on("changed", (dataValue: any) => { dataValue.should.be.ok(); change_count += 1; });

                await wait_until_condition(() => change_count === 1, 2000);
                await wait(500);
                change_count.should.eql(1);

                const node = test.server.engine.addressSpace.findNode(nodeId);
                node.should.be.ok();
                // mutate productName
                test.server.engine.serverStatus.buildInfo.productName += "Modified";

                await wait_until_condition(() => change_count === 2, 5000);
                await wait(requestedPublishingInterval * 2);
                change_count.should.eql(2);
                await subscription.terminate();
            });
        });

        it("server fast sampling shall not exceed client sampling rate", async () => {
            await client.withSessionAsync(endpointUrl, async (session) => {
                const subscription = await session.createSubscription2({
                    requestedPublishingInterval: 250,
                    requestedLifetimeCount: 10 * 60 * 10,
                    requestedMaxKeepAliveCount: 10,
                    maxNotificationsPerPublish: 2,
                    publishingEnabled: true,
                    priority: 6
                });
                const nodeId = "ns=2;s=Static_Scalar_Double";
                let count = 1.0;
                const v: any = test.server.engine.addressSpace.findNode(nodeId);
                v.setValueFromSource(new Variant({ dataType: DataType.Double, value: count }));

                const timerId = setInterval(() => {
                    count += 1;
                    v.setValueFromSource(new Variant({ dataType: DataType.Double, value: count }));
                }, 20); // high rate

                const monitoredItem = await subscription.monitor(
                    { nodeId: resolveNodeId(nodeId), attributeId: AttributeIds.Value },
                    { samplingInterval: 500, discardOldest: true, queueSize: 10 },
                    TimestampsToReturn.Both
                );
                (monitoredItem.result!).revisedSamplingInterval.should.eql(500);

                let change_count = 0;
                monitoredItem.on("changed", (dataValue: any) => { dataValue.should.be.ok(); change_count += 1; });

                await wait_until_condition(() => change_count >= 1 && change_count <= 2, 1500);
                await wait_until_condition(() => change_count >= 2 && change_count <= 4, 1500);
                await wait_until_condition(() => change_count >= 4 && change_count <= 6, 2000);

                count.should.be.greaterThan(50);
                clearInterval(timerId);
                await subscription.terminate();
            });
        });
    });
}
