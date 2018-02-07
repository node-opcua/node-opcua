/*global xit,it,describe,before,after,beforeEach,afterEach,require*/
"use strict";

var assert = require("node-opcua-assert");
var should = require("should");
var sinon = require("sinon");

var opcua = require("node-opcua");
var OPCUAClient        = opcua.OPCUAClient;
var ClientSession      = opcua.ClientSession;
var ClientSubscription = opcua.ClientSubscription;
var AttributeIds       = opcua.AttributeIds;
var resolveNodeId      = opcua.resolveNodeId;

var perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

module.exports = function (test) {
    describe("Testing client with many monitored items", function () {

        var client, endpointUrl;

        beforeEach(function (done) {
            client = new OPCUAClient();
            endpointUrl = test.endpointUrl;
            done();
        });

        afterEach(function (done) {
            client.disconnect(done);
            client = null;
        });

        it("should monitor a large number of node (see #69)", function (done) {


            var changeByNodes = {};

            function make_callback(_nodeId) {

                var nodeId = _nodeId;
                return function (dataValue) {
                    //Xx console.log(nodeId.toString() , "\t value : ",dataValue.value.value.toString());
                    var idx = nodeId.toString();
                    changeByNodes[idx] = changeByNodes[idx] ? changeByNodes[idx] + 1 : 1;
                };
            }

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                assert(session instanceof ClientSession);

                var subscription = new ClientSubscription(session, {
                    requestedPublishingInterval: 150,
                    requestedLifetimeCount: 10 * 60 * 10,
                    requestedMaxKeepAliveCount: 10,
                    maxNotificationsPerPublish: 20000,
                    publishingEnabled: true,
                    priority: 6
                });


                var monitoredItems = [];

                var ids = [
                    "Scalar_Simulation_Double",
                    "Scalar_Simulation_Boolean",
                    "Scalar_Simulation_String",
                    "Scalar_Simulation_Int64",
                    "Scalar_Simulation_LocalizedText"
                ];
                ids.forEach(function (id) {
                    var nodeId = "ns=411;s=" + id;
                    var monitoredItem = subscription.monitor(
                        {nodeId: resolveNodeId(nodeId), attributeId: AttributeIds.Value},
                        {samplingInterval: 10, discardOldest: true, queueSize: 1});
                    monitoredItem.on("changed", make_callback(nodeId));
                });

                subscription.once("started", function (subscriptionId) {
                    setTimeout(function () {
                        subscription.terminate(inner_done);
                        Object.keys(changeByNodes).length.should.eql(ids.length);
                    }, 3000);

                });


            }, done);
        });


        it("should monitor a very large number of nodes (5000) ", function (done) {
            var ids = [
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

            var ids50000 = ids;
            while (ids50000.length < 5000) {
                ids50000 = ids50000.concat(ids);
            }

            function make5000Items() {
                var itemsToCreate = [];

                var clientHandle = 1;

                ids50000.forEach(function (s) {
                    var nodeId = "ns=411;s=" + s;
                    var itemToMonitor = new opcua.read_service.ReadValueId({
                        attributeId: opcua.AttributeIds.Value,
                        nodeId: nodeId
                    });
                    var monitoringMode = opcua.subscription_service.MonitoringMode.Reporting;

                    clientHandle++;

                    var monitoringParameters = new opcua.subscription_service.MonitoringParameters({
                        clientHandle: clientHandle,
                        samplingInterval: 100,
                        filter: null,
                        queueSize: 1,
                        discardOldest: true
                    });

                    var itemToCreate = {
                        itemToMonitor: itemToMonitor,
                        monitoringMode: monitoringMode,
                        requestedParameters: monitoringParameters
                    };
                    itemsToCreate.push(itemToCreate);
                });
                return itemsToCreate;

            }

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                assert(session instanceof ClientSession);

                var subscription = new ClientSubscription(session, {
                    requestedPublishingInterval: 10,
                    requestedLifetimeCount:      10 * 60 * 10,
                    requestedMaxKeepAliveCount:            3,
                    maxNotificationsPerPublish:             0, // unlimited
                    publishingEnabled: true,
                    priority: 6
                });


                var notificationMessageSpy = new sinon.spy();

                subscription.on("raw_notification",notificationMessageSpy);

                subscription.once("started", function (subscriptionId) {


                        var timestampsToReturn = opcua.read_service.TimestampsToReturn.Neither;

                        var itemsToCreate = make5000Items();
                        var createMonitorItemsRequest = new opcua.subscription_service.CreateMonitoredItemsRequest({
                            subscriptionId: subscription.subscriptionId,
                            timestampsToReturn: timestampsToReturn,
                            itemsToCreate: itemsToCreate
                        });

                        //Xx console.log(createMonitorItemsRequest.toString());
                     session.createMonitoredItems(createMonitorItemsRequest, function (err, response) {

                            if(err){
                                return; subscription.terminate(inner_done);

                            }
                            //Xx console.log(response.toString());
                            subscription.on("raw_notification",function(n){

                                //xx console.log(n.notificationData[0].monitoredItems[0].toString());

                                n.notificationData[0].monitoredItems.length.should.eql(itemsToCreate.length);

                                //xx console.log(notificationMessageSpy.callCount);
                                //xx console.log(notificationMessageSpy.getCall(0).args[0].toString());
                                //xx console.log(notificationMessageSpy.getCall(1).args[0].toString());

                                subscription.terminate(inner_done);
                            });

                        });

                });

            }, done);
        });
    });

};