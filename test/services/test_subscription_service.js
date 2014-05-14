

var OPCUAServer = require("../../lib/opcua-server").OPCUAServer;
var OPCUAClient = require("../../lib/opcua-client").OPCUAClient;
var should = require("should");
var assert = require('better-assert');
var async = require("async");
var util = require("util");
var opcua = require("../../lib/nodeopcua");

var debugLog  = require("../../lib/utils").make_debugLog(__filename);
var StatusCodes = require("../../lib/datamodel/opcua_status_code").StatusCodes;

var read_service= require("../../lib/services/read_service");
var browse_service = require("../../lib/services/browse_service");
var subscription_service = require("../../lib/services/subscription_service");

var s = require("../../lib/datamodel/structures");
var ec = require("../../lib/encode_decode");
var hexDump = require("../../lib/utils").hexDump;

describe("testing subscription objects",function(){
    var encode_decode_round_trip_test = require("./../utils/encode_decode_round_trip_test").encode_decode_round_trip_test;

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
                    itemToMonitor: { // ReadValue
                        nodeId: ec.makeNodeId("i:100")
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
        encode_decode_round_trip_test(request);
        done();
    });


    describe("testing subscription services data structure from the field", function() {

        var makebuffer = require("../../lib/utils").makebuffer;
        var redirectToFile = require("../../lib/utils").redirectToFile;
        var verify_multi_chunk_message= require("./../utils/verify_message_chunk").verify_multi_chunk_message;
        it("should decode a real CreateMonitoredItemsRequest ",function(done){

          // a real OpenSecureChannelRequest message chunk
          var ws_CreateMonitoredItemsRequest = makebuffer(
            "4d 53 47 46 84 00 00 00 01 00 00 00 01 00 00 00 5f 00 00 00 2d 00 00 00 01 00 ef 02 05 00 00 10 " +
            "00 00 00 ce 74 00 ff 1f 61 a5 2f a9 ac b1 52 43 30 d4 c1 9b 0f cd 7b 09 4a cf 01 02 05 00 00 00 " +
            "00 00 00 ff ff ff ff 10 27 00 00 00 00 00 03 00 00 00 02 00 00 00 01 00 00 00 01 00 d5 08 0d 00 " +
            "00 00 ff ff ff ff 00 00 ff ff ff ff 02 00 00 00 0b 00 00 00 00 00 00 00 00 70 a7 40 00 00 00 01 " +
            "00 00 00 01"
          );
 
          redirectToFile("CreateMonitoredItemsRequest.log", function () {
             verify_multi_chunk_message([ws_CreateMonitoredItemsRequest]);
          }, done);

      });
      it("should decode a real CreateMonitoredItemResponse",function(done) {
         var ws_CreateMonitoredItemsResponse = makebuffer(

"4d 53 47 46 53 00 00 00 fb 58 70 00 01 00 00 00 3a 00 00 00 08 00 00 00 01 00 f2 02 d0 21 53 68 " + //   MSGFS...{Xp.....:.........r.P!Sh
"17 51 cf 01 08 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 01 00 00 00 00 00 39 80 00 00 00 00 " + //     .QO.......................9.....
"00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00"
         );

          redirectToFile("CreateMonitoredItemsResponse.log", function () {
             verify_multi_chunk_message([ws_CreateMonitoredItemsResponse]);
          }, done);
    });




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
            responseHeader: { serviceResult: StatusCodes.Good },
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
        var obj = new subscription_service.SetPublishingModeResponse({
            results: [
                StatusCodes.Bad_ApplicationSignatureInvalid,
                StatusCodes.Good
            ]
        });
        assert(obj instanceof subscription_service.SetPublishingModeResponse);
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
                sequenceNumber: 4,
                publishTime: new Date(),
                notificationData: null // DataChange or EventNotificiation
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

    it("should encode and decode a ModifyMonitoredItemsRequest",function(done){
        var obj = new subscription_service.ModifyMonitoredItemsRequest({

        });
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a ModifyMonitoredItemsResponse",function(done){
        var obj = new subscription_service.ModifyMonitoredItemsResponse({

        });
        encode_decode_round_trip_test(obj);
        done();
    });


});

var _ = require("underscore");
var build_client_server_session = require("./../utils/build_client_server_session").build_client_server_session;

describe("testing basic Client Server dealing with subscription at low level",function(){
    var server,g_session ;
    var self = this;
    var client_server;

    before(function(done){

        client_server = build_client_server_session(function(){
            g_session = client_server.g_session;
            done();
        });

    });

    after(function(done){
        client_server.shutdown(done);
    });

    it("server should create a subscription (CreateSubscriptionRequest)",function(done){
        var s = require("../../lib/datamodel/structures");

        // CreateSubscriptionRequest
        var request = new subscription_service.CreateSubscriptionRequest({
            requestedPublishingInterval: 100,
            requestedLifetimeCount:      100 * 60 * 10 ,
            requestedMaxKeepAliveCount:  2,
            maxNotificationsPerPublish:  2,
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
    it("server should create a monitored item  (CreateMonitoredItems)",function(done){

        var VariableIds =require("../../lib/opcua_node_ids").VariableIds;

        // CreateMonitoredItemsRequest
        var request = new subscription_service.CreateMonitoredItemsRequest({
            subscriptionId: 1,
            timestampsToReturn: read_service.TimestampsToReturn.Both,
            itemsToCreate:  [
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
        g_session.createMonitoredItems(request,function(err,response){
            if(!err) {
                assert(response instanceof subscription_service.CreateMonitoredItemsResponse);
            }
            done(err);
        });
    });

    it("server should handle Publish request",function(done){
        var self = this;

        // publish request now requires a subscriptions
        var request = new subscription_service.PublishRequest({
            subscriptionAcknowledgements: []
        });
        g_session.publish(request,function(err,response){

            if(!err) {
                assert(response instanceof subscription_service.PublishResponse);

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


    it("server should handle DeleteSubscriptionsRequest",function(done){

        var request = new subscription_service.DeleteSubscriptionsRequest({
            subscriptionIds: [1,2]
        });
        g_session.deleteSubscriptions(request,function(err,response){
            if(!err) {
                assert(response instanceof subscription_service.DeleteSubscriptionsResponse);
            }
            done(err);
        });
    });
});
