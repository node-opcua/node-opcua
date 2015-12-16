/*global xit,it,describe,before,after,beforeEach,afterEach*/
"use strict";
require("requirish")._(module);
var assert = require("better-assert");
var async = require("async");
var should = require("should");
var sinon = require("sinon");

var opcua = require("index.js");

var OPCUAClient = opcua.OPCUAClient;
var ClientSession = opcua.ClientSession;
var ClientSubscription = opcua.ClientSubscription;
var AttributeIds = opcua.AttributeIds;
var resolveNodeId = opcua.resolveNodeId;
var StatusCodes = opcua.StatusCodes;
var DataType = opcua.DataType;
var TimestampsToReturn = opcua.read_service.TimestampsToReturn;
var MonitoringMode = opcua.subscription_service.MonitoringMode;
var NumericRange = opcua.NumericRange;
var ObjectTypeIds = opcua.ObjectTypeIds;
var constructEventFilter = require("lib/tools/tools_event_filter").constructEventFilter;

var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var perform_operation_on_subscription = require("test/helpers/perform_operation_on_client_session").perform_operation_on_subscription;
var perform_operation_on_monitoredItem = require("test/helpers/perform_operation_on_client_session").perform_operation_on_monitoredItem;


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
                    nodeId: resolveNodeId("Server"),
                    attributeId: AttributeIds.Value // << we set Value here
                });

                var parameters = {
                    samplingInterval: 0,
                    discardOldest: false,
                    queueSize: 1,
                    filter: filter   // we use inadequat EventFilter here !=> server should complain
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

        // check if nodeID exists
        it("ZZ2 should create a monitoredItem on a event with an Event Filter ", function (done) {

            var constructEventFilter = require("lib/tools/tools_event_filter").constructEventFilter;

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
                        console.log("createMonitoredItemsResponse", createMonitoredItemsResponse.toString());

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


                // to DO
            }, done);
        });


        var TimestampsToReturn = opcua.read_service.TimestampsToReturn;

        it("Client: should raise a error if a filter is specified when monitoring some attributes which are not Value or EventNotifier", function (done) {

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
                    should(err).not.eql(null);
                    err.message.should.match(/no filter expected/);
                    console.log(err.message);
                    callback();
                });

            }, done);
        });

        it("Client: should raise a error if filter is not of type EventFilter when monitoring an event", function (done) {

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
                    should(err).not.eql(null);
                    err.message.should.match(/Got a DataChangeFilter but a EventFilter/);
                    console.log(err.message);
                    callback();
                });

            }, done);
        });

        describe("Testing Server generating Event and client receiving Event Notification", function () {


            function callEventGeneratorMethod(callback) {

                // TODO
                callback();

            }

            it("TE1 - should monitored Server Event", function (done) {

                var eventFilter = constructEventFilter(["SourceName", "EventId", "ReceiveTime"]);

                perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {


                    var readValue = {
                        nodeId: resolveNodeId("Server"),
                        attributeId: AttributeIds.EventNotifier // << EventNotifier
                    };
                    var requestedParameters = {
                        samplingInterval: 10,
                        discardOldest: true,
                        queueSize: 1,
                        filter: eventFilter

                    };
                    var monitoredItem = subscription.monitor(readValue, requestedParameters, TimestampsToReturn.Both, function (err) {
                        try {
                            should(err).eql(null);
                        } catch (err) {
                            callback(err);
                        }

                        async.series([
                            callEventGeneratorMethod.bind(null),
                            function (callback) {
                                // TODO
                                callback();
                            }

                        ], callback);
                    });
                    monitoredItem.on("change", function () {
                        // TODO
                        console.log("Changed !!!  ")
                    });


                }, done);

            });
        });

    });

}