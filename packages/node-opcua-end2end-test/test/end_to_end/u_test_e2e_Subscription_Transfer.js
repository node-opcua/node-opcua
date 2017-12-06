// Description: CloseSession while specifying DeleteSubscriptions=FALSE. Create a subscription with 1 monitored item.
// When the session is closed, we are JUST going to close the Session. The subscription and monitoredItem will NOT be cleaned-up.
// We'll then create another session. We'll try to TRANSFER the subscription to the new session. We're expecting the subscription to be present!
// We ARE checking if TransferSubscription is Bad_NotImplemented. If so, then the test result is a Warning with a message of Inconclusive. */
/*global it,describe,beforeEach*/
"use strict";
var async = require("async");
var should = require("should");
var sinon = require("sinon");

var opcua = require("node-opcua");
var StatusCodes = opcua.StatusCodes;
var OPCUAClient = opcua.OPCUAClient;
var ClientSubscription = opcua.ClientSubscription;


var perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

var perform_operation_on_subscription = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_subscription;

module.exports = function (test) {

    describe("#TSS TransferSessionService", function () {

        var endpointUrl;
        beforeEach(function (done) {
            endpointUrl = test.endpointUrl;
            done();
        });
        var subscription;

        var spy_on_terminated = new sinon.spy();

        function create_subscription_and_close_session(callback) {

            var client = new OPCUAClient();
            var the_subscriptionId;

            var the_session;

            async.series([

                function (callback) {
                    client.connect(endpointUrl, function (err) {
                        callback(err);
                    });
                },

                // create session
                function (callback) {
                    client.createSession(function (err, session) {
                        if (!err) {
                            the_session = session;
                        }
                        callback(err);
                    });
                },

                function (callback) {
                    subscription = new ClientSubscription(the_session, {
                        requestedPublishingInterval: 100,
                        requestedLifetimeCount: 10 * 60,
                        requestedMaxKeepAliveCount: 5,
                        maxNotificationsPerPublish: 2,
                        publishingEnabled: true,
                        priority: 6
                    });
                    subscription.on("started", function () {
                        the_subscriptionId = subscription.subscriptionId;
                        subscription.on("terminated", spy_on_terminated);
                        callback();
                    });
                },

                // closing session
                function (callback) {
                    the_session.close(/*deleteSubscription=*/false, function (err) {
                        callback(err);
                    });
                },
                function (callback) {
                    client.disconnect(callback);
                }
            ], function (err) {
                callback(err, the_subscriptionId);
            });
        }

        it("TSS-1 should transfer a subscription", function (done) {

            var the_subscriptionId;
            async.series([

                function (callback) {
                    create_subscription_and_close_session(function (err, subscriptionId) {
                        the_subscriptionId = subscriptionId;
                        callback(err);
                    });
                },
                function (callback) {
                    console.log("SubscriptionId ", the_subscriptionId);
                    callback();
                },
                function (callback) {
                    var client2 = new OPCUAClient();
                    perform_operation_on_client_session(client2, endpointUrl, function (session, done) {

                        session.transferSubscriptions({
                            subscriptionIds: [the_subscriptionId],
                            sendInitialValues: true
                        }, function (err, response) {

                            spy_on_terminated.callCount.should.eql(0);
                            response.results.length.should.eql(1);
                            console.log(" => ", response.results[0].toString());

                            subscription.terminate();
                            done(err);
                        });
                    }, function (err) {

                        if (!err) {
                            spy_on_terminated.callCount.should.eql(1);
                        }
                        callback(err);
                    });
                }
            ], done);
        });

        it("TSS-2 should transfer a subscription from a live session to an other", function (done) {

            var client = new OPCUAClient();

            var the_subscriptionId;

            var the_session1;
            var the_session2;

            async.series([

                function (callback) {
                    client.connect(endpointUrl, function (err) {
                        callback(err);
                    });
                },

                // create session
                function (callback) {
                    client.createSession(function (err, session) {
                        if (!err) {
                            the_session1 = session;
                        }
                        callback(err);
                    });
                },

                function (callback) {

                    subscription = new ClientSubscription(the_session1, {
                        requestedPublishingInterval: 100,
                        requestedLifetimeCount: 10 * 60,
                        requestedMaxKeepAliveCount: 5,
                        maxNotificationsPerPublish: 2,
                        publishingEnabled: true,
                        priority: 6
                    });

                    subscription.on("started", function () {
                        the_subscriptionId = subscription.subscriptionId;
                        subscription.on("terminated", spy_on_terminated);
                        callback();
                    });
                },

                // create session 2
                function (callback) {
                    client.createSession(function (err, session) {
                        if (!err) {
                            the_session2 = session;
                        }
                        callback(err);
                    });
                },

                // session2.transferSubscriptions
                function (callback) {
                    var options = {
                        subscriptionIds: [the_subscriptionId],
                        sendInitialValues: true
                    };
                    the_session2.transferSubscriptions(options, function (err, response) {
                        //xx console.log("response",response.toString());
                        response.results.length.should.eql(1);
                        response.results[0].statusCode.should.eql(StatusCodes.Good);
                        if (!err) {
                        }
                        callback(err);
                    });
                },

                // deleting subscription on session1 shall fail
                function (callback) {

                    var options = {
                        subscriptionIds: [the_subscriptionId]
                    };

                    the_session1.deleteSubscriptions(options, function (err, response) {
                        response.results.length.should.eql(1);
                        response.results[0].should.eql(StatusCodes.BadSubscriptionIdInvalid);
                    });

                    callback();
                },

                // deleting subscription on session2 shall succeed
                function (callback) {

                    var options = {
                        subscriptionIds: [the_subscriptionId]
                    };

                    the_session2.deleteSubscriptions(options, function (err, response) {
                        response.results.length.should.eql(1);
                        response.results[0].should.eql(StatusCodes.Good);
                    });

                    callback();
                },


                // closing session 1
                function (callback) {
                    the_session1.close(/*deleteSubscription=*/true, function (err) {
                        callback(err);
                    });
                },

                // closing session 2
                function (callback) {
                    the_session2.close(/*deleteSubscription=*/true, function (err) {
                        callback(err);
                    });
                },
                function (callback) {
                    client.disconnect(callback);
                }
            ], done);

        });

        it("TSS-3 should send a StatusChangeNotification to the old session with GoodSubscriptionTransferred", function (done) {
            var client = new OPCUAClient();
            var spy_status_changed = new sinon.spy();
            var the_session2;
            var spy_keepalive = new sinon.spy();

            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, inner_done) {

                subscription.on("status_changed", spy_status_changed);
                subscription.on("keepalive", spy_keepalive);
                async.series([
                    function (callback) {

                        setTimeout(function () {
                            console.log("StatusChange Count ", spy_status_changed.callCount, " keepAlive count = ", spy_keepalive.callCount);
                            spy_status_changed.callCount.should.eql(0);
                            spy_keepalive.callCount.should.be.greaterThan(1);
                            callback();
                        }, 1500);
                    },
                    function (callback) {
                        client.createSession(function (err, session) {
                            if (!err) {
                                the_session2 = session;
                            }
                            callback(err);
                        });
                    },

                    function (callback) {
                        setTimeout(callback, 500);
                    },

                    // session2.transferSubscriptions
                    function (callback) {
                        var options = {
                            subscriptionIds: [subscription.subscriptionId],
                            sendInitialValues: true
                        };
                        the_session2.transferSubscriptions(options, function (err, response) {
                            //xx console.log("response",response.toString());
                            response.results.length.should.eql(1);
                            response.results[0].statusCode.should.eql(StatusCodes.Good);
                            if (!err) {
                            }
                            callback(err);
                        });
                    },

                    function (callback) {
                        setTimeout(function () {
                            console.log("StatusChange Count ", spy_status_changed.callCount, " keepAlive count = ", spy_keepalive.callCount);
                            spy_status_changed.callCount.should.eql(1);
                            callback();
                        }, 1000);
                    },
                    function (callback) {
                        the_session2.close(callback);
                    }

                ], function (err) {
                    console.log("-------------------", subscription.subscriptionId);
                    inner_done(err);
                });

            }, done);

        });

        it("TSS-4 should resend initialValue on monitored Item", function (done) {

            var client = new OPCUAClient();
            var the_session2;

            var itemToMonitor = new opcua.read_service.ReadValueId({
                nodeId: "ns=411;s=Scalar_Static_Double",
                attributeId: opcua.AttributeIds.Value
            });

            var parameters = {
                clientHandle: 26,
                samplingInterval: 250,
                discardOldest: false,
                queueSize: 10,
                filter: null
            };


            var spy_publish_session1 = new sinon.spy();
            var spy_publish_session2 = new sinon.spy();

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var subscriptionId;
                async.series([

                    // Create Subscription on session1
                    function (callback) {
                        var request = new opcua.subscription_service.CreateSubscriptionRequest({
                            requestedPublishingInterval: 100,
                            requestedLifetimeCount: 1000,
                            requestedMaxKeepAliveCount: 30,
                            maxNotificationsPerPublish: 2000,
                            publishingEnabled: true,
                            priority: 6
                        });
                        session.createSubscription(request, function (err, response) {
                            if (err) {
                                return callback(err);
                            }
                            subscriptionId = response.subscriptionId;
                            callback();
                        });
                    },

                    // Create MonitoredItem on session1 with many publish request in queue
                    function (callback) {
                        // CreateMonitoredItemsRequest
                        var request = new opcua.subscription_service.CreateMonitoredItemsRequest({
                            subscriptionId: subscriptionId,
                            timestampsToReturn: opcua.read_service.TimestampsToReturn.Both,
                            itemsToCreate: [
                                {
                                    itemToMonitor: itemToMonitor,
                                    monitoringMode: opcua.subscription_service.MonitoringMode.Reporting,
                                    requestedParameters: parameters
                                }
                            ]
                        });

                        session.createMonitoredItems(request, function (err, response) {

                            response.should.be.instanceof(opcua.subscription_service.CreateMonitoredItemsResponse);
                            response.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                            response.results.length.should.eql(1);
                            response.results[0].statusCode.should.eql(StatusCodes.Good);
                            response.results[0].revisedSamplingInterval.should.eql(250);

                            // send many publish requests, in one go
                            session.publish({}, spy_publish_session1);
                            session.publish({}, spy_publish_session1);
                            session.publish({}, spy_publish_session1);
                            session.publish({}, spy_publish_session1);
                            session.publish({}, spy_publish_session1);
                            session.publish({}, spy_publish_session1);

                            callback(err);
                        });
                    },
                    // wait a little bit
                    function (callback) {
                        setTimeout(function () {
                            callback();
                        }, parameters.samplingInterval);
                    },

                    // create Session 2
                    function (callback) {
                        client.createSession(function (err, l_session) {
                            if (!err) {
                                the_session2 = l_session;
                            }
                            callback(err);
                        });
                    },

                    // session2.transferSubscriptions
                    function (callback) {
                        var options = {
                            subscriptionIds: [subscriptionId],
                            sendInitialValues: true
                        };
                        the_session2.transferSubscriptions(options, function (err, response) {
                            //xx console.log("response",response.toString());
                            response.results.length.should.eql(1);
                            response.results[0].statusCode.should.eql(StatusCodes.Good);
                            if (!err) {
                            }
                            callback(err);
                        });
                    },

                    // wait a little bit
                    function (callback) {
                        setTimeout(function () {
                            callback();
                        }, parameters.samplingInterval);
                    },

                    // session 1 should receive StatusChangeNotification
                    function (callback) {

                        console.log("count = ", spy_publish_session1.callCount);

                        var response0 = spy_publish_session1.getCall(0).args[1];
                        //xx console.log("response=",response0.toString());
                        response0.notificationMessage.notificationData.length.should.eql(1);
                        response0.subscriptionId.should.eql(subscriptionId);
                        var notification0 = response0.notificationMessage.notificationData[0];
                        notification0.constructor.name.should.eql("DataChangeNotification");

                        var response1 = spy_publish_session1.getCall(1).args[1];
                        //xx console.log("response=",response1.toString());
                        response1.notificationMessage.notificationData.length.should.eql(1);
                        response1.subscriptionId.should.eql(subscriptionId);
                        var notification1 = response1.notificationMessage.notificationData[0];
                        notification1.constructor.name.should.eql("StatusChangeNotification");

                        callback();
                    },


                    function (callback) {
                        the_session2.publish({}, spy_publish_session2);
                        the_session2.publish({}, spy_publish_session2);
                        the_session2.publish({}, spy_publish_session2);
                        the_session2.publish({}, spy_publish_session2);
                        callback();
                    },

                    // wait a little bit
                    function (callback) {
                        setTimeout(function () {
                            callback();
                        }, parameters.samplingInterval);
                    },
                    // wait a little bit
                    function (callback) {
                        setTimeout(function () {
                            callback();
                        }, parameters.samplingInterval);
                    },

                    function (callback) {
                        console.log("count = ", spy_publish_session2.callCount);

                        var response0 = spy_publish_session2.getCall(0).args[1];
                        //xx console.log("response=",response0.toString());
                        response0.notificationMessage.notificationData.length.should.eql(1);
                        response0.subscriptionId.should.eql(subscriptionId);
                        var notification0 = response0.notificationMessage.notificationData[0];
                        notification0.constructor.name.should.eql("DataChangeNotification");

                        callback();

                    },

                    // now delete subscription
                    function (callback) {
                        the_session2.deleteSubscriptions({subscriptionIds: [subscriptionId]}, callback);
                    },

                    function (callback) {
                        the_session2.close(callback);
                    },
                    function (callback) {
                        console.log("count = ", spy_publish_session2.callCount);
                        spy_publish_session2.callCount.should.eql(4);

                        var response1 = spy_publish_session2.getCall(1).args[1];
                        var response2 = spy_publish_session2.getCall(2).args[1];
                        var response3 = spy_publish_session2.getCall(3).args[1];

                        response1.responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
                        response2.responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
                        response3.responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
                        //xx console.log(response1.toString())
                        //xx console.log(response2.toString())
                        //xx console.log(response3.toString())
                        callback();
                    }
                ], function (err) {
                    console.log("-------------------", subscriptionId);
                    inner_done(err);
                });

            }, done);

        });

    });

};

