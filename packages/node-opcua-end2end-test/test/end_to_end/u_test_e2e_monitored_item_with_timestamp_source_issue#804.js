
"use strict";

const should = require("should");
const sinon = require("sinon");
const {
    TimestampsToReturn,
    OPCUAClient,
    ClientSubscription,
    ClientMonitoredItem,
    AttributeIds,
    ClientSession,
    resolveNodeId,
} = require("node-opcua");

const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function(test) {

    describe("Testing MonitoredItem with TimestampToReturn.Source #804", function() {

        let client, endpointUrl;

        beforeEach(function(done) {
            if (process.gc) { process.gc(); }
            client = OPCUAClient.create();
            endpointUrl = test.endpointUrl;
            done();
        });

        afterEach(function(done) {
            client.disconnect(done);
            client = null;
        });

        it("should monitor with SourceTimestamp (see #804)", function(done) {

            perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

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
                ids.forEach(function(id) {
                    const nodeId = "ns=2;s=" + id;

                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        { nodeId: resolveNodeId(nodeId), attributeId: AttributeIds.Value },
                        { samplingInterval: 10, discardOldest: true, queueSize: 1 },
                        TimestampsToReturn.Source);

                    monitoredItem.on("changed", (dataValue) => {
                        // console.log(dataValue.toString());
                        if (dataValue.sourceTimestamp) {
                            sourceTimestampCount++;
                        }
                        if (dataValue.serverTimestamp) {
                            serverTimestampCount++;
                        }
                        notificationCount++;
                    });
                });

                subscription.once("started", function(subscriptionId) {
                    setTimeout(() => {
                        serverTimestampCount.should.eql(0);
                        sourceTimestampCount.should.eql(notificationCount);
                        subscription.terminate(inner_done);
                    }, 3000);

                });
            }, done);
        });
    });
};