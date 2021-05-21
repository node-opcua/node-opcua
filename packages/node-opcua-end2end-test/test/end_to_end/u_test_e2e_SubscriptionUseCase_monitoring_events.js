"use strict";

const async = require("async");
const should = require("should");
const chalk = require("chalk");
const opcua = require("node-opcua");

const OPCUAClient = opcua.OPCUAClient;
const AttributeIds = opcua.AttributeIds;
const resolveNodeId = opcua.resolveNodeId;
const StatusCodes = opcua.StatusCodes;
const MonitoringMode = opcua.MonitoringMode;
const TimestampsToReturn = opcua.TimestampsToReturn;
const constructEventFilter = opcua.constructEventFilter;

const {
    perform_operation_on_subscription_async,
    perform_operation_on_subscription
} = require("../../test_helpers/perform_operation_on_client_session");

module.exports = function (test) {

    describe("Client Subscription with Event monitoring", function () {
        let client;

        beforeEach(function (done) {
            client = OPCUAClient.create();
            done();
        });
        afterEach(function (done) {
            client = null;
            done();
        });

        it("ZZ1 CreateMonitoredItemsRequest: server should not accept en Event filter if node attribute to monitor is not EventNotifier", function (done) {

            const filter = constructEventFilter(["SourceName", "EventId", "ReceiveTime"]);

            perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {

                const itemToMonitor = new opcua.ReadValueId({
                    nodeId: resolveNodeId("Server_ServerStatus"),
                    attributeId: AttributeIds.Value // << we set Value here
                });

                const parameters = {
                    samplingInterval: 0,
                    discardOldest: false,
                    queueSize: 1,
                    filter: filter   // we use an invalid EventFilter here !=> server should complain
                };

                const createMonitoredItemsRequest = new opcua.CreateMonitoredItemsRequest({

                    subscriptionId: subscription.subscriptionId,
                    timestampsToReturn: opcua.TimestampsToReturn.Neither,
                    itemsToCreate: [{
                        itemToMonitor: itemToMonitor,
                        requestedParameters: parameters,
                        monitoringMode: MonitoringMode.Reporting
                    }]
                });

                session.createMonitoredItems(createMonitoredItemsRequest, function (err, createMonitoredItemsResponse) {
                    if (err) {
                        return callback(err);
                    }
                    try {
                        createMonitoredItemsResponse.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                        createMonitoredItemsResponse.results[0].statusCode.should.eql(StatusCodes.BadFilterNotAllowed);
                        should(createMonitoredItemsResponse.results[0].filterResult).eql(null);
                    } catch (err) {
                        return callback(err);
                    }
                    callback();
                });

                // now publish and check that monitored item returns
            }, done);


        });

        xit("should only accept event monitoring on ObjectNode that have the SubscribeToEventBit set", function (done) {

            // Part 3:
            // Objects and views can be used to monitor Events. Events are only available from Nodes where the
            // SubscribeToEvents bit (bit 0) of the EventNotifier Attribute is set.

            // todo: check that
            done();
        });

        // check if nodeID exists
        it("ZY2 should create a monitoredItem on a event without an Event Filter ", function (done) {

            perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {

                const itemToMonitor = new opcua.ReadValueId({
                    nodeId: resolveNodeId("Server"),
                    attributeId: AttributeIds.EventNotifier
                });

                const parameters = {
                    samplingInterval: 0,
                    discardOldest: false,
                    queueSize: 1,
                    filter: null
                };

                const createMonitoredItemsRequest = new opcua.CreateMonitoredItemsRequest({
                    subscriptionId: subscription.subscriptionId,
                    timestampsToReturn: opcua.TimestampsToReturn.Neither,
                    itemsToCreate: [{
                        itemToMonitor: itemToMonitor,
                        requestedParameters: parameters,
                        monitoringMode: MonitoringMode.Reporting
                    }]
                });

                session.createMonitoredItems(createMonitoredItemsRequest, function (err, createMonitoredItemsResponse) {
                    if (err) {
                        return callback(err);
                    }
                    try {
                        //xx console.log("createMonitoredItemsResponse", createMonitoredItemsResponse.toString());

                        createMonitoredItemsResponse.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                        createMonitoredItemsResponse.results[0].statusCode.should.eql(StatusCodes.Good);

                        should(createMonitoredItemsResponse.results[0].filterResult).eql(null, "a filter result is non expected");

                    } catch (err) {
                        return callback(err);
                    }
                    callback();
                });

                // now publish and check that monitored item returns EventNotification


                // toDO
            }, done);
        });

        // check if nodeID exists
        it("ZZ2 should create a monitoredItem on a event with an Event Filter ", function (done) {

            const constructEventFilter = require("node-opcua-service-filter").constructEventFilter;

            const eventFilter = constructEventFilter(["SourceName", "EventId", "ReceiveTime"]);

            //xx console.log("filter = ",filter.toString());

            perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {

                const itemToMonitor = new opcua.ReadValueId({
                    nodeId: resolveNodeId("Server"),
                    attributeId: AttributeIds.EventNotifier
                });

                const parameters = {
                    samplingInterval: 0,
                    discardOldest: false,
                    queueSize: 1,
                    filter: eventFilter
                };

                const createMonitoredItemsRequest = new opcua.CreateMonitoredItemsRequest({
                    subscriptionId: subscription.subscriptionId,
                    timestampsToReturn: opcua.TimestampsToReturn.Neither,
                    itemsToCreate: [{
                        itemToMonitor: itemToMonitor,
                        requestedParameters: parameters,
                        monitoringMode: MonitoringMode.Reporting
                    }]
                });

                session.createMonitoredItems(createMonitoredItemsRequest, function (err, createMonitoredItemsResponse) {
                    if (err) {
                        return callback(err);
                    }
                    try {
                        //xx console.log("createMonitoredItemsResponse", createMonitoredItemsResponse.toString());

                        createMonitoredItemsResponse.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                        createMonitoredItemsResponse.results[0].statusCode.should.eql(StatusCodes.Good);

                        should(createMonitoredItemsResponse.results[0].filterResult).not.eql(null, "a filter result is requested");


                        const filterResult = createMonitoredItemsResponse.results[0].filterResult;
                        filterResult.should.be.instanceof(opcua.EventFilterResult);

                        // verify selectClauseResults count
                        eventFilter.selectClauses.length.should.eql(3);
                        filterResult.selectClauseResults.length.should.eql(eventFilter.selectClauses.length);
                        filterResult.selectClauseResults[0].should.eql(StatusCodes.Good);
                        filterResult.selectClauseResults[1].should.eql(StatusCodes.Good);
                        filterResult.selectClauseResults[2].should.eql(StatusCodes.Good);

                        // verify whereClauseResult
                        const ContentFilterResult = opcua.ContentFilterResult;
                        filterResult.whereClauseResult.should.be.instanceof(ContentFilterResult);

                    } catch (err) {
                        return callback(err);
                    }
                    callback();
                });

                // now publish and check that monitored item returns EventNotification


                // toDO
            }, done);
        });

        it("ZZ2B should modify parameters of a monitoredItem on a event (Modify Event)", function (done) {

            // this test should verify that server deals appropriately if a sampling interval is provided
            // ( event don't use sampling interval)

            const constructEventFilter = require("node-opcua-service-filter").constructEventFilter;

            const eventFilter = constructEventFilter(["SourceName", "EventId", "ReceiveTime"]);

            //xx console.log("filter = ",filter.toString());

            perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, outer_callback) {

                const itemToMonitor = new opcua.ReadValueId({
                    nodeId: resolveNodeId("Server"),
                    attributeId: AttributeIds.EventNotifier
                });

                const parameters = {
                    samplingInterval: 0,
                    discardOldest: false,
                    queueSize: 1,
                    filter: eventFilter
                };

                const createMonitoredItemsRequest = new opcua.CreateMonitoredItemsRequest({
                    subscriptionId: subscription.subscriptionId,
                    timestampsToReturn: opcua.TimestampsToReturn.Neither,
                    itemsToCreate: [{
                        itemToMonitor: itemToMonitor,
                        requestedParameters: parameters,
                        monitoringMode: MonitoringMode.Reporting
                    }]
                });

                let monitoredItemId = 0;
                async.series([


                    function create_monitored_item(callback) {
                        session.createMonitoredItems(createMonitoredItemsRequest, function (err, createMonitoredItemsResponse) {
                            if (err) {
                                return callback(err);
                            }
                            //xx console.log("createMonitoredItemsResponse", createMonitoredItemsResponse.toString());

                            monitoredItemId = createMonitoredItemsResponse.results[0].monitoredItemId;

                            //xx console.log(createMonitoredItemsResponse.results[0].toString());

                            should(createMonitoredItemsResponse.results[0].filterResult).not.eql(null, "a filter result is requested");

                            callback();
                        });

                    },
                    function modify_monitored_item(callback) {
                        // now publish and check that monitored item returns EventNotification
                        const modifyMonitoredItemsRequest = new opcua.ModifyMonitoredItemsRequest({
                            subscriptionId: subscription.subscriptionId,
                            timestampsToReturn: opcua.TimestampsToReturn.Neither,
                            itemsToModify: [
                                new opcua.MonitoredItemModifyRequest({
                                    monitoredItemId: monitoredItemId,
                                    requestedParameters: {
                                        samplingInterval: 1000
                                    }
                                })
                            ]
                        });
                        session.modifyMonitoredItems(modifyMonitoredItemsRequest, function (err, modifyMonitoredItemsResponse) {
                            modifyMonitoredItemsResponse.responseHeader.serviceResult.should.eql(StatusCodes.Good);

                            callback();
                        });

                    }

                ], outer_callback);


                // toDO
            }, done);
        });

        it("ZZ3 Client: should raise a error if a filter is specified when monitoring some attributes which are not Value or EventNotifier", function (done) {

            perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {

                const readValue = {
                    nodeId: resolveNodeId("Server"),
                    attributeId: AttributeIds.BrowseName // << NOT (Value or EventNotifier)
                };
                const requestedParameters = {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1,

                    filter: new opcua.DataChangeFilter({}) // FILTER !
                };
                subscription.monitor(readValue, requestedParameters, TimestampsToReturn.Both, function (err) {
                    should.exist(err);
                    err.message.should.match(/no filter expected/);
                    //xx console.log(err.message);
                    callback();
                });

            }, done);
        });

        it("ZZ4 Client: should raise a error if filter is not of type EventFilter when monitoring an event", function (done) {

            perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {

                const readValue = {
                    nodeId: resolveNodeId("Server"),
                    attributeId: AttributeIds.EventNotifier // << EventNotifier
                };
                const requestedParameters = {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1,

                    filter: new opcua.DataChangeFilter({}) // intentionally wrong :not an EventFilter

                };
                subscription.monitor(readValue, requestedParameters, TimestampsToReturn.Both, function (err) {
                    should.exist(err);
                    err.message.should.match(/Got a DataChangeFilter but a EventFilter/);
                    console.log(err.message);
                    callback();
                });

            }, done);
        });

        describe("ZZA-1 Testing Server generating Event and client receiving Event Notification", function () {


            async function callEventGeneratorMethod(session) {

                const eventGeneratorObject = test.server.engine.addressSpace.rootFolder.objects.simulation.eventGeneratorObject;
                should.exist(eventGeneratorObject);
                console.log(eventGeneratorObject.browseName.toString());

                const methodsToCall = [{
                    objectId: eventGeneratorObject.nodeId,
                    methodId: eventGeneratorObject.eventGeneratorMethod.nodeId.toString(),
                    inputArguments: [
                        { dataType: opcua.DataType.String, value: "Hello From Here" },
                        { dataType: opcua.DataType.UInt32, value: 50 }
                    ]
                }];

                const response = await session.call(methodsToCall);

            }

            function w(str, l) {
                return (str + "                                      ").substr(0, l);
            }
            it("TE1 - should monitored Server Event", async () => {

                const fields = ["EventType", "SourceName", "EventId", "ReceiveTime", "Severity", "Message"];
                const eventFilter = constructEventFilter(fields);

                await perform_operation_on_subscription_async(client, test.endpointUrl, async (session, subscription) => {


                    let eventNotificationCount = 0;

                    async function createOtherMonitorItem() {
                        const itemToMonitor = {
                            nodeId: resolveNodeId(opcua.VariableIds.Server_ServerStatus_CurrentTime),
                            attributeId: AttributeIds.Value
                        };
                        const monitoringParameters = {
                            samplingInterval: 1000,
                            queueSize: 100
                        };
                        const monitoredItem2 = await subscription.monitor(itemToMonitor, monitoringParameters, TimestampsToReturn.Both);
                    }

                    await createOtherMonitorItem();
                
                    const readValue = {
                        nodeId: resolveNodeId("Server"),
                        attributeId: AttributeIds.EventNotifier // << EventNotifier
                    };
                    const requestedParameters = {
                        samplingInterval: 50,
                        discardOldest: true,
                        queueSize: 10,
                        filter: eventFilter
                    };

                    const monitoredItem = await subscription.monitor(readValue, requestedParameters, TimestampsToReturn.Both);

                    monitoredItem.on("changed", (eventFields) => {
                        eventNotificationCount += 1;
                        // istanbul ignore next
                        if (true) {
                            console.log("Changed !!!  ");
                            eventFields.forEach(function (variant, index) {
                                console.log(chalk.yellow(w(fields[index], 15)), chalk.cyan(variant.toString()));
                            });
                        }
                    });

                    // make server generate an event
                    await callEventGeneratorMethod(session);

                    await new Promise((resolve) => setTimeout(resolve, 1000));

                    eventNotificationCount.should.eql(1, " Should have received one event notification");
                });
            });


        });
    });
};
