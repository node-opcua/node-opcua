import "should";
import {
    OPCUAClient,
    AttributeIds,
    DataValue,
    makeBrowsePath,
    StatusCodes,
    TimestampsToReturn
} from "node-opcua";
import { make_debugLog } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

const debugLog = make_debugLog("TEST");

interface TestHarness { endpointUrl: string; server: any; [k: string]: any }

/**
 * Bug #135 - Server should expose SessionDiagnostics.CurrentMonitoredItemsCount and related counters correctly.
 */
export function t(test: TestHarness) {
    describe("Bug #135 currentMonitoredItemsCount", () => {
        it("verifies monitored/subscription counts and diagnostics", async () => {
            const server = test.server;
            const refreshRate = 500;
            let counter = 1;
            const namespace = server.engine.addressSpace.getOwnNamespace();
            const slowVar = namespace.addVariable({
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

            const client = OPCUAClient.create({ clientName: "SomeFancyClientName", requestedSessionTimeout: 60000 });
            await client.connect(test.endpointUrl);
            try {
                const session = await client.createSession();
                const subscription = await session.createSubscription2({
                    requestedPublishingInterval: 150,
                    requestedLifetimeCount: 10 * 60 * 10,
                    requestedMaxKeepAliveCount: 10,
                    maxNotificationsPerPublish: 20,
                    publishingEnabled: true,
                    priority: 6
                });

                debugLog("publishingInterval", subscription.publishingInterval);

                const nodesToMonitor = [slowVar.nodeId, "i=2254"]; // Server_ServerStatus_CurrentTime
                for (const nodeId of nodesToMonitor) {
                    await subscription.monitor(
                        { nodeId, attributeId: AttributeIds.Value },
                        { samplingInterval: refreshRate / 2, discardOldest: true, queueSize: 100 },
                        TimestampsToReturn.Both
                    );
                }

                const sessionId = session.sessionId;
                debugLog("session nodeId =", sessionId.toString());

                const browsePaths = [
                    makeBrowsePath(sessionId, ".SessionDiagnostics.CurrentMonitoredItemsCount"),
                    makeBrowsePath(sessionId, ".SessionDiagnostics.CurrentSubscriptionsCount"),
                    makeBrowsePath(sessionId, ".SessionDiagnostics")
                ];
                const browsePathResults = await session.translateBrowsePath(browsePaths);
                browsePathResults.forEach(r => r.statusCode.should.eql(StatusCodes.Good));

                const nodesToRead = browsePathResults.map((r) => {
                    if (!r.targets || r.targets.length === 0) {
                        throw new Error("BrowsePath translation returned no targets when Good status expected");
                    }
                    return {
                        nodeId: r.targets[0].targetId,
                        attributeId: AttributeIds.Value
                    };
                });
                const dataValues = await session.read(nodesToRead);
                dataValues.length.should.eql(3);

                const currentMonitoredItemsCount = dataValues[0].value.value;
                const currentSubscriptionsCount = dataValues[1].value.value;
                const diagnostics = dataValues[2].value.value;

                debugLog("CurrentMonitoredItemsCount =", currentMonitoredItemsCount);
                debugLog("currentSubscriptionsCount =", currentSubscriptionsCount);
                debugLog("diagnostic =", dataValues[2].value.toString());

                currentSubscriptionsCount.should.eql(1, "expecting one subscription");
                currentMonitoredItemsCount.should.eql(2);
                diagnostics.constructor.name.should.eql("SessionDiagnosticsDataType");
                // Note: original test expected clientName + '1'; keeping original expectation
                diagnostics.sessionName.toString().should.eql("SomeFancyClientName1");

                await subscription.terminate();
                await session.close();
            } finally {
                await client.disconnect();
            }
        });
    });
}
