"use strict";

const { OPCUAClient, AttributeIds, DataValue, makeBrowsePath, StatusCodes, TimestampsToReturn } = require("node-opcua");

const { make_debugLog } = require("node-opcua-debug");
const debugLog = make_debugLog("TEST");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function (test) {
    describe("Testing #135 - a server should expose currentMonitoredItemsCount", function () {
        it("should expose currentMonitoredItemsCount", async () => {
            const server = test.server;

            const refreshRate = 500;

            let counter = 1;
            const slowVar = server.engine.addressSpace.getOwnNamespace().addVariable({
                organizedBy: server.engine.addressSpace.rootFolder.objects,
                browseName: "SlowVariable",
                dataType: "UInt32",
                value: {
                    refreshFunc: function (callback) {
                        // simulate a asynchronous behaviour
                        setTimeout(() => {
                            counter += 1;
                            callback(null, new DataValue({ value: { dataType: "UInt32", value: counter } }));
                        }, refreshRate);
                    }
                }
            });

            const endpointUrl = test.endpointUrl;

            const client = OPCUAClient.create({
                clientName: "SomeFancyClientName",
                requestedSessionTimeout: 60000
            });
            await client.connect(endpointUrl);

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

            const nodesToMonitor = [slowVar.nodeId, "i=2254"];

            const monitoredItems = [];
            for (const nodeId of nodesToMonitor) {
                const monitoredItem = await subscription.monitor(
                    { nodeId: nodeId, attributeId: AttributeIds.Value },
                    {
                        samplingInterval: refreshRate / 2, // sampling twice as fast as variable refresh rate
                        discardOldest: true,
                        queueSize: 100
                    },
                    TimestampsToReturn.Both
                );

                monitoredItems.push(monitoredItem);
            }

            const sessionId = session.sessionId;
            debugLog("session nodeId = ", sessionId.toString());

            const browsePath = [
                makeBrowsePath(sessionId, ".SessionDiagnostics.CurrentMonitoredItemsCount"),
                makeBrowsePath(sessionId, ".SessionDiagnostics.CurrentSubscriptionsCount"),
                makeBrowsePath(sessionId, ".SessionDiagnostics")
            ];

            const browsePathResults = await session.translateBrowsePath(browsePath);
            // debugLog(" browsePathResults",browsePathResults[0].toString());
            browsePathResults[0].statusCode.should.eql(StatusCodes.Good);
            browsePathResults[1].statusCode.should.eql(StatusCodes.Good);
            browsePathResults[2].statusCode.should.eql(StatusCodes.Good);

            const nodesToRead = [];
            nodesToRead.push({
                nodeId: browsePathResults[0].targets[0].targetId,
                attributeId: AttributeIds.Value
            });

            nodesToRead.push({
                nodeId: browsePathResults[1].targets[0].targetId,
                attributeId: AttributeIds.Value
            });
            nodesToRead.push({
                nodeId: browsePathResults[2].targets[0].targetId,
                attributeId: AttributeIds.Value
            });

            const dataValues = await session.read(nodesToRead);
            //xx debugLog(chalk.bgWhite.red("-----------------------------------------------"),err);
            //xx debugLog("results = ",results);
            dataValues.length.should.eql(3);
            const currentMonitoredItemsCount = dataValues[0].value.value;
            const currentSubscriptionsCount = dataValues[1].value.value;

            debugLog("CurrentMonitoredItemsCount = ", currentMonitoredItemsCount);
            debugLog("currentSubscriptionsCount   = ", currentSubscriptionsCount);

            currentSubscriptionsCount.should.eql(1, "expecting one subscription ");
            currentMonitoredItemsCount.should.eql(2);

            dataValues[2].value.value.constructor.name.should.eql("SessionDiagnosticsDataType");
            dataValues[2].value.value.sessionName.toString().should.eql("SomeFancyClientName1");

            debugLog("diagnostic = ", dataValues[2].value.toString());

            await subscription.terminate();
            await session.close();
            await client.disconnect();
        });
    });
};
