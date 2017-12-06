/*global xit,it,describe,before,after,beforeEach,afterEach*/
"use strict";




var assert = require("node-opcua-assert");
var async = require("async");
var should = require("should");
var sinon = require("sinon");

var opcua = require("node-opcua");

var OPCUAClient = opcua.OPCUAClient;
var ClientSubscription = opcua.ClientSubscription;
var StatusCodes = opcua.StatusCodes;
var DataType = opcua.DataType;
var VariantArrayType = opcua.VariantArrayType;

var perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var perform_operation_on_subscription = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_subscription;

module.exports = function (test) {

    describe("SubscriptionDiagnostics", function () {


        it("SubscriptionDiagnostics-1 : server should expose SubscriptionDiagnosticsArray", function (done) {

            var client = new OPCUAClient();
            var endpointUrl = test.endpointUrl;

            // Given a connected client and a subscription
            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, inner_done) {

                // find the session diagnostic info...

                console.log(" getting diagnostic for subscription.id=", subscription.subscriptionId);

                var relativePath = "/Objects/Server.ServerDiagnostics.SubscriptionDiagnosticsArray";

                var browsePath = [
                    opcua.makeBrowsePath("RootFolder", relativePath),
                    opcua.makeBrowsePath("RootFolder", relativePath + "." + subscription.subscriptionId)
                ];
                session.translateBrowsePath(browsePath, function (err, result) {
                    //xx console.log("Result = ", result.toString());
                    if (err) {
                        return inner_done(err);
                    }

                    // we should have a SubscriptionDiagnosticsArray

                    result[0].statusCode.should.eql(StatusCodes.Good,
                      "server should expose a SubscriptionDiagnosticsArray node");

                    result[0].targets[0].targetId.toString().should.eql("ns=0;i=2290",
                      "SubscriptionDiagnosticsArray must have well known node id i=2290"); //

                    // SubscriptionDiagnosticsArray must expose the SubscriptionDiagnostics node of the current session
                    result[1].statusCode.should.eql(StatusCodes.Good,
                      "SubscriptionDiagnosticsArray should expose a SubscriptionDiagnostics node");

                    result[1].targets[0].targetId.namespace.should.eql(1,
                      "SubscriptionDiagnostics nodeId must be in namespace 1"); //


                    async.series([

                        // it should expose the SubscriptionDiagnostics of the session
                        function (callback) {

                            var subscriptionDiagnosticNodeId = result[1].targets[0].targetId;
                            session.read([{
                                nodeId: subscriptionDiagnosticNodeId,
                                attributeId: opcua.AttributeIds.Value
                            }], function (err, nodesToRead, results) {

                                if(err) {return callback(err);}

                                var dataValue = results[0];
                                dataValue.statusCode.should.eql(StatusCodes.Good);
                                dataValue.value.dataType.should.eql(DataType.ExtensionObject);
                                dataValue.value.arrayType.should.eql(VariantArrayType.Scalar);
                                dataValue.value.value.constructor.name.should.eql("SubscriptionDiagnostics");

                                //Xx console.log(results[0]);
                                callback();

                            });
                        },

                        function (callback) {

                            // reading SubscriptionDiagnosticsArray should return an array of extension object
                            var subscriptionDiagnosticArrayNodeId = result[0].targets[0].targetId;
                            session.read([{
                                nodeId: subscriptionDiagnosticArrayNodeId,
                                attributeId: opcua.AttributeIds.Value
                            }], function (err, nodesToRead, results) {
                                if(err) {return callback(err);}

                                var dataValue = results[0];
                                dataValue.statusCode.should.eql(StatusCodes.Good);
                                dataValue.value.dataType.should.eql(DataType.ExtensionObject);
                                dataValue.value.arrayType.should.eql(VariantArrayType.Array);

                                dataValue.value.value.length.should.be.greaterThan(0,
                                    "the SubscriptionDiagnosticsArray must expose at least one value");

                                var lastIndex = dataValue.value.value.length -1;
                                dataValue.value.value[0].constructor.name.should.eql("SubscriptionDiagnostics",
                                  "the value inside the array  must be of type SubscriptionDiagnostics");

                                //xx console.log(dataValue.value.value[0]);
                                //xx console.log(session);

                                var sessionDiagnostic = dataValue.value.value[lastIndex];

                                var expectedSessionId = session.sessionId;
                                sessionDiagnostic.sessionId.toString().should.eql(expectedSessionId.toString(),
                                    "the session diagnostic should expose the correct sessionId");

                                callback();

                            });

                        }

                    ], inner_done);
                });

            }, done);


        });

        function  readSubscriptionDiagnosticArray(session,callback) {
            var subscriptionDiagnosticArrayNodeId = "ns=0;i=2290";
            session.read([{
                nodeId: subscriptionDiagnosticArrayNodeId,
                attributeId: opcua.AttributeIds.Value
            }], function (err, nodesToRead, results) {
                if (err) {return callback(err);}
                results[0].statusCode.should.eql(StatusCodes.Good);
                callback(null,results[0].value.value);
            });

        }
        it("SubscriptionDiagnostics-2 : server should remove SubscriptionDiagnostics from SubscriptionDiagnosticsArray when subscription is terminated", function (done) {

            var client = new OPCUAClient();
            var endpointUrl = test.endpointUrl;

            var subscriptionDiagnosticArrayLengthBefore = 0;
            // Given a connected client and a subscription
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                var subscription;
                async.series([

                    // I should verify that "ns=0;i=2290" (SubscriptionDiagnosticsArray) expose no SubscriptionDiagnostics anympore
                    function(callback) {
                        readSubscriptionDiagnosticArray(session,function(err,subscriptionDiagnosticArray)  {
                            if (err) {return callback(err);}

                            subscriptionDiagnosticArrayLengthBefore = subscriptionDiagnosticArray.length;
                            if (subscriptionDiagnosticArray.length) {
                                console.log(" Warning : subscriptionDiagnosticArray is not zero : " +
                                  "it  looks like subscriptions have not been closed propertly by previous running test")
                            }
                            //subscriptionDiagnosticArray.length.should.eql(0,"expecting no subscriptionDiagnosticArray");
                            callback();
                        });
                    },
                    // when a subscription is created
                    function(callback) {
                        subscription = new ClientSubscription(session, {
                            requestedPublishingInterval: 100,
                            requestedLifetimeCount: 10 * 60,
                            requestedMaxKeepAliveCount: 5,
                            maxNotificationsPerPublish: 2,
                            publishingEnabled: true,
                            priority: 6
                        });
                        subscription.on("started", function () {
                            callback();
                        });
                    },

                    // I should verify that "ns=0;i=2290" (SubscriptionDiagnosticsArray) expose one SubscriptionDiagnostics
                    function(callback) {

                        readSubscriptionDiagnosticArray(session,function(err,subscriptionDiagnosticArray)  {
                            if (err) {return callback(err);}
                            subscriptionDiagnosticArray.length.should.eql(subscriptionDiagnosticArrayLengthBefore+1);
                            callback();
                        });
                    },

                    // When the subscription is delete
                    function (callback) {
                        subscription.terminate(function(err) {
                            // ignore errors
                            if (err) { console.log(err.message);}
                            callback();
                        });
                    },
                    // I should verify that "ns=0;i=2290" (SubscriptionDiagnosticsArray) expose no SubscriptionDiagnostics anympore
                    function(callback) {
                        readSubscriptionDiagnosticArray(session,function(err,subscriptionDiagnosticArray)  {
                            if (err) {return callback(err);}
                            subscriptionDiagnosticArray.length.should.eql(subscriptionDiagnosticArrayLengthBefore+0);
                            callback();
                        });
                    }

                ], inner_done);
            }, done);
        });
        it("SubscriptionDiagnostics-3 : server should remove SubscriptionDiagnostics from SubscriptionDiagnosticsArray when subscription has timedout", function (done) {
            var client = new OPCUAClient();
            var endpointUrl = test.endpointUrl;

            var subscriptionDiagnosticArrayLengthBefore = 0;

            function checkSubscriptionExists(session,subscriptionId, callback){
                var setMonitoringModeRequest = {
                    subscriptionId: subscriptionId
                };
                session.setMonitoringMode(setMonitoringModeRequest, function (err) {
                    var exists = !err ||  !(err.message.match(/BadSubscriptionIdInvalid/));
                    callback(null, exists);
                });
            }

            var subscriptionId  = null;
            var subscriptionTimeOut = 0;

            // Given a connected client and a subscription
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                var subscription;
                async.series([

                    // I should verify that "ns=0;i=2290" (SubscriptionDiagnosticsArray) expose no SubscriptionDiagnostics anympore
                    function(callback) {
                        readSubscriptionDiagnosticArray(session,function(err,subscriptionDiagnosticArray)  {
                            if (err) {return callback(err);}

                            subscriptionDiagnosticArrayLengthBefore = subscriptionDiagnosticArray.length;
                            if (subscriptionDiagnosticArray.length) {
                                console.log(" Warning : subscriptionDiagnosticArray is not zero : " +
                                  "it  looks like subscriptions have not been closed propertly by previous running test")
                            }
                            //subscriptionDiagnosticArray.length.should.eql(0,"expecting no subscriptionDiagnosticArray");
                            callback();
                        });
                    },
                    // when a subscription is created
                    function(callback) {

                        // Note: we use the bare API here as we don't want the keep alive machinery to be used
                        var options ={
                            requestedPublishingInterval: 100,
                            requestedLifetimeCount: 10,
                            requestedMaxKeepAliveCount: 5,
                            maxNotificationsPerPublish: 2,
                            publishingEnabled: true,
                            priority: 6
                        };
                        session.createSubscription(options,function(err,results) {
                            if (err) { return callback(err); }
                            //xx console.log(results.toString());
                            subscriptionId = results.subscriptionId;
                            subscriptionTimeOut = results.revisedPublishingInterval * results.revisedLifetimeCount ;
                            callback(null);
                        });
                    },

                    // I should verify that "ns=0;i=2290" (SubscriptionDiagnosticsArray) expose one SubscriptionDiagnostics
                    function(callback) {

                        readSubscriptionDiagnosticArray(session,function(err,subscriptionDiagnosticArray)  {
                            if (err) {return callback(err);}
                            subscriptionDiagnosticArray.length.should.eql(subscriptionDiagnosticArrayLengthBefore+1);
                            callback();
                        });
                    },
                    // I should verify that the subscription DO EXIST on the server side (
                    function (callback) {

                        checkSubscriptionExists(session,subscriptionId,function(err,exists){
                            if (!exists) {
                                return callback(new Error("Subscription should exist"));
                            }
                            callback(err);
                        });

                    },

                    // When the subscription timeout
                    function (callback) {
                        // prevent our client to answer and process keep-alive

                        var time_to_wait_to_make_subscription_to_time_out = subscriptionTimeOut + 2000;
                        setTimeout(callback,time_to_wait_to_make_subscription_to_time_out);
                    },

                    // I should verify that the subscription no longer exists on the server side (
                    function (callback) {

                        checkSubscriptionExists(session,subscriptionId,function(err,exists){
                            if (exists) {
                                return callback(new Error("Subscription should have timed out"));
                            }
                            callback(err);
                        });

                    },
                    // and I should verify that "ns=0;i=2290" (SubscriptionDiagnosticsArray) expose no SubscriptionDiagnostics anympore
                    function(callback) {
                        readSubscriptionDiagnosticArray(session,function(err,subscriptionDiagnosticArray)  {
                            if (err) {return callback(err);}
                            subscriptionDiagnosticArray.length.should.eql(subscriptionDiagnosticArrayLengthBefore+0,
                              "sSubscriptionDiagnostic of subscription that reach their timeout prior to be explicitly terminate shall be deleted ");
                            callback();
                        });
                    }

                ], inner_done);
            }, done);



        });
    });
};



