
var _ = require("underscore");
var build_client_server_session = require("$node-opcua/test-helpers/build_client_server_session").build_client_server_session;
var VariableIds = require("node-opcua-constants").VariableIds;

var subscription_service = require("node-opcua-service-subscription");

describe("testing basic Client Server dealing with subscription at low level", function () {
    var g_session;
    var client_server;

    before(function (done) {

        client_server = build_client_server_session(function (err) {
            if (!err) {
                g_session = client_server.g_session;

            }
            done(err);
        });

    });

    after(function (done) {
        client_server.shutdown(done);
    });

    var subscriptionId = null;
    it("server should create a subscription (CreateSubscriptionRequest)", function (done) {

        // CreateSubscriptionRequest
        var request = new subscription_service.CreateSubscriptionRequest({
            requestedPublishingInterval: 100,
            requestedLifetimeCount: 100 * 60 * 10,
            requestedMaxKeepAliveCount: 2,
            maxNotificationsPerPublish: 2,
            publishingEnabled: true,
            priority: 6
        });
        g_session.createSubscription(request, function (err, response) {
            if (!err) {
                response.should.be.instanceof(subscription_service.CreateSubscriptionResponse);
                subscriptionId = response.subscriptionId;
            }
            done(err);

        });
    });
    it("server should create a monitored item  (CreateMonitoredItems)", function (done) {


        // CreateMonitoredItemsRequest
        var request = new subscription_service.CreateMonitoredItemsRequest({
            subscriptionId: subscriptionId,
            timestampsToReturn: read_service.TimestampsToReturn.Both,
            itemsToCreate: [
                {
                    itemToMonitor: {
                        nodeId: ec.makeNodeId(VariableIds.Server_ServerStatus_CurrentTime)
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

    it("server should handle Publish request", function (done) {

        // publish request now requires a subscriptions
        var request = new subscription_service.PublishRequest({
            subscriptionAcknowledgements: []
        });
        g_session.publish(request, function (err, response) {

            if (!err) {
                response.should.be.instanceof(subscription_service.PublishResponse);

                assert(response.hasOwnProperty("subscriptionId"));          // IntegerId
                assert(response.hasOwnProperty("availableSequenceNumbers"));// Array,Counter,
                assert(response.hasOwnProperty("moreNotifications"));       // Boolean
                assert(response.hasOwnProperty("notificationMessage"));
                assert(response.hasOwnProperty("results"));
                assert(response.hasOwnProperty("diagnosticInfos"));
            }
            done(err);
        });
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
                assert(response instanceof subscription_service.DeleteSubscriptionsResponse);
            }
            done(err);
        });
    });
});

