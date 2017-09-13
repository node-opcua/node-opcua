/*global xit,it,describe,before,after,beforeEach,afterEach,require*/
"use strict";

var assert = require("node-opcua-assert");
var should = require("should");
var async = require("async");
var _ = require("underscore");

var opcua = require("node-opcua");


var perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

var perform_operation_on_subscription = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_subscription;
var opcua = require("node-opcua");

var OPCUAClient = opcua.OPCUAClient;

var AttributeIds = opcua.AttributeIds;
var resolveNodeId = opcua.resolveNodeId;
var doDebug = false;


module.exports = function (test) {

    describe("Testing ClientMonitoredItemGroup", function () {

        var server, client, endpointUrl;

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

                var itemToMonitor = {
                    nodeId: resolveNodeId("ns=0;i=2258"), // Server_ServerStatus_CurrentTime
                    attributeId: AttributeIds.Value
                };

                var options = {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1
                };

                var monitoredItem = subscription.monitor(itemToMonitor, options);

                var count = 0;
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

                var itemsToMonitor = [
                    {
                        nodeId: resolveNodeId("ns=0;i=2258"),
                        attributeId: AttributeIds.Value
                    },

                    {
                        nodeId: resolveNodeId("ns=0;i=2258"),
                        attributeId: AttributeIds.Value
                    }
                ];
                var options = {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1
                };

                var monitoredItemGroup = subscription.monitorItems(itemsToMonitor, options);

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

                var itemsToMonitor = [
                    {
                        nodeId: resolveNodeId("ns=0;i=2258"), // Server_ServerStatus_CurrentTime
                        attributeId: AttributeIds.Value
                    },

                    {
                        nodeId: resolveNodeId("ns=0;i=2258"),
                        attributeId: AttributeIds.Value
                    }
                ];
                var options = {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1
                };

                var monitoredItemGroup = subscription.monitorItems(itemsToMonitor, options);

                var count = 0;
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
