"use strict";

const should = require("should");

const {
    OPCUAClient,
    ClientSession,
    VariableIds,
    makeNodeId,
    ClientSubscription,
    resolveNodeId,
    AttributeIds,
    Variant,
    DataType,
    TimestampsToReturn
} = require("node-opcua");

const { wait_until_condition, wait } = require("../../test_helpers/utils");

// bug : server reported to many datavalue changed when client monitored a UAVariable consructed with variation 1");
// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function (test) {
    describe("Testing bug #119 - Verify that monitored item only reports expected value change notifications :", function () {
        let client, endpointUrl;

        beforeEach(function (done) {
            client = OPCUAClient.create({
                keepSessionAlive: true,
                requestedSessionTimeout: 40 * 60 * 1000
            });
            endpointUrl = test.endpointUrl;
            done();
        });

        afterEach(function (done) {
            client.disconnect(done);
            client = null;
        });

        it("monitoring variables shall only reports real value changes : fixing bug #119", async () => {
            await client.withSessionAsync(endpointUrl, async function (session) {
                const requestedPublishingInterval = 150;
                const subscription = await session.createSubscription2({
                    requestedPublishingInterval,
                    requestedLifetimeCount: 6000, // make sure subscription will not timeout
                    requestedMaxKeepAliveCount: 100, // make sure we won't received spurious KeepAlive PublishResponse
                    maxNotificationsPerPublish: 20,
                    publishingEnabled: true,
                    priority: 6
                });

                const nodeId = makeNodeId(VariableIds.Server_ServerStatus_BuildInfo_ProductName); // "ns=0;i=2261";

                const samplingInterval = 10;
                const monitoredItem = await subscription.monitor(
                    { nodeId: resolveNodeId(nodeId), attributeId: AttributeIds.Value },
                    { samplingInterval, discardOldest: true, queueSize: 1 },
                    TimestampsToReturn.Both
                );

                let change_count = 0;
                monitoredItem.on("changed", function (dataValue) {
                    should.exist(dataValue);
                    change_count += 1;
                });

                // first "changed" must happen almost immediately
                await wait_until_condition(() => change_count === 1, 2000);
                await wait(500);
                change_count.should.eql(1);

                const node = test.server.engine.addressSpace.findNode(nodeId);
                should.exist(node);

                //  change server productName ( from the server side)
                test.server.engine.serverStatus.buildInfo.productName += "Modified";

                // check that the change has been identified, but reported only once !
                await wait_until_condition(() => change_count === 2, 5000);
                await wait(requestedPublishingInterval * 2);

                change_count.should.eql(2);
                await subscription.terminate();
            });
        });

        it(
            "a server that have a fast sampling rate shall not report 'value changes' on monitored " +
                "item faster than the sampling rate imposed by the client",
            async () => {
                await client.withSessionAsync(endpointUrl, async function (session) {
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

                    const v = test.server.engine.addressSpace.findNode(nodeId);
                    v.setValueFromSource(new Variant({ dataType: DataType.Double, value: count }));

                    // change the underlying value at a very fast rate (every 20ms)
                    const timerId = setInterval(function () {
                        count += 1;
                        v.setValueFromSource(new Variant({ dataType: DataType.Double, value: count }));
                    }, 20); // high rate !!!

                    const monitoredItem = await subscription.monitor(
                        { nodeId: resolveNodeId(nodeId), attributeId: AttributeIds.Value },
                        {
                            samplingInterval: 500, // slow rate  (slower than publishing rate)
                            discardOldest: true,
                            queueSize: 10
                        },
                        TimestampsToReturn.Both
                    );

                    let change_count = 0;
                    monitoredItem.on("changed", function (dataValue) {
                        should.exist(dataValue);
                        //xx console.log(" data Value = ",dataValue.value.toString());
                        change_count += 1;
                    });

                    await wait_until_condition(() => change_count >= 1 && change_count <= 2, 1500);
                    await wait_until_condition(() => change_count >= 2 && change_count <= 4, 1500);
                    await wait_until_condition(() => change_count >= 4 && change_count <= 6, 2000);

                    count.should.be.greaterThan(50);

                    clearInterval(timerId);
                    await subscription.terminate();
                });
            }
        );
    });
};
