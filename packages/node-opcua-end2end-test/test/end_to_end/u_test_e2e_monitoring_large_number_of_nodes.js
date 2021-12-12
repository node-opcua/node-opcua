"use strict";

const sinon = require("sinon");

const {
    OPCUAClient,
    ClientSubscription,
    AttributeIds,
    resolveNodeId,
    MonitoringParameters,
    MonitoringMode,
    ReadValueId,
    TimestampsToReturn,
    CreateMonitoredItemsRequest,
    ClientMonitoredItem,
    DataType,
    coerceNodeId
} = require("node-opcua");

const {
    perform_operation_on_client_session
} = require("../../test_helpers/perform_operation_on_client_session");

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
module.exports = function (test) {
    describe("Testing client with many monitored items", function () {
        let client, endpointUrl;

        beforeEach(function (done) {
            if (process.gc) {
                process.gc();
            }
            client = OPCUAClient.create();
            endpointUrl = test.endpointUrl;

            if (false) {
                console.log("client.tokenRenewalInterval = ", client.tokenRenewalInterval);
            }
            client.on("lifetime_75", () => console.log("token about to expire"));
            if (false) {
                client.on("send_chunk", (buf) => console.log("chunk =>", buf.length));
                client.on("receive_chunk", (buf) => console.log("chunk <= ", buf.length));
            }
            done();
        });

        afterEach(function (done) {
            client.disconnect(done);
            client = null;
        });

        it("should monitor a large number of node (see #69)", function (done) {
            const changeByNodes = {};

            function make_callback(_nodeId) {
                const nodeId = _nodeId;
                return function () {
                    //Xx console.log(nodeId.toString() , "\t value : ",dataValue.value.value.toString());
                    const idx = nodeId.toString();
                    changeByNodes[idx] = changeByNodes[idx] ? changeByNodes[idx] + 1 : 1;
                };
            }

            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    const subscription = ClientSubscription.create(session, {
                        requestedPublishingInterval: 150,
                        requestedLifetimeCount: 10 * 60 * 10,
                        requestedMaxKeepAliveCount: 10,
                        maxNotificationsPerPublish: 20000,
                        publishingEnabled: true,
                        priority: 6
                    });


                    const ids = [
                        "Scalar_Simulation_Double",
                        "Scalar_Simulation_Boolean",
                        "Scalar_Simulation_String",
                        "Scalar_Simulation_Int64",
                        "Scalar_Simulation_LocalizedText"
                    ];
                    ids.forEach(function (id) {
                        const nodeId = "ns=2;s=" + id;

                        const monitoredItem = ClientMonitoredItem.create(
                            subscription,
                            { nodeId: resolveNodeId(nodeId), attributeId: AttributeIds.Value },
                            { samplingInterval: 10, discardOldest: true, queueSize: 1 }
                        );

                        monitoredItem.on("changed", make_callback(nodeId));
                    });

                    subscription.once("started", function () {
                        setTimeout(() => {
                            subscription.terminate(inner_done);
                            Object.keys(changeByNodes).length.should.eql(ids.length);
                        }, 3000);
                    });
                },
                done
            );
        });

        const ids = [
            "Scalar_Simulation_Double",
            "Scalar_Simulation_Float",
            "Scalar_Simulation_Boolean",
            "Scalar_Simulation_String",
            "Scalar_Simulation_Int64",
            "Scalar_Simulation_Int32",
            "Scalar_Simulation_Int16",
            "Scalar_Simulation_SByte",
            "Scalar_Simulation_UInt64",
            "Scalar_Simulation_UInt32",
            "Scalar_Simulation_UInt16",
            "Scalar_Simulation_Byte",
            "Scalar_Simulation_LocalizedText",
            "Scalar_Simulation_ByteString",
            "Scalar_Simulation_DateTime",
            "Scalar_Simulation_Duration"
        ];

        let ids50000 = ids;
        while (ids50000.length < 5000 + ids.length) {
            ids50000 = ids50000.concat(ids);
        }

        function make5000Items() {
            const itemsToCreate = [];

            let clientHandle = 1;

            ids50000.forEach(function (s) {
                const nodeId = "ns=2;s=" + s;
                const itemToMonitor = new ReadValueId({
                    attributeId: AttributeIds.Value,
                    nodeId: nodeId
                });
                const monitoringMode = MonitoringMode.Reporting;
                clientHandle++;

                const monitoringParameters = new MonitoringParameters({
                    clientHandle: clientHandle,
                    samplingInterval: 100,
                    filter: null,
                    queueSize: 1,
                    discardOldest: true
                });

                const itemToCreate = {
                    itemToMonitor: itemToMonitor,
                    monitoringMode: monitoringMode,
                    requestedParameters: monitoringParameters
                };
                itemsToCreate.push(itemToCreate);
            });
            return itemsToCreate;
        }
        it("should monitor a very large number of nodes (5000) ", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    const subscription = ClientSubscription.create(session, {
                        requestedPublishingInterval: 10,
                        requestedLifetimeCount: 10 * 60 * 10,
                        requestedMaxKeepAliveCount: 3,
                        maxNotificationsPerPublish: 0, // unlimited
                        publishingEnabled: true,
                        priority: 6
                    });

                    const notificationMessageSpy = new sinon.spy();

                    subscription.on("raw_notification", notificationMessageSpy);

                    subscription.once("started", () => {
                        const timestampsToReturn = TimestampsToReturn.Neither;

                        const itemsToCreate = make5000Items();
                        const createMonitorItemsRequest = new CreateMonitoredItemsRequest({
                            subscriptionId: subscription.subscriptionId,
                            timestampsToReturn: timestampsToReturn,
                            itemsToCreate: itemsToCreate
                        });

                        //xx console.log(createMonitorItemsRequest.toString());
                        session.createMonitoredItems(createMonitorItemsRequest, function (err) {
                            if (err) {
                                subscription.terminate(inner_done);
                                return;
                            }
                            subscription.once("raw_notification", function (n) {
                                subscription.terminate(inner_done);
                                n.notificationData[0].monitoredItems.length.should.eql(
                                    Math.min(subscription.maxNotificationsPerPublish, itemsToCreate.length)
                                );
                            });
                        });
                    });
                },
                done
            );
        });
        it("should fix issue#1008", async () => {
            const parameters = {
                requestedPublishingInterval: 100,
                requestedLifetimeCount: 10,
                requestedMaxKeepAliveCount: 10,
                maxNotificationsPerPublish: 6000,
                publishingEnabled: true,
                priority: 10
            };
            await client.withSubscriptionAsync(endpointUrl, parameters, async (session, subscription) => {
                const timestampsToReturn = TimestampsToReturn.Neither;

                const itemsToCreate = make5000Items().slice(0,40);

                console.log("itemsToCreate = ", itemsToCreate.length);
                console.log("subscription.subscriptionId = ", subscription.subscriptionId);

                const requesterParameters /* : MonitoringParametersOptions  */ = {
                    discardOldest: true,
                    queueSize: 100,
                    samplingInterval: 10,
                    filter: null,

                };

                //xx console.log(createMonitorItemsRequest.toString());

                await new Promise((resolve) => setTimeout(resolve, 1000));

                const objectId = coerceNodeId("ns=0;i=2253"); // SERVER
                const methodId = coerceNodeId("ns=0;i=11492"); // GetMonitoredItems
                const inputArguments = [{ dataType: DataType.UInt32, value: subscription.subscriptionId }];
                const methodToCall = {
                    objectId,
                    methodId,
                    inputArguments
                };
                const result = await session.call(methodToCall);
                console.log(result.toString());
            });
        });
    });
};
