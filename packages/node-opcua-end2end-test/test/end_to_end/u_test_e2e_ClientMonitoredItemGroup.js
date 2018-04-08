/*global xit,it,describe,before,after,beforeEach,afterEach,require*/
"use strict";

const assert = require("node-opcua-assert");
const should = require("should");
const async = require("async");
const _ = require("underscore");

var opcua = require("node-opcua");


const perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

const perform_operation_on_subscription = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_subscription;
var opcua = require("node-opcua");

const OPCUAClient = opcua.OPCUAClient;

const AttributeIds = opcua.AttributeIds;
const resolveNodeId = opcua.resolveNodeId;
const doDebug = false;


module.exports = function (test) {

    describe("Testing ClientMonitoredItemGroup", function () {

        let server, client, endpointUrl;

        beforeEach(function (done) {
            client = new OPCUAClient();
            server = test.server;
            endpointUrl = test.endpointUrl;
            done();
        });

        afterEach(function (done) {
            client = null;
            done();
        });


        it("AA11 should create a ClientMonitoredItem and get notified", function (done) {
            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, callback) {

                const itemToMonitor = {
                    nodeId: resolveNodeId("ns=0;i=2258"), // Server_ServerStatus_CurrentTime
                    attributeId: AttributeIds.Value
                };

                const options = {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1
                };

                const monitoredItem = subscription.monitor(itemToMonitor, options);

                let count = 0;
                monitoredItem.on("changed", function (dataValue) {

                    if (doDebug) {
                        console.log(" Count +++");
                    }
                    count++;
                    if (count === 10) {
                        monitoredItem.terminate(function () {
                            if (doDebug) {
                                console.log(" terminated !");
                            }
                            callback();
                        });
                    }
                });

                // subscription.on("item_added",function(monitoredItem){
                monitoredItem.on("initialized", function () {
                    if (doDebug) {
                        console.log(" Initialized !");
                    }
                });

            }, done);

        });

        it("should create a ClientMonitoredItemGroup ", function (done) {

            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, callback) {

                const itemsToMonitor = [
                    {
                        nodeId: resolveNodeId("ns=0;i=2258"),
                        attributeId: AttributeIds.Value
                    },

                    {
                        nodeId: resolveNodeId("ns=0;i=2258"),
                        attributeId: AttributeIds.Value
                    }
                ];
                const options = {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1
                };

                const monitoredItemGroup = subscription.monitorItems(itemsToMonitor, options);

                // subscription.on("item_added",function(monitoredItem){
                monitoredItemGroup.on("initialized", function () {
                    if (doDebug) {
                        console.log(" Initialized !");
                    }

                    monitoredItemGroup.monitoredItems.length.should.eql(2);

                    monitoredItemGroup.terminate(function () {
                        if (doDebug) {
                            console.log(" terminated !");
                        }
                        callback();
                    });
                });

            }, done);
        });
        it("AA22 should create a ClientMonitoredItemGroup and get notified when one monitored item out of many is changing", function (done) {

            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, callback) {

                const itemsToMonitor = [
                    {
                        nodeId: resolveNodeId("ns=0;i=2258"), // Server_ServerStatus_CurrentTime
                        attributeId: AttributeIds.Value
                    },

                    {
                        nodeId: resolveNodeId("ns=0;i=2258"),
                        attributeId: AttributeIds.Value
                    }
                ];
                const options = {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1
                };

                const monitoredItemGroup = subscription.monitorItems(itemsToMonitor, options);

                let count = 0;
                monitoredItemGroup.on("changed", function (item, dataValue, index) {

                    count++;
                    if (doDebug) {
                        console.log(" Count +++", item.itemToMonitor.nodeId.toString(), dataValue.value.toString(), index);
                    }
                    if (count === 10) {
                        monitoredItemGroup.terminate(function () {
                            if (doDebug) {
                                console.log(" terminated !");
                            }
                            callback();
                        });
                    }
                });

                // subscription.on("item_added",function(monitoredItem){
                monitoredItemGroup.on("initialized", function () {
                    if (doDebug) {
                        console.log(" Initialized !");
                    }
                    monitoredItemGroup.monitoredItems.length.should.eql(2);
                });

            }, done);
        });

    });
};
