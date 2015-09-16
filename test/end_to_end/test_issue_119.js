/*global xit,it,describe,before,after,beforeEach,afterEach,require*/
"use strict";
require("requirish")._(module);
var assert = require("better-assert");
var should = require("should");
var async = require("async");

var opcua = require("index.js");

var OPCUAClient = opcua.OPCUAClient;
var ClientSession = opcua.ClientSession;
var ClientSubscription = opcua.ClientSubscription;
var AttributeIds = opcua.AttributeIds;
var resolveNodeId = opcua.resolveNodeId;
var Variant = opcua.Variant;
var DataType =opcua.DataType;

var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var address_space_for_conformance_testing = require("lib/simulation/address_space_for_conformance_testing");
var build_address_space_for_conformance_testing = address_space_for_conformance_testing.build_address_space_for_conformance_testing;

var _port = 2000;

var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;


// bug : server reported to many datavalue changed when client monitored a UAVariable consructed with variation 1");

describe("Testing bug #119 - Verify that monitored item only reports expected value change notifications", function () {

    this.timeout(50000);

    var server, client, temperatureVariableId, endpointUrl;

    before(function (done) {
        resourceLeakDetector.start();
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error
        server = build_server_with_temperature_device({port: _port}, function (err) {

            build_address_space_for_conformance_testing(server.engine, {mass_variables: false});

            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done(err);
        });
    });

    beforeEach(function (done) {
        client = new OPCUAClient();
        done();
    });

    afterEach(function (done) {
        client.disconnect(done);
        client = null;
    });

    after(function (done) {
        server.shutdown(function (err) {
            resourceLeakDetector.stop();
            done(err);
        });
        server = null;
    });

    it("monitoring variables shall only reports real value changes : fixing bug #1xx", function (done) {

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

            var nodeId = "ns=0;i=2257"; // Server.StartTime
            var monitoredItem = subscription.monitor(
                {nodeId: resolveNodeId(nodeId), attributeId: AttributeIds.Value},
                {samplingInterval: 10, discardOldest: true, queueSize: 1});


            var change_count = 0;
            monitoredItem.on("changed", function (dataValue) {
                change_count += 1;
            });

            subscription.once("started", function (subscriptionId) {

                async.series([

                    function(callback) {
                        // first "changed" must happen almost immediately
                        setTimeout(function () {
                            change_count.should.eql(1);
                            callback();
                        } , 200);
                    },
                    function(callback) {
                        setTimeout(function () {
                            change_count.should.eql(1);
                            callback();
                        } , 500);
                    },
                    function(callback) {

                        //  change server startTime ( from the server side)
                        server.engine.startTime = new Date();

                        setTimeout(function () {
                            // check that the change has been identified
                            change_count.should.eql(2);
                            callback();
                        } , 200);
                    },

                    function(callback) {
                        setTimeout(function () {
                            change_count.should.eql(2);
                            subscription.terminate();
                            callback();
                        }, 500);
                    }

                ]);
            });
        }, done);

    });

    it("a server that have a fast sampling rate shall not report value changed faster on monitored " +
        "item faster than the sampling rate imposed by the client",function(done){

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

            var count = 1;
            var v = server.engine.findObject(nodeId);
            v.setValueFromSource( new Variant({dataType: DataType.Double, value:count}));
            var timerId = setInterval(function() {
                count +=1;
                v.setValueFromSource( new Variant({dataType: DataType.Double, value:count}));
            },20); // high rate !!!



            var monitoredItem = subscription.monitor(
                {nodeId: resolveNodeId(nodeId), attributeId: AttributeIds.Value},
                {
                    samplingInterval: 500, // slow rate  (slower than publishing rate)
                    discardOldest: true,
                    queueSize: 10
                },opcua.read_service.TimestampsToReturn.Both);


            var change_count = 0;
            monitoredItem.on("changed", function (dataValue) {
                //xx console.log(" data Value = ",dataValue.value.toString());
                change_count += 1;
            });

            subscription.once("started", function (subscriptionId) {

                //xx console.log(" monitoredItem = ",monitoredItem);

                async.series([

                    function(callback) {
                        setTimeout(function () {
                            //xx console.log(change_count);
                            change_count.should.eql(1);
                            callback();
                        },500);
                    },
                    function(callback) {
                        setTimeout(function () {
                            //xx console.log(change_count);
                            change_count.should.eql(2);
                            callback();
                        } , 500);
                    },


                    function(callback) {
                        setTimeout(function () {
                            change_count.should.eql(4);
                            clearInterval(timerId);
                            subscription.terminate();
                            callback();
                        }, 1000 );
                    }

                ]);
            });
        }, done);

    });

});



