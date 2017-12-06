/* global xit,it,describe,beforeEach,afterEach*/
"use strict";

var async = require("async");
var should = require("should");

var opcua = require("node-opcua");

var OPCUAClient = opcua.OPCUAClient;
var AttributeIds = opcua.AttributeIds;
var resolveNodeId = opcua.resolveNodeId;
var StatusCodes = opcua.StatusCodes;
var MonitoringMode = opcua.subscription_service.MonitoringMode;
var TimestampsToReturn = opcua.read_service.TimestampsToReturn;
var constructEventFilter = opcua.constructEventFilter;

var perform_operation_on_subscription = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_subscription;

module.exports = function (test) {

    describe("Client Subscription with Event monitoring", function () {
        var client;

        beforeEach(function (done) {
            client = new OPCUAClient();
            done();
        });
        afterEach(function (done) {
            client = null;
            done();
        });

        it("ZZ1 CreateMonitoredItemsRequest: server should not accept en Event filter if node attribute to monitor is not EventNotifier", function (done) {

            var filter = constructEventFilter(["SourceName", "EventId", "ReceiveTime"]);

            perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {

                var itemToMonitor = new opcua.read_service.ReadValueId({
                    nodeId: resolveNodeId("Server_ServerStatus"),
                    attributeId: AttributeIds.Value // << we set Value here
                });

                var parameters = {
                    samplingInterval: 0,
                    discardOldest: false,
                    queueSize: 1,
                    filter: filter   // we use an invalid EventFilter here !=> server should complain
                };

                var createMonitoredItemsRequest = new opcua.subscription_service.CreateMonitoredItemsRequest({

                    subscriptionId: subscription.subscriptionId,
                    timestampsToReturn: opcua.read_service.TimestampsToReturn.Neither,
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
                    }
                    catch (err) {
                        return callback(err);
                    }
                    callback();
                });

                // now publish and check that monitored item returns
            }, done);


        });

        xit("should only accept event monitoring on ObjectNode that have the SubscribeToEventBit set",function(done) {

            // Part 3:
            // Objects and views can be used to monitor Events. Events are only available from Nodes where the
            // SubscribeToEvents bit of the EventNotifier Attribute is set.

            // todo: check that
            done();
        });

        // check if nodeID exists
        it("ZY2 should create a monitoredItem on a event without an Event Filter ", function (done) {

            perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {

                var itemToMonitor = new opcua.read_service.ReadValueId({
                    nodeId: resolveNodeId("Server"),
                    attributeId: AttributeIds.EventNotifier
                });

                var parameters = {
                    samplingInterval: 0,
                    discardOldest: false,
                    queueSize: 1,
                    filter: null
                };

                var createMonitoredItemsRequest = new opcua.subscription_service.CreateMonitoredItemsRequest({
                    subscriptionId: subscription.subscriptionId,
                    timestampsToReturn: opcua.read_service.TimestampsToReturn.Neither,
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

                    }
                    catch (err) {
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

            var constructEventFilter = require("node-opcua-service-filter").constructEventFilter;

            var eventFilter = constructEventFilter(["SourceName", "EventId", "ReceiveTime"]);

            //xx console.log("filter = ",filter.toString());

            perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {

                var itemToMonitor = new opcua.read_service.ReadValueId({
                    nodeId: resolveNodeId("Server"),
                    attributeId: AttributeIds.EventNotifier
                });

                var parameters = {
                    samplingInterval: 0,
                    discardOldest: false,
                    queueSize: 1,
                    filter: eventFilter
                };

                var createMonitoredItemsRequest = new opcua.subscription_service.CreateMonitoredItemsRequest({
                    subscriptionId: subscription.subscriptionId,
                    timestampsToReturn: opcua.read_service.TimestampsToReturn.Neither,
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


                        var filterResult = createMonitoredItemsResponse.results[0].filterResult;
                        filterResult.should.be.instanceof(opcua.subscription_service.EventFilterResult);

                        // verify selectClauseResults count
                        eventFilter.selectClauses.length.should.eql(3);
                        filterResult.selectClauseResults.length.should.eql(eventFilter.selectClauses.length);
                        filterResult.selectClauseResults[0].should.eql(StatusCodes.Good);
                        filterResult.selectClauseResults[1].should.eql(StatusCodes.Good);
                        filterResult.selectClauseResults[2].should.eql(StatusCodes.Good);

                        // verify whereClauseResult
                        var ContentFilterResult = opcua.subscription_service.ContentFilterResult;
                        filterResult.whereClauseResult.should.be.instanceof(ContentFilterResult);

                    }
                    catch (err) {
                        return callback(err);
                    }
                    callback();
                });

                // now publish and check that monitored item returns EventNotification


                // toDO
            }, done);
        });

        it("ZZ3 Client: should raise a error if a filter is specified when monitoring some attributes which are not Value or EventNotifier", function (done) {

            perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {

                var readValue = {
                    nodeId: resolveNodeId("Server"),
                    attributeId: AttributeIds.BrowseName // << NOT (Value or EventNotifier)
                };
                var requestedParameters = {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1,

                    filter: new opcua.subscription_service.DataChangeFilter({}) // FILTER !
                };
                var monitoredItem = subscription.monitor(readValue, requestedParameters, TimestampsToReturn.Both, function (err) {
                    should.exist(err);
                    err.message.should.match(/no filter expected/);
                    //xx console.log(err.message);
                    callback();
                });

            }, done);
        });

        it("ZZ4 Client: should raise a error if filter is not of type EventFilter when monitoring an event", function (done) {

            perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {

                var readValue = {
                    nodeId: resolveNodeId("Server"),
                    attributeId: AttributeIds.EventNotifier // << EventNotifier
                };
                var requestedParameters = {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1,

                    filter: new opcua.subscription_service.DataChangeFilter({}) // intentionally wrong :not an EventFilter

                };
                var monitoredItem = subscription.monitor(readValue, requestedParameters, TimestampsToReturn.Both, function (err) {
                    should.exist(err);
                    err.message.should.match(/Got a DataChangeFilter but a EventFilter/);
                    console.log(err.message);
                    callback();
                });

            }, done);
        });

        describe("ZZA- Testing Server generating Event and client receiving Event Notification", function () {


            function callEventGeneratorMethod(session,callback) {

                var eventGeneratorObject = test.server.engine.addressSpace.rootFolder.objects.simulation.eventGeneratorObject;

                var methodsToCall = [{
                    objectId: eventGeneratorObject.nodeId,
                    methodId: eventGeneratorObject.eventGeneratorMethod.nodeId.toString(),
                    inputArguments: [
                        { dataType: opcua.DataType.String, value:  "Hello From Here" },
                        { dataType: opcua.DataType.UInt32, value: 50 },
                    ]
                }];

                session.call(methodsToCall,function(err,response){
                    //xx console.log("call response = ",response.toString());
                    response[0].statusCode.should.eql(opcua.StatusCodes.Good);
                    callback(err);
                });

            }

            it("TE1 - should monitored Server Event", function (done) {

                var fields = ["EventType","SourceName", "EventId", "ReceiveTime","Severity","Message"];
                var eventFilter = constructEventFilter(fields);

                perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, inner_callback) {


                    var eventNotificationCount = 0;

                    async.series([

                        function (callback) {
                            var monitoredItem2 = subscription.monitor({
                                nodeId: resolveNodeId(opcua.VariableIds.Server_ServerStatus_CurrentTime),
                                attributeId: AttributeIds.Value
                            },{
                                samplingInterval: 1000,
                                queueSize: 100,
                            },TimestampsToReturn.Both, function(){

                            });
                            monitoredItem2.on("changed", function(dataValue){
                                //xxx console.log(" Server Time is ",dataValue.toString())
                            });
                            callback();
                        },

                        function (callback) {

                            var readValue = {
                                nodeId: resolveNodeId("Server"),
                                attributeId: AttributeIds.EventNotifier // << EventNotifier
                            };
                            var requestedParameters = {
                                samplingInterval: 50,
                                discardOldest: true,
                                queueSize:     10,
                                filter: eventFilter
                            };

                            var monitoredItem = subscription.monitor(readValue, requestedParameters, TimestampsToReturn.Both, function (err) {
                                try {
                                    should(err).eql(null);
                                } catch (err) {
                                    callback(err);
                                }

                                callback();
                            });

                            function w(str,l) {
                                return (str + "                                      ").substr(0,l);
                            }
                            monitoredItem.on("changed", function (eventFields) {
                                // TODO
                                eventNotificationCount = eventNotificationCount + 1;

                                // istanbul ignore next
                                if (false) {
                                    console.log("Changed !!!  ");
                                    eventFields.forEach(function(variant,index) {
                                        console.log(w(fields[index],15).yellow,variant.toString().cyan);
                                    })
                                }
                            });
                        },

                        // make server generate an event
                        callEventGeneratorMethod.bind(null,session),

                        function (callback) {
                            setTimeout(callback,1000);
                        },
                        function (callback) {
                            eventNotificationCount.should.eql(1," Should have received one event notification");
                            callback();
                        }

                    ], inner_callback);

                }, done);

            });
        });

    });

};
