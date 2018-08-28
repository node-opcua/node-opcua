/*global xit,it,describe,before,after,beforeEach,afterEach,require*/
"use strict";

const assert = require("node-opcua-assert").assert;
const should = require("should");
const sinon = require("sinon");

const opcua = require("node-opcua");
const OPCUAClient        = opcua.OPCUAClient;
const ClientSession      = opcua.ClientSession;
const ClientSubscription = opcua.ClientSubscription;
const AttributeIds       = opcua.AttributeIds;
const resolveNodeId      = opcua.resolveNodeId;

const perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

module.exports = function (test) {
    describe("Testing client with many monitored items", function () {

        let client, endpointUrl;

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


            const changeByNodes = {};

            function make_callback(_nodeId) {

                const nodeId = _nodeId;
                return function (dataValue) {
                    //Xx console.log(nodeId.toString() , "\t value : ",dataValue.value.value.toString());
                    const idx = nodeId.toString();
                    changeByNodes[idx] = changeByNodes[idx] ? changeByNodes[idx] + 1 : 1;
                };
            }

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                const subscription = new ClientSubscription(session, {
                    requestedPublishingInterval: 150,
                    requestedLifetimeCount: 10 * 60 * 10,
                    requestedMaxKeepAliveCount: 10,
                    maxNotificationsPerPublish: 20000,
                    publishingEnabled: true,
                    priority: 6
                });


                const monitoredItems = [];

                const ids = [
                    "Scalar_Simulation_Double",
                    "Scalar_Simulation_Boolean",
                    "Scalar_Simulation_String",
                    "Scalar_Simulation_Int64",
                    "Scalar_Simulation_LocalizedText"
                ];
                ids.forEach(function (id) {
                    const nodeId = "ns=2;s=" + id;
                    const monitoredItem = subscription.monitor(
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
            while (ids50000.length < 5000) {
                ids50000 = ids50000.concat(ids);
            }

            function make5000Items() {
                const itemsToCreate = [];

                let clientHandle = 1;

                ids50000.forEach(function (s) {
                    const nodeId = "ns=2;s=" + s;
                    const itemToMonitor = new opcua.read_service.ReadValueId({
                        attributeId: opcua.AttributeIds.Value,
                        nodeId: nodeId
                    });
                    const monitoringMode = opcua.subscription_service.MonitoringMode.Reporting;

                    clientHandle++;

                    const monitoringParameters = new opcua.subscription_service.MonitoringParameters({
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

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                const subscription = new ClientSubscription(session, {
                    requestedPublishingInterval: 10,
                    requestedLifetimeCount:      10 * 60 * 10,
                    requestedMaxKeepAliveCount:            3,
                    maxNotificationsPerPublish:             0, // unlimited
                    publishingEnabled: true,
                    priority: 6
                });


                const notificationMessageSpy = new sinon.spy();

                subscription.on("raw_notification",notificationMessageSpy);

                subscription.once("started", function (subscriptionId) {


                        const timestampsToReturn = opcua.read_service.TimestampsToReturn.Neither;

                        const itemsToCreate = make5000Items();
                        const createMonitorItemsRequest = new opcua.subscription_service.CreateMonitoredItemsRequest({
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