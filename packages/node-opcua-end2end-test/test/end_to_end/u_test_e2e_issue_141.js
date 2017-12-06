/*global it,describe,beforeEach,afterEach,require*/
"use strict";

var should = require("should");

var opcua = require("node-opcua");

var OPCUAClient = opcua.OPCUAClient;
var securityMode = opcua.MessageSecurityMode.NONE;
var securityPolicy = opcua.SecurityPolicy.None;

var perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

// bug : server reported to many datavalue changed when client monitored a UAVariable constructed with variation 1");


module.exports = function (test) {

    describe("Testing bug #141 -  Client should have a appropriated timeoutHint on PublishRequest ", function () {

        var options = {
            securityMode: securityMode,
            securityPolicy: securityPolicy,
            serverCertificate: null
        };

        var server, client, endpointUrl;

        beforeEach(function (done) {
            client = new OPCUAClient(options);
            endpointUrl = test.endpointUrl;
            server = test.server;
            done();
        });

        afterEach(function (done) {
            client.disconnect(done);
            client = null;
        });

        it("#141-A Client#Subscription : PublishRequest.requestHeader.timeoutHint shall not be lesser that time between 2 keepalive responses", function (done) {

            var timeout = 25000;

            var the_subscription;

            var keepaliveCounter = 0;
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                the_subscription = new opcua.ClientSubscription(session, {
                    requestedPublishingInterval: 6000,
                    requestedMaxKeepAliveCount: 2,
                    requestedLifetimeCount: 12,
                    maxNotificationsPerPublish: 10,
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

            }, done);

        });

        it("#141-B client should raise an event to observer when a request has timed out ( timeoutHint exhausted without response)", function (done) {

            var node = server.engine.addressSpace.addVariable({

                browseName: "MySlowVariable",
                dataType: "Int32",
                value: {
                    refreshFunc: function (callback) {
                        should(callback).be.instanceOf(Function);

                        // intentionally not calling callback();

                        //xx var longTime = 1000;
                        //setTimeout(function () {
                        //    console.log(" refreshed ");
                        //    callback(null, new opcua.DataValue({value: value, sourceTimestamp: sourceTimestamp}));
                        //}, longTime);
                    }
                }
            });

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var request = new opcua.read_service.ReadRequest({
                    nodesToRead: [{
                        nodeId: node.nodeId,
                        attributeId: 13
                    }],
                    timestampsToReturn: opcua.read_service.TimestampsToReturn.Neither
                });

                // let specify a very short timeout hint ...
                request.requestHeader.timeoutHint = 10;

                var callback_received = false;
                var event_received = false;

                session.performMessageTransaction(request, function (err) {
                    //
                    console.log(" received performMessageTransaction callback", request.constructor.name.toString());
                    should.exist(err);
                    callback_received = true;
                    if (callback_received && event_received) {
                        inner_done();
                    }
                });

                client.on("timed_out_request", function (request) {
                    console.log(" received timed_out_request", request.constructor.name.toString());
                    client.timedOutRequestCount.should.eql(1);
                    event_received = true;
                    if (callback_received && event_received) {
                        inner_done();
                    }
                });

            }, done);

        });
    });
};
