/*global it,describe,beforeEach,afterEach,require*/
"use strict";

var assert = require("node-opcua-assert");
var should = require("should");
var async = require("async");

var opcua = require("node-opcua");

var OPCUAClient = opcua.OPCUAClient;
var ClientSession = opcua.ClientSession;
var ClientSubscription = opcua.ClientSubscription;
var AttributeIds = opcua.AttributeIds;
var resolveNodeId = opcua.resolveNodeId;
var Variant = opcua.Variant;
var DataType =opcua.DataType;
var makeNodeId = opcua.makeNodeId;
var VariableIds = opcua.VariableIds;

var perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

// bug : server reported to many datavalue changed when client monitored a UAVariable consructed with variation 1");

module.exports = function (test) {
    describe("Testing bug #119 - Verify that monitored item only reports expected value change notifications :", function () {

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

        it("monitoring variables shall only reports real value changes : fixing bug #119", function (done) {


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

                var nodeId = makeNodeId(VariableIds.Server_ServerStatus_BuildInfo_ProductName); // "ns=0;i=2261";

                var monitoredItem = subscription.monitor(
                    {nodeId: resolveNodeId(nodeId), attributeId: AttributeIds.Value},
                    {samplingInterval: 10, discardOldest: true, queueSize: 1});


                var change_count = 0;
                monitoredItem.on("changed", function (dataValue) {
                    should.exist(dataValue);
                    change_count += 1;
                });

                subscription.once("started", function (subscriptionId) {
                    should.exist(subscriptionId);
                    async.series([

                        function (callback) {
                            // first "changed" must happen almost immediately
                            setTimeout(function () {
                                change_count.should.eql(1);
                                callback();
                            }, 200);
                        },
                        function (callback) {
                            setTimeout(function () {
                                change_count.should.eql(1);
                                callback();
                            }, 500);
                        },

                        function (callback) {

                            var node = test.server.engine.addressSpace.findNode(nodeId);
                            should.exist(node);

                            //  change server productName ( from the server side)
                            test.server.engine.serverStatus.buildInfo.productName += "Modified";

                            setTimeout(function () {
                                // check that the change has been identified, but reported only once !
                                change_count.should.eql(2);
                                callback();
                            }, 3000);

                        },

                        function (callback) {
                            setTimeout(function () {
                                change_count.should.eql(2);
                                subscription.terminate(callback);
                            }, 1500);
                        }

                    ]);
                });
            }, done);

        });

        it("a server that have a fast sampling rate shall not report 'value changes' on monitored " +
            "item faster than the sampling rate imposed by the client", function (done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                assert(session instanceof ClientSession);

                var subscription = new ClientSubscription(session, {
                    requestedPublishingInterval: 250,
                    requestedLifetimeCount: 10 * 60 * 10,
                    requestedMaxKeepAliveCount: 10,
                    maxNotificationsPerPublish: 2,
                    publishingEnabled: true,
                    priority: 6
                });

                subscription.once("terminated", function () {
                    inner_done();
                });

                var nodeId = "ns=411;s=Scalar_Static_Double";

                var count = 1.0;

                var v = test.server.engine.addressSpace.findNode(nodeId);
                v.setValueFromSource(new Variant({dataType: DataType.Double, value: count}));


                // change the underlying value at a very fast rate (every 20ms)
                var timerId = setInterval(function () {
                    count += 1;
                    v.setValueFromSource(new Variant({dataType: DataType.Double, value: count}));
                }, 20); // high rate !!!


                var monitoredItem = subscription.monitor(
                    {nodeId: resolveNodeId(nodeId), attributeId: AttributeIds.Value},
                    {
                        samplingInterval: 500, // slow rate  (slower than publishing rate)
                        discardOldest: true,
                        queueSize: 10
                    }, opcua.read_service.TimestampsToReturn.Both);


                var change_count = 0;
                monitoredItem.on("changed", function (dataValue) {
                    should.exist(dataValue);
                    //xx console.log(" data Value = ",dataValue.value.toString());
                    change_count += 1;
                });

                subscription.once("started", function (subscriptionId) {
                    should.exist(subscriptionId);

                    //xx console.log(" monitoredItem = ",monitoredItem);

                    async.series([

                        function (callback) {

                            setTimeout(function () {
                                //xx console.log(change_count);
                                change_count.should.be.within(1, 2);
                                callback();
                            }, 500);

                        },
                        function (callback) {
                            setTimeout(function () {
                                //xx console.log(change_count);
                                change_count.should.be.within(2, 4);
                                callback();
                            }, 500);
                        },


                        function (callback) {
                            setTimeout(function () {
                                change_count.should.be.within(4, 6);

                                count.should.be.greaterThan(50);

                                clearInterval(timerId);
                                subscription.terminate(callback);

                            }, 1000);
                        }

                    ]);
                });
            }, done);

        });

    });


};