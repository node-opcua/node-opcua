import "should";
import { OPCUAClient, ClientMonitoredItem, resolveNodeId, AttributeIds } from "node-opcua";
import sinon from "sinon";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_subscription } from "../../test_helpers/perform_operation_on_client_session";

interface TestHarness { endpointUrl: string; server?: any; [k: string]: any }

// Collect a fixed number of monitored item change notifications using a spy.
// Returns the spy once the desired count has been reached or rejects on timeout.
async function collectMonitoredItemChanges(monitoredItem: ClientMonitoredItem, count: number, timeoutMs: number): Promise<sinon.SinonSpy> {
    const spy = sinon.spy();
    return await new Promise<sinon.SinonSpy>((resolve, reject) => {
        const timer = setTimeout(() => {
            monitoredItem.removeListener("changed", onChanged);
            reject(new Error(`Expected ${count} ServerStatus changes within ${timeoutMs} ms (got ${spy.callCount}).`));
        }, timeoutMs);
        function onChanged(dataValue: any) {
            spy(dataValue);
            if (spy.callCount >= count) {
                clearTimeout(timer);
                monitoredItem.removeListener("changed", onChanged);
                resolve(spy);
            }
        }
        monitoredItem.on("changed", onChanged);
    });
}

export function t(test: TestHarness) {
    describe("Issue #253 - ServerStatus monitored item notifications", function (this: Mocha.Context) {
        this.timeout(Math.max(3000, this.timeout()));

        let oldMinSampling = 0;
        before(() => {
            if (test.server) {
                const node = test.server.engine.addressSpace.findNode("i=2256");
                oldMinSampling = node.minimumSamplingInterval;
                node.minimumSamplingInterval = 10; // speed up test
            }
        });
        after(() => {
            if (test.server) {
                const node = test.server.engine.addressSpace.findNode("i=2256");
                node.minimumSamplingInterval = oldMinSampling;
            }
        });

        it("KK1 subscription receives ServerStatus notifications", async () => {
            const client = OPCUAClient.create({});
            const endpointUrl = test.endpointUrl;
            await perform_operation_on_subscription(client, endpointUrl, async (session, subscription) => {
                const monitoredItem = ClientMonitoredItem.create(
                    subscription,
                    { nodeId: resolveNodeId("ns=0;i=2256"), attributeId: AttributeIds.Value },
                    { samplingInterval: 100, discardOldest: true, queueSize: 1 }
                );
                await new Promise<void>((res) => monitoredItem.once("initialized", () => { res(); }));
                monitoredItem.monitoringParameters.samplingInterval.should.equal(100);

                // Collect 4 notifications (original logic was changes > 3)
                const spy = await collectMonitoredItemChanges(monitoredItem, 4, 5000);
                // Perform assertions on collected samples outside collector logic
                spy.callCount.should.be.greaterThanOrEqual(4);
                for (const call of spy.getCalls()) {
                    const dv = call.args[0];
                    dv.value.value.should.have.ownProperty("buildInfo");
                    dv.value.value.should.have.ownProperty("startTime");
                    dv.value.value.should.have.ownProperty("shutdownReason");
                    dv.value.value.constructor.name.should.eql("ServerStatusDataType");
                }
            });
        });
    });
}