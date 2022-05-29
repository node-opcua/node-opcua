"use strict";

const async = require("async");
const should = require("should");
const sinon = require("sinon");

const opcua = require("node-opcua");

const OPCUAClient = opcua.OPCUAClient;
const ClientSubscription = opcua.ClientSubscription;
const StatusCodes = opcua.StatusCodes;
const DataType = opcua.DataType;
const VariantArrayType = opcua.VariantArrayType;

const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");
const { perform_operation_on_subscription } = require("../../test_helpers/perform_operation_on_client_session");

module.exports = function(test) {

    describe("SubscriptionDiagnostics", function() {


        it("SubscriptionDiagnostics-1 : server should expose SubscriptionDiagnosticsArray", function(done) {

            const client = OPCUAClient.create();
            const endpointUrl = test.endpointUrl;

            // Given a connected client and a subscription
            perform_operation_on_subscription(client, endpointUrl, function(session, subscription, inner_done) {

                // find the session diagnostic info...
                const relativePath = "/Objects/Server.ServerDiagnostics.SubscriptionDiagnosticsArray";

                console.log("subscriptionid", subscription.subscriptionId);

                function m(name) {
                    return "1:" + name
                }
                const browsePath = [
                    opcua.makeBrowsePath("RootFolder", relativePath),
                    opcua.makeBrowsePath("RootFolder", relativePath + ".1:" + subscription.subscriptionId)
                ];
                session.translateBrowsePath(browsePath, function(err, result) {
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
                        function(callback) {

                            const subscriptionDiagnosticNodeId = result[1].targets[0].targetId;
                            session.read({
                                nodeId: subscriptionDiagnosticNodeId,
                                attributeId: opcua.AttributeIds.Value
                            }, function(err, dataValue) {

                                if (err) { return callback(err); }

                                dataValue.statusCode.should.eql(StatusCodes.Good);
                                dataValue.value.dataType.should.eql(DataType.ExtensionObject);
                                dataValue.value.arrayType.should.eql(VariantArrayType.Scalar);
                                dataValue.value.value.constructor.name.should.eql("SubscriptionDiagnosticsDataType");

                                //Xx console.log(results[0]);
                                callback();

                            });
                        },

                        function(callback) {

                            // reading SubscriptionDiagnosticsArray should return an array of extension object
                            const subscriptionDiagnosticArrayNodeId = result[0].targets[0].targetId;
                            session.read({
                                nodeId: subscriptionDiagnosticArrayNodeId,
                                attributeId: opcua.AttributeIds.Value
                            }, function(err, dataValue) {
                                if (err) { return callback(err); }

                                dataValue.statusCode.should.eql(StatusCodes.Good);
                                dataValue.value.dataType.should.eql(DataType.ExtensionObject);
                                dataValue.value.arrayType.should.eql(VariantArrayType.Array);

                                dataValue.value.value.length.should.be.greaterThan(0,
                                    "the SubscriptionDiagnosticsArray must expose at least one value");

                                const lastIndex = dataValue.value.value.length - 1;
                                dataValue.value.value[0].constructor.name.should.eql("SubscriptionDiagnosticsDataType",
                                    "the value inside the array  must be of type SubscriptionDiagnosticsDataType");

                                //xx console.log(dataValue.value.value[0]);
                                //xx console.log(session);

                                const sessionDiagnostic = dataValue.value.value[lastIndex];

                                const expectedSessionId = session.sessionId;
                                sessionDiagnostic.sessionId.toString().should.eql(expectedSessionId.toString(),
                                    "the session diagnostic should expose the correct sessionId");

                                callback();

                            });

                        }

                    ], inner_done);
                });

            }, done);


        });

        function readSubscriptionDiagnosticArray(session, callback) {
            const subscriptionDiagnosticArrayNodeId = "ns=0;i=2290";
            session.read({
                nodeId: subscriptionDiagnosticArrayNodeId,
                attributeId: opcua.AttributeIds.Value
            }, function(err, dataValue) {
                if (err) { return callback(err); }
                dataValue.statusCode.should.eql(StatusCodes.Good);
                callback(null, dataValue.value.value);
            });

        }
        it("SubscriptionDiagnostics-2 : server should remove SubscriptionDiagnostics from SubscriptionDiagnosticsArray when subscription is terminated", function(done) {

            const client = OPCUAClient.create();
            const endpointUrl = test.endpointUrl;

            let subscriptionDiagnosticArrayLengthBefore = 0;
            // Given a connected client and a subscription
            perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {
                let subscription;
                async.series([

                    // I should verify that "ns=0;i=2290" (SubscriptionDiagnosticsArray) expose no SubscriptionDiagnostics anympore
                    function(callback) {
                        readSubscriptionDiagnosticArray(session, function(err, subscriptionDiagnosticArray) {
                            if (err) { return callback(err); }

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
                        subscription = ClientSubscription.create(session, {
                            requestedPublishingInterval: 100,
                            requestedLifetimeCount: 10 * 60,
                            requestedMaxKeepAliveCount: 5,
                            maxNotificationsPerPublish: 2,
                            publishingEnabled: true,
                            priority: 6
                        });
                        subscription.on("started", function() {
                            callback();
                        });
                    },

                    // I should verify that "ns=0;i=2290" (SubscriptionDiagnosticsArray) expose one SubscriptionDiagnostics
                    function(callback) {

                        readSubscriptionDiagnosticArray(session, function(err, subscriptionDiagnosticArray) {
                            if (err) { return callback(err); }
                            subscriptionDiagnosticArray.length.should.eql(subscriptionDiagnosticArrayLengthBefore + 1);
                            callback();
                        });
                    },

                    // When the subscription is delete
                    function(callback) {
                        subscription.terminate(function(err) {
                            // ignore errors
                            if (err) { console.log(err.message); }
                            callback();
                        });
                    },
                    // I should verify that "ns=0;i=2290" (SubscriptionDiagnosticsArray) expose no SubscriptionDiagnostics anympore
                    function(callback) {
                        readSubscriptionDiagnosticArray(session, function(err, subscriptionDiagnosticArray) {
                            if (err) { return callback(err); }
                            subscriptionDiagnosticArray.length.should.eql(subscriptionDiagnosticArrayLengthBefore + 0);
                            callback();
                        });
                    }

                ], inner_done);
            }, done);
        });
        it("SubscriptionDiagnostics-3 : server should remove SubscriptionDiagnostics from SubscriptionDiagnosticsArray when subscription has timedout", function(done) {
            const client = OPCUAClient.create();
            const endpointUrl = test.endpointUrl;

            let subscriptionDiagnosticArrayLengthBefore = 0;

            function checkSubscriptionExists(session, subscriptionId, callback) {
                const setMonitoringModeRequest = {
                    subscriptionId: subscriptionId
                };
                session.setMonitoringMode(setMonitoringModeRequest, function(err) {
                    const exists = !err || !(err.message.match(/BadSubscriptionIdInvalid/));
                    callback(null, exists);
                });
            }

            let subscriptionId = null;
            let subscriptionTimeOut = 0;

            // Given a connected client and a subscription
            perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {
                let subscription;
                async.series([

                    // I should verify that "ns=0;i=2290" (SubscriptionDiagnosticsArray) expose no SubscriptionDiagnostics anympore
                    function(callback) {
                        readSubscriptionDiagnosticArray(session, function(err, subscriptionDiagnosticArray) {
                            if (err) { return callback(err); }

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
                        const options = {
                            requestedPublishingInterval: 100,
                            requestedLifetimeCount: 10,
                            requestedMaxKeepAliveCount: 5,
                            maxNotificationsPerPublish: 2,
                            publishingEnabled: true,
                            priority: 6
                        };
                        session.createSubscription(options, function(err, results) {
                            if (err) { return callback(err); }
                            //xx console.log(results.toString());
                            subscriptionId = results.subscriptionId;
                            subscriptionTimeOut = results.revisedPublishingInterval * results.revisedLifetimeCount;
                            callback(null);
                        });
                    },

                    // I should verify that "ns=0;i=2290" (SubscriptionDiagnosticsArray) expose one SubscriptionDiagnostics
                    function(callback) {

                        readSubscriptionDiagnosticArray(session, function(err, subscriptionDiagnosticArray) {
                            if (err) { return callback(err); }
                            subscriptionDiagnosticArray.length.should.eql(subscriptionDiagnosticArrayLengthBefore + 1);
                            callback();
                        });
                    },
                    // I should verify that the subscription DO EXIST on the server side (
                    function(callback) {

                        checkSubscriptionExists(session, subscriptionId, function(err, exists) {
                            if (!exists) {
                                return callback(new Error("Subscription should exist"));
                            }
                            callback(err);
                        });

                    },

                    // When the subscription timeout
                    function(callback) {
                        // prevent our client to answer and process keep-alive

                        const time_to_wait_to_make_subscription_to_time_out = subscriptionTimeOut + 2000;
                        setTimeout(callback, time_to_wait_to_make_subscription_to_time_out);
                    },

                    // I should verify that the subscription no longer exists on the server side (
                    function(callback) {

                        checkSubscriptionExists(session, subscriptionId, function(err, exists) {
                            if (exists) {
                                return callback(new Error("Subscription should have timed out"));
                            }
                            callback(err);
                        });

                    },
                    // and I should verify that "ns=0;i=2290" (SubscriptionDiagnosticsArray) expose no SubscriptionDiagnostics anympore
                    function(callback) {
                        readSubscriptionDiagnosticArray(session, function(err, subscriptionDiagnosticArray) {
                            if (err) { return callback(err); }
                            subscriptionDiagnosticArray.length.should.eql(subscriptionDiagnosticArrayLengthBefore + 0,
                                "sSubscriptionDiagnostic of subscription that reach their timeout prior to be explicitly terminate shall be deleted ");
                            callback();
                        });
                    }

                ], inner_done);
            }, done);



        });
    });
};



