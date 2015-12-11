/*global xit,it,describe,before,after,beforeEach,afterEach,require*/
"use strict";
require("requirish")._(module);
var assert = require("better-assert");
var should = require("should");
var async = require("async");
var _ = require("underscore");

var opcua = require("index.js");

var OPCUAClient = opcua.OPCUAClient;
var ClientSession = opcua.ClientSession;

var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;

var _port = 2000;

var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;

var securityMode = opcua.MessageSecurityMode.NONE;
var securityPolicy = opcua.SecurityPolicy.None;

// bug : server reported to many datavalue changed when client monitored a UAVariable consructed with variation 1");

describe("Testing bug #141 -  Client should have a appropriated timeoutHint on PublishRequest ", function () {

    var options = {
        securityMode: securityMode,
        securityPolicy: securityPolicy,
        serverCertificate: null,
    };

    this.timeout(Math.max(200000,this._timeout));

    var server, client, temperatureVariableId, endpointUrl;

    before(function (done) {
        resourceLeakDetector.start();
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error
        server = build_server_with_temperature_device({port: _port}, function (err) {

            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done(err);
        });
    });

    beforeEach(function (done) {
        client = new OPCUAClient(options);
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

    it("Client#Subscription : PublishRequest.requestHeader.timeoutHint shall not be lesser that time between 2 keepalive response", function (done) {

        var timeout = 25000;

        var the_subscription;

        var keepaliveCounter = 0;
        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            the_subscription = new opcua.ClientSubscription(session, {
                requestedPublishingInterval: 6000,
                requestedMaxKeepAliveCount:  2,
                requestedLifetimeCount:      12,
                maxNotificationsPerPublish:  10,
                publishingEnabled: true,
                priority: 10
            });

            var timerId;
            if (timeout > 0) {
                timerId = setTimeout(function () {
                    the_subscription.terminate();
                }, timeout);
            }

            the_subscription.on("started", function () {
                console.log("revised publishingInterval :", the_subscription.publishingInterval);
                console.log("revised lifetimeCount      :", the_subscription.lifetimeCount);
                console.log("revised maxKeepAliveCount  :", the_subscription.maxKeepAliveCount);
                console.log("started subscription       :", the_subscription.subscriptionId);

            }).on("internal_error", function (err) {
                console.log(" received internal error", err.message);
                clearTimeout(timerId);
                inner_done(err);


            }).on("keepalive", function () {
                console.log("keepalive");
                keepaliveCounter++;

            }).on("terminated", function () {
                keepaliveCounter.should.be.greaterThan(1);

                client.timedOutRequestCount.should.eql(0);

                inner_done();
            });

        },done);

    });

    it("ZZ2 client should raise an event to observer when a request has timed out ( timeoutHint exhausted without response)",function(done){

        var longTime = 1000;
        var temperature = 20;
        var node = server.engine.addressSpace.addVariable({

            browseName: "MySlowVariable",
            dataType: "Int32",
            value: {
                refreshFunc: function (callback) {
                    var value = new opcua.Variant({dataType: opcua.DataType.Double, value: temperature});
                    var sourceTimestamp = new Date();
                    //setTimeout(function () {
                    //    console.log(" refreshed ");
                    //    callback(null, new opcua.DataValue({value: value, sourceTimestamp: sourceTimestamp}));
                    //}, longTime);
                }
            }
        });

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            var request = new opcua.read_service.ReadRequest({
                nodesToRead: [ {
                    nodeId: node.nodeId,
                    attributeId: 13
                }],
                timestampsToReturn: opcua.read_service.TimestampsToReturn.Neither
            });

            request.requestHeader.timeoutHint = 10;

            var hit = 0;

            session.performMessageTransaction(request,function(err) {
                //
                should(err).not.eql(null);
                hit = hit+1;if (hit === 2) { inner_done(); }
            });

            client.on("timed_out_request",function(request) {
                console.log(" received timed_out_request",request.toString());
                client.timedOutRequestCount.should.eql(1);
                hit = hit+1;if (hit === 2) { inner_done(); }

            });

        },done);

    });
});
