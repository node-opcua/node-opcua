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

// Use Case:
//
//     - Given a server
//     - Given a client, connected to the server
//     - Given a subscription with some monitored Item that produces DataNotification continuously
//
//     - When the TCP connection is broken
//
//     - Then the server stops sending DataNotification but keeps accumulating them, waiting for a new client connection
//       on the same session.
//
//     - Then the client tries to reconnect to the server by creating a new SecureChannel and reactivates
//       the previous session.
//
//     - and When the connection is established again
//
//     - Then the client can reestablish the subscription &  monitored item
//     - We should verify that none of the
//
module.exports = function (test) {

    describe("Testing bug #144 - Server with Client & active subscription, connection broken , reconnection => No data Lost", function () {

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

        xit("#144-A should 1",function(done){

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var the_subscription = new opcua.ClientSubscription(session, {
                    requestedPublishingInterval: 200,
                    requestedMaxKeepAliveCount:  50,
                    requestedLifetimeCount:      120,
                    maxNotificationsPerPublish:  100,
                    publishingEnabled: true,
                    priority: 10
                });

                var timeout = 10000;
                var keepaliveCounter = 0;
                // subscribe to currentTime


                the_subscription.on("started", function () {
                    console.log("revised publishingInterval :", the_subscription.publishingInterval);
                    console.log("revised lifetimeCount      :", the_subscription.lifetimeCount);
                    console.log("revised maxKeepAliveCount  :", the_subscription.maxKeepAliveCount);
                    console.log("started subscription       :", the_subscription.subscriptionId);

                }).on("internal_error", function (err) {
                    console.log(" received internal error", err.message);
                    clearTimeout(timerId);
                    //xx inner_done(err);
                }).on("keepalive", function () {
                    console.log("keepalive");
                    keepaliveCounter++;

                }).on("terminated", function () {
                    inner_done();
                });


                var nodeId = opcua.makeNodeId(opcua.VariableIds.Server_ServerStatus_CurrentTime); // "ns=0;i=2261";

                var monitoredItem = the_subscription.monitor(
                    {nodeId: opcua.resolveNodeId(nodeId), attributeId: opcua.AttributeIds.Value},
                    {samplingInterval: 10, discardOldest: true, queueSize: 1});


                var change_count = 0;
                monitoredItem.on("changed", function (dataValue) {
                    change_count += 1;
                });

                var timerId;
                timerId = setTimeout(function () {


                    console.log("change_count = ",change_count);

                    // simulate a  connection break

                    function simulate_connection_lost(client) {

                        var socket = client._secureChannel._transport._socket;
                        socket.end();
                        socket.emit('error', new Error('ECONNRESET'));
                    }

                    simulate_connection_lost(client);

                    setTimeout(function () {
                        the_subscription.terminate(function(err){
                            console.log("ERR = ")
                        });
                    },1000);

                }, timeout);

            }, done);

        });


    });
};