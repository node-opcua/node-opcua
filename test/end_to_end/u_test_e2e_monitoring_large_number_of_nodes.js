/*global xit,it,describe,before,after,beforeEach,afterEach,require*/
"use strict";
require("requirish")._(module);
var assert = require("better-assert");
var should = require("should");

var opcua = require("index.js");

var OPCUAClient = opcua.OPCUAClient;
var ClientSession = opcua.ClientSession;
var ClientSubscription = opcua.ClientSubscription;
var AttributeIds = opcua.AttributeIds;
var resolveNodeId = opcua.resolveNodeId;

var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var address_space_for_conformance_testing = require("lib/simulation/address_space_for_conformance_testing");
var build_address_space_for_conformance_testing = address_space_for_conformance_testing.build_address_space_for_conformance_testing;

var _port = 2000;

var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;


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
                    maxNotificationsPerPublish: 2,
                    publishingEnabled: true,
                    priority: 6
                });

                subscription.once("terminated", function () {
                    inner_done();
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
                        subscription.terminate();
                        Object.keys(changeByNodes).length.should.eql(ids.length);
                    }, 3000);

                });


            }, done);
        });

    });

};