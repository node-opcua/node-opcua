

var OPCUAServer = require("../lib/opcua-server").OPCUAServer;
var OPCUAClient = require("../lib/opcua-client").OPCUAClient;
var should = require("should");
var assert = require('better-assert');
var async = require("async");
var util = require("util");
var opcua = require("../lib/nodeopcua");

var debugLog  = require("../lib/utils").make_debugLog(__filename);
var StatusCodes = require("../lib/opcua_status_code").StatusCodes;

var read_service= require("../lib/read_service");
var browse_service = require("../lib/browse_service");
var subscription_service = require("../lib/subscription_service");

var s = require("../lib/structures");
var ec = require("../lib/encode_decode");
var hexDump = require("../lib/utils").hexDump;

describe("testing subscription objects",function(){
    var encode_decode_round_trip_test = require("./utils/encode_decode_round_trip_test").encode_decode_round_trip_test;

    it("should encode and decode a CreateSubscriptionRequest",function(done){
        var request = new subscription_service.CreateSubscriptionRequest({
            requestedPublishingInterval: 1000,
            requestedLifetimeCount:      1000 * 60 * 10 ,// 10 minutes
            requestedMaxKeepAliveCount:  10,
            maxNotificationsPerPublish:  10,
            publishingEnabled:           true,
            priority:                    6
        });
        encode_decode_round_trip_test(request);
        done();
    });

    it("should encode and decode a CreateSubscriptionResponse",function(done){
        var response = new subscription_service.CreateSubscriptionResponse({ });
        encode_decode_round_trip_test(response);
        done();
    });

    it("should encode and decode a CreateMonitoredItemsRequest",function(done){
        var request = new subscription_service.CreateMonitoredItemsRequest({
            subscriptionId: 1,
            timestampsToReturn: read_service.TimestampsToReturn.Both,
            itemsToCreate:  [
                {
                    itemToMonitor: ec.makeNodeId("i:100"),
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
        encode_decode_round_trip_test(request);
        done();
    });

    it("should encode and decode a CreateMonitoredItemsResponse",function(done){
        var response = new subscription_service.CreateMonitoredItemsResponse({

        });
        encode_decode_round_trip_test(response);
        done();
    });

    it("should encode and decode a MonitoringParameters",function(done){
        var obj = new subscription_service.MonitoringParameters({

        });
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a DeleteMonitoredItemsRequest",function(done){
        var obj = new subscription_service.DeleteMonitoredItemsRequest({
            subscriptionId: 100,
            monitoredItemIds: [1,2,3,4]
        });
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a DeleteMonitoredItemsResponse",function(done){
        var obj = new subscription_service.DeleteMonitoredItemsResponse({
            subscriptionId: 100,
            results: [
                StatusCodes.Bad_ApplicationSignatureInvalid,
                StatusCodes.Good
            ]
        });
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a SetPublishingModeRequest",function(done){
        var obj = new subscription_service.SetPublishingModeRequest({
            publishingEnabled: true,
            subscriptionIds: [1,2,3,4]
        });
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a SetPublishingModeResponse",function(done){
        var obj = new subscription_service.SetPublishingModeRequest({
            results: [
                StatusCodes.Bad_ApplicationSignatureInvalid,
                StatusCodes.Good
            ]
        });
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a PublishRequest",function(done){
        var obj = new subscription_service.PublishRequest({
            subscriptionAcknowledgements: [
                {
                    subscriptionId: 1,
                    sequenceNumber: 1
                },
                {
                    subscriptionId: 2,
                    sequenceNumber: 2
                }
            ]
        });
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a PublishResponse",function(done){
        var obj = new subscription_service.PublishResponse({
            subscriptionId: 1,
            availableSequenceNumbers: [ 1,2,3],
            moreNotifications: true,
            notificationMessage: {
                sequenceNumber: 1,
                publishTime: new Date(),
                notificationData: null
            },
            results: [
                StatusCodes.Good
            ],
            diagnosticInfos: [
            ]
        });
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a RepublishRequest",function(done){
        var obj = new subscription_service.RepublishRequest({
            subscriptionId: 1,
            retransmitSequenceNumber: 20
        });
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a RepublishResponse",function(done){
        var obj = new subscription_service.RepublishResponse({
            notificationMessage: {
                sequenceNumber: 1,
                publishTime: new Date(),
                notificationData: [
                ]
            }
        });
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a DeleteSubscriptionsRequest",function(done){
        var obj = new subscription_service.DeleteSubscriptionsRequest({

        });
        encode_decode_round_trip_test(obj);
        done();
    });
    it("should encode and decode a DeleteSubscriptionsResponse",function(done){
        var obj = new subscription_service.DeleteSubscriptionsResponse({

        });
        encode_decode_round_trip_test(obj);
        done();
    });
});

var _ = require("underscore");

describe("testing Client Server dealing with subscription",function(){
    var server , client;
    var endpointUrl,g_session ;

    before(function(done){

        server = new OPCUAServer();
        // we will connect to first server end point
        endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
        debugLog("endpointUrl",endpointUrl);
        opcua.is_valid_endpointUrl(endpointUrl).should.equal(true);

        client = new OPCUAClient();

        server.start(function() {
            setImmediate(function() {
                client.connect(endpointUrl,function(err){
                    client.createSession(function(err,session){
                        g_session = session;
                        done();
                    });
                });
            });
        });
    });

    after(function(done){
        client.disconnect(function(){
            server.shutdown(function() {
                done();
            });
        });

    });

    it("server should create a subscription",function(done){
        var s = require("../lib/structures");

        // CreateMonitoredItemsRequest
        var request = new subscription_service.CreateSubscriptionRequest({
            requestedPublishingInterval: 1000,
            requestedLifetimeCount:      1000 * 60 * 10 ,// 10 minutes
            requestedMaxKeepAliveCount:  10,
            maxNotificationsPerPublish:  10,
            publishingEnabled:           true,
            priority:                    6
        });
        g_session.createSubscription(request,function(err,response){
            if(!err) {
                assert(response instanceof subscription_service.CreateSubscriptionResponse);
            }
            done(err);

        });
    });
    it("server should create a CreateMonitoredItems ",function(done){

        // CreateMonitoredItemsRequest
        var request = new subscription_service.CreateMonitoredItemsRequest({
            subscriptionId: 1,
            timestampsToReturn: read_service.TimestampsToReturn.Both,
            itemsToCreate:  [
                {
                    itemToMonitor: ec.makeNodeId("i:100"),
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
        g_session.createMonitoredItems(request,function(err,response){
            if(!err) {
                assert(response instanceof subscription_service.CreateMonitoredItemsResponse);
            }
            done(err);
        });
    });

    it("server should handle Publish request",function(done){

        var request = new subscription_service.PublishRequest({

        });
        g_session.publish(request,function(err,response){
            if(!err) {
                assert(response instanceof subscription_service.PublishResponse);
            }
            done(err);
        });
    });

    it("server should handle Republish request",function(done){

        var request = new subscription_service.RepublishRequest({

        });
        g_session.republish(request,function(err,response){
            if(!err) {
                assert(response instanceof subscription_service.RepublishResponse);
            }
            done(err);
        });
    });

    it("server should handle DeleteMonitoredItems  request",function(done){

        var request = new subscription_service.DeleteMonitoredItemsRequest({

        });
        g_session.deleteMonitoredItems(request,function(err,response){
            if(!err) {
                assert(response instanceof subscription_service.DeleteMonitoredItemsResponse);
            }
            done(err);
        });
    });

    it("server should handle SetPublishingMode   request",function(done){

        var request = new subscription_service.SetPublishingModeRequest({

        });
        g_session.setPublishingMode(request,function(err,response){
            if(!err) {
                assert(response instanceof subscription_service.SetPublishingModeResponse);
            }
            done(err);
        });
    });


});