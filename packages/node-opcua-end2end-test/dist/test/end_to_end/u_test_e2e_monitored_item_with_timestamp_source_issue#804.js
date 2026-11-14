"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.t = t;
require("should");
const node_opcua_1 = require("node-opcua");
const node_opcua_leak_detector_1 = require("node-opcua-leak-detector");
const perform_operation_on_client_session_1 = require("../../test_helpers/perform_operation_on_client_session");
/**
 * Issue #804 - Ensure monitoring with TimestampsToReturn.Source produces DataValues with only sourceTimestamp.
 */
function t(test) {
    (0, node_opcua_leak_detector_1.describeWithLeakDetector)("MonitoredItem with TimestampsToReturn.Source (#804)", () => {
        it("monitors with SourceTimestamp only", async () => {
            const client = node_opcua_1.OPCUAClient.create({});
            await (0, perform_operation_on_client_session_1.perform_operation_on_client_session)(client, test.endpointUrl, async (session) => {
                const subscription = node_opcua_1.ClientSubscription.create(session, {
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
                    const nodeId = `ns=2;s=${id}`;
                    const monitoredItem = node_opcua_1.ClientMonitoredItem.create(subscription, { nodeId: (0, node_opcua_1.resolveNodeId)(nodeId), attributeId: node_opcua_1.AttributeIds.Value }, { samplingInterval: 10, discardOldest: true, queueSize: 1 }, node_opcua_1.TimestampsToReturn.Source);
                    monitoredItem.on("changed", (dataValue) => {
                        if (dataValue.sourceTimestamp)
                            sourceTimestampCount++;
                        if (dataValue.serverTimestamp)
                            serverTimestampCount++;
                        notificationCount++;
                    });
                }
                await new Promise((resolve) => subscription.once("started", () => resolve()));
                await new Promise((r) => setTimeout(r, 3000));
                serverTimestampCount.should.eql(0);
                sourceTimestampCount.should.eql(notificationCount);
                await subscription.terminate();
            });
        });
    });
}
//# sourceMappingURL=u_test_e2e_monitored_item_with_timestamp_source_issue#804.js.map