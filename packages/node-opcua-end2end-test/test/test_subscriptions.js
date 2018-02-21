"use strict";
var should = require("should");

var async = require("async");

var build_client_server_session = require("../test_helpers/build_client_server_session").build_client_server_session;

var VariableIds = require("node-opcua").VariableIds;
var subscription_service = require("node-opcua").subscription_service;
var read_service = require("node-opcua").read_service;
var makeNodeId = require("node-opcua").makeNodeId;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing basic Client Server dealing with subscription at low level", function () {

    this.timeout(20000);

    var g_session;
    var client_server;

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

        var subscriptionId = null;

        // CreateSubscriptionRequest
        var request = new subscription_service.CreateSubscriptionRequest({
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
            response.should.be.instanceof(subscription_service.CreateSubscriptionResponse);
            subscriptionId = response.subscriptionId;

            //xx console.log(response.toString());

            setImmediate(function () {
                var request = new subscription_service.DeleteSubscriptionsRequest({
                    subscriptionIds: [ subscriptionId ]
                });
                g_session.deleteSubscriptions(request, function (err, result) {
                    done(err);
                });
            });
        });
    });

    it("server should create a monitored item  (CreateMonitoredItems)", function (done) {


        var subscriptionId = null;
        // CreateSubscriptionRequest
        var request = new subscription_service.CreateSubscriptionRequest({
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
            response.should.be.instanceof(subscription_service.CreateSubscriptionResponse);
            subscriptionId = response.subscriptionId;


            // CreateMonitoredItemsRequest
            var request = new subscription_service.CreateMonitoredItemsRequest({
                subscriptionId: subscriptionId,
                timestampsToReturn: read_service.TimestampsToReturn.Both,
                itemsToCreate: [
                    {
                        itemToMonitor: {
                            nodeId: makeNodeId(VariableIds.Server_ServerStatus_CurrentTime)
                        },
                        monitoringMode: subscription_service.MonitoringMode.Sampling,
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
                    response.should.be.instanceof(subscription_service.CreateMonitoredItemsResponse);
                }
                done(err);
            });
        });
    });

    it("server should handle Publish request", function (done) {

        var subscriptionId = null;

        async.series([
            function (callback) {

                // CreateSubscriptionRequest
                var request = new subscription_service.CreateSubscriptionRequest({
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
                var request = new subscription_service.PublishRequest({
                    subscriptionAcknowledgements: []
                });

                g_session.publish(request, function (err, response) {

                    if (!err) {
                        response.should.be.instanceof(subscription_service.PublishResponse);

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
                var request = new subscription_service.DeleteSubscriptionsRequest({
                    subscriptionIds: [ subscriptionId ]
                });
                g_session.deleteSubscriptions(request, function (err, result) {
                    callback(err);
                });
            }

        ],done);
    });


    it("server should handle DeleteMonitoredItems  request", function (done) {

        var request = new subscription_service.DeleteMonitoredItemsRequest({});
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

        var request = new subscription_service.DeleteSubscriptionsRequest({
            subscriptionIds: [1, 2]
        });
        g_session.deleteSubscriptions(request, function (err, response) {
            if (!err) {
                response.should.be.instanceOf(subscription_service.DeleteSubscriptionsResponse);
            }
            done(err);
        });
    });
});

