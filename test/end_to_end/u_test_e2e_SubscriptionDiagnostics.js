/*global xit,it,describe,before,after,beforeEach,afterEach*/
"use strict";

require("requirish")._(module);


var assert = require("better-assert");
var async = require("async");
var should = require("should");
var sinon = require("sinon");

var opcua = require("index.js");

var OPCUAClient = opcua.OPCUAClient;
var ClientSession = opcua.ClientSession;
var ClientSubscription = opcua.ClientSubscription;
var AttributeIds = opcua.AttributeIds;
var resolveNodeId = opcua.resolveNodeId;
var StatusCodes = opcua.StatusCodes;
var DataType = opcua.DataType;
var TimestampsToReturn = opcua.read_service.TimestampsToReturn;
var MonitoringMode = opcua.subscription_service.MonitoringMode;
var makeNodeId = opcua.makeNodeId;

var MonitoredItem = require("lib/server/monitored_item").MonitoredItem;

var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var perform_operation_on_subscription = require("test/helpers/perform_operation_on_client_session").perform_operation_on_subscription;
var perform_operation_on_monitoredItem = require("test/helpers/perform_operation_on_client_session").perform_operation_on_monitoredItem;



module.exports = function (test) {

    describe("SubscriptionDiagnostics", function () {

        it("SubscriptionDiagnostics : server should maintain dataChangeNotificationsCount", function (done) {

            var client = new OPCUAClient();
            var endpointUrl = test.endpointUrl;
            //xx var endpointUrl = "opc.tcp://localhost:12111";
            //xx var endpointUrl =  "opc.tcp://KANARY:26543";

            // Given a connected client and a subscription
            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, inner_done) {

                // find the session diagnostic info...

                console.log(" getting diagnostic for subscription.id=",subscription.subscriptionId);
                var relativePath = "/Objects/Server.ServerDiagnostics.SubscriptionDiagnosticsArray";

                var browsePath = [
                    opcua.browse_service.makeBrowsePath("RootFolder",relativePath),
                    opcua.browse_service.makeBrowsePath("RootFolder",relativePath+"."+ subscription.subscriptionId)
                ];
                session.translateBrowsePath(browsePath,function(err,result) {
                    //xx console.log("Result = ",result.toString());
                    if (!err) {
                        //
                        // ... Work in progress ...
                    }
                    inner_done();
                });


            }, done);


        });
    });
};



