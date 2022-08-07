"use strict";
const should = require("should");

const {
    DataValue,
    ReadRequest,
    TimestampsToReturn,
    ClientSubscription,
    OPCUAClient,
    MessageSecurityMode,
    SecurityPolicy
} = require("node-opcua");

const securityMode = MessageSecurityMode.None;
const securityPolicy = SecurityPolicy.None;

const { make_debugLog } = require("node-opcua-debug");
const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");

const debugLog = make_debugLog("TEST");

// bug : server reported to many datavalue changed when client monitored a UAVariable constructed with variation 1");

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
module.exports = function (test) {

    describe("Testing bug #141 -  Client should have a appropriated timeoutHint on PublishRequest ", function () {

        const options = {
            securityMode: securityMode,
            securityPolicy: securityPolicy,
            serverCertificate: null,
            requestedSessionTimeout: 20000
        };

        let server, client, endpointUrl;

        beforeEach(function (done) {
            client = OPCUAClient.create(options);
            endpointUrl = test.endpointUrl;
            server = test.server;
            done();
        });

        afterEach(function (done) {
            client.disconnect(done);
            client = null;
        });

        it("#141-A Client#Subscription : PublishRequest.requestHeader.timeoutHint shall not be lesser that time between 2 keepalive responses", function (done) {

            const timeout = 25000;

            let the_subscription;

            let keepaliveCounter = 0;
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                the_subscription = ClientSubscription.create(session, {
                    requestedPublishingInterval: 6000,
                    requestedMaxKeepAliveCount: 2,
                    requestedLifetimeCount: 12,
                    maxNotificationsPerPublish: 10,
                    publishingEnabled: true,
                    priority: 10
                });

                let timerId;
                if (timeout > 0) {
                    timerId = setTimeout(function () {
                        the_subscription.terminate(function () {
                            keepaliveCounter.should.be.greaterThan(1);
                            client.timedOutRequestCount.should.eql(0);
                            inner_done();
                        });
                    }, timeout);
                }

                the_subscription.on("started", function () {
                    //xx debugLog("revised publishingInterval :", the_subscription.publishingInterval);
                    //xx debugLog("revised lifetimeCount      :", the_subscription.lifetimeCount);
                    //xx debugLog("revised maxKeepAliveCount  :", the_subscription.maxKeepAliveCount);
                    //xx debugLog("started subscription       :", the_subscription.subscriptionId);

                }).on("internal_error", function (err) {
                    debugLog(" received internal error", err.message);
                    clearTimeout(timerId);
                    inner_done(err);
                }).on("keepalive", function () {
                    // xx debugLog("keepalive");
                    keepaliveCounter++;

                }).on("terminated", function () {
                    /** */
                });

            }, done);

        });

        it("#141-B client should raise an event to observer when a request has timed out ( timeoutHint exhausted without response)", function (done) {

            const node = server.engine.addressSpace.getOwnNamespace().addVariable({

                browseName: "MySlowVariable",
                dataType: "Int32",
                value: {
                    refreshFunc: function (callback) {
                        should(callback).be.instanceOf(Function);
                        // intentionally not calling callback(); immediatly
                        const longTime = 10000;
                        setTimeout(function () {
                            debugLog(" refreshed ");
                            callback(null, new DataValue({
                                value: { value: 10, dataType: "Int32" },
                                sourceTimestamp: new Date()
                            }));
                        }, longTime);
                    }
                }
            });

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                const request = new ReadRequest({
                    nodesToRead: [{
                        nodeId: node.nodeId,
                        attributeId: 13
                    }],
                    timestampsToReturn: TimestampsToReturn.Neither
                });

                // let specify a very short timeout hint ...
                request.requestHeader.timeoutHint = 10;

                let callback_received = false;
                let event_received = false;

                session.performMessageTransaction(request, function (err, response) {

                    debugLog(" received performMessageTransaction callback", request.constructor.name.toString());
                    if (!err) {
                        debugLog(request.toString());
                        debugLog(response.toString());
                        return inner_done(new Error("Expecting an timeout Error "));
                    }
                    should.exist(err);
                    callback_received = true;
                    if (callback_received && event_received) {
                        inner_done();
                    }
                });

                client.on("timed_out_request", function (request) {
                    debugLog(" received timed_out_request", request.constructor.name.toString());
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
