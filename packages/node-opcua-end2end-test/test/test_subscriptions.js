"use strict";
const should = require("should");

const async = require("async");

const build_client_server_session = require("../test_helpers/build_client_server_session").build_client_server_session;

const opcua = require("node-opcua");
const VariableIds =  opcua.VariableIds;
const makeNodeId = opcua.makeNodeId;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing basic Client Server dealing with subscription at low level", function () {

    this.timeout(20000);

    let g_session;
    let client_server;

    before(function (done) {

        client_server = build_client_server_session({}, function (err) {
            if (!err) {
                g_session = client_server.g_session;

            }
            done(err);
        });

    });

    after(function (done) {
        client_server.shutdown(done);
    });


    it("server should create a subscription (CreateSubscriptionRequest)", function (done) {

        let subscriptionId = null;

        // CreateSubscriptionRequest
        const request = new opcua.CreateSubscriptionRequest({
            requestedPublishingInterval: 100,
            requestedLifetimeCount: 100 * 60 * 10,
            requestedMaxKeepAliveCount: 20,
            maxNotificationsPerPublish: 10,
            publishingEnabled: true,
            priority: 6
        });

        g_session.createSubscription(request, function (err, response) {

            if (err) {
                return done(err);
            }
            response.should.be.instanceof(opcua.CreateSubscriptionResponse);
            subscriptionId = response.subscriptionId;

            //xx console.log(response.toString());

            setImmediate(function () {
                const request = new opcua.DeleteSubscriptionsRequest({
                    subscriptionIds: [ subscriptionId ]
                });
                g_session.deleteSubscriptions(request, function (err, result) {
                    done(err);
                });
            });
        });
    });

    it("server should create a monitored item  (CreateMonitoredItems)", function (done) {


        let subscriptionId = null;
        // CreateSubscriptionRequest
        const request = new opcua.CreateSubscriptionRequest({
            requestedPublishingInterval: 100,
            requestedLifetimeCount: 100 * 60 * 10,
            requestedMaxKeepAliveCount: 20,
            maxNotificationsPerPublish: 10,
            publishingEnabled: true,
            priority: 6
        });
        g_session.createSubscription(request, function (err, response) {
            if (err) {
                return done(err);
            }
            response.should.be.instanceof(opcua.CreateSubscriptionResponse);
            subscriptionId = response.subscriptionId;


            // CreateMonitoredItemsRequest
            const request = new opcua.CreateMonitoredItemsRequest({
                subscriptionId: subscriptionId,
                timestampsToReturn: opcua.TimestampsToReturn.Both,
                itemsToCreate: [
                    {
                        itemToMonitor: {
                            nodeId: makeNodeId(VariableIds.Server_ServerStatus_CurrentTime)
                        },
                        monitoringMode: opcua.MonitoringMode.Sampling,
                        requestedParameters: {
                            clientHandle: 26,
                            samplingInterval: 100,
                            filter: null,
                            queueSize: 100,
                            discardOldest: true
                        }
                    }
                ]
            });
            g_session.createMonitoredItems(request, function (err, response) {
                if (!err) {
                    response.should.be.instanceof(opcua.CreateMonitoredItemsResponse);
                }
                done(err);
            });
        });
    });

    it("server should handle Publish request", function (done) {

        let subscriptionId = null;

        async.series([
            function (callback) {

                // CreateSubscriptionRequest
                const request = new opcua.CreateSubscriptionRequest({
                    requestedPublishingInterval: 100,
                    requestedLifetimeCount: 100 * 60 * 10,
                    requestedMaxKeepAliveCount: 20,
                    maxNotificationsPerPublish: 10,
                    publishingEnabled: true,
                    priority: 6
                });
                g_session.createSubscription(request, function (err, response) {
                    if (err) {
                        return done(err);
                    }
                    subscriptionId = response.subscriptionId;
                    callback();
                });
            },
            function (callback) {

                // publish request now requires a subscriptions
                const request = new opcua.PublishRequest({
                    subscriptionAcknowledgements: []
                });

                g_session.publish(request, function (err, response) {

                    if (!err) {
                        response.should.be.instanceof(opcua.PublishResponse);

                        response.should.have.ownProperty("subscriptionId");          // IntegerId
                        response.should.have.ownProperty("availableSequenceNumbers");// Array,Counter,
                        response.should.have.ownProperty("moreNotifications");       // Boolean
                        response.should.have.ownProperty("notificationMessage");
                        response.should.have.ownProperty("results");
                        response.should.have.ownProperty("diagnosticInfos");
                    }
                    callback(err);
                });
            },
            function(callback) {
                const request = new opcua.DeleteSubscriptionsRequest({
                    subscriptionIds: [ subscriptionId ]
                });
                g_session.deleteSubscriptions(request, function (err, result) {
                    callback(err);
                });
            }

        ],done);
    });


    it("server should handle DeleteMonitoredItems  request", function (done) {

        const request = new opcua.DeleteMonitoredItemsRequest({});
        g_session.deleteMonitoredItems(request, function (err, response) {
            err.message.should.match(/BadSubscriptionIdInvalid/);
            done();
        });
    });

    it("server should handle SetPublishingMode request", function (done) {

        g_session.setPublishingMode(true, [1], function (err, results) {
            if (!err) {
                results.should.be.instanceOf(Array);
            }
            done(err);
        });
    });


    it("server should handle DeleteSubscriptionsRequest", function (done) {

        const request = new opcua.DeleteSubscriptionsRequest({
            subscriptionIds: [1, 2]
        });
        g_session.deleteSubscriptions(request, function (err, response) {
            if (!err) {
                response.should.be.instanceOf(opcua.DeleteSubscriptionsResponse);
            }
            done(err);
        });
    });
});

