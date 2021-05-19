// Description: CloseSession while specifying DeleteSubscriptions=FALSE. Create a subscription with 1 monitored item.
// When the session is closed, we are JUST going to close the Session. The subscription and monitoredItem will NOT be cleaned-up.
// We'll then create another session. We'll try to TRANSFER the subscription to the new session. We're expecting the subscription to be present!
// We ARE checking if TransferSubscription is Bad_NotImplemented. If so, then the test result is a Warning with a message of Inconclusive. 
"use strict";
const async = require("async");
const should = require("should");
const sinon = require("sinon");

const opcua = require("node-opcua");
const StatusCodes = opcua.StatusCodes;
const OPCUAClient = opcua.OPCUAClient;
const ClientSubscription = opcua.ClientSubscription;


const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");

const { perform_operation_on_subscription } = require("../../test_helpers/perform_operation_on_client_session");

module.exports = function (test) {

    describe("#TSS TransferSessionService", function () {

        let endpointUrl;
        beforeEach(function (done) {
            endpointUrl = test.endpointUrl;
            done();
        });
        let subscription;

        const spy_on_terminated = new sinon.spy();

        function create_subscription_and_close_session(callback) {

            const client = OPCUAClient.create();
            let the_subscriptionId;

            let the_session;

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
                    subscription = ClientSubscription.create(the_session, {
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

            let the_subscriptionId;
            async.series([

                function (callback) {
                    create_subscription_and_close_session(function (err, subscriptionId) {
                        the_subscriptionId = subscriptionId;
                        callback(err);
                    });
                },
                function (callback) {
                    //xx console.log("SubscriptionId ", the_subscriptionId);
                    callback();
                },
                function (callback) {
                    const client2 = OPCUAClient.create();
                    perform_operation_on_client_session(client2, endpointUrl, function (session, done) {

                        session.transferSubscriptions({
                            subscriptionIds: [the_subscriptionId],
                            sendInitialValues: true
                        }, function (err, response) {

                            spy_on_terminated.callCount.should.eql(0);
                            response.results.length.should.eql(1);
                            //xx console.log(" => ", response.results[0].toString());

                            subscription.terminate(function (err1) { done(err); });

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

        it("TSS-2 should transfer a subscription from a live session to an other", async () => {

            const client = OPCUAClient.create();

            await client.connect(endpointUrl);

            const the_session1 = await client.createSession();

            subscription = await the_session1.createSubscription2({
                requestedPublishingInterval: 100,
                requestedLifetimeCount: 10 * 60,
                requestedMaxKeepAliveCount: 5,
                maxNotificationsPerPublish: 2,
                publishingEnabled: true,
                priority: 6
            });
            subscription.on("terminated", spy_on_terminated);

            const the_subscriptionId = subscription.subscriptionId;

            const the_session2 = await client.createSession();

            try {
              
                const response = await the_session2.transferSubscriptions({
                    subscriptionIds: [the_subscriptionId],
                    sendInitialValues: true
                });

                //xx console.log("response",response.toString());
                response.results.length.should.eql(1);
                response.results[0].statusCode.should.eql(StatusCodes.Good);


                // deleting subscription on session1 shall fail
                const response1 = await the_session1.deleteSubscriptions({
                    subscriptionIds: [the_subscriptionId]
                });
                response1.results.length.should.eql(1);
                response1.results[0].should.eql(StatusCodes.BadSubscriptionIdInvalid);

                // deleting subscription on session2 shall succeed
                const response3 = await the_session2.deleteSubscriptions({
                    subscriptionIds: [the_subscriptionId]
                });
                response3.results.length.should.eql(1);
                response3.results[0].should.eql(StatusCodes.Good);
            } finally {
                // closing session 1
                await the_session1.close(/*deleteSubscription=*/true);
                await the_session2.close(/*deleteSubscription=*/true);
                await client.disconnect();
            }

        });

        it("TSS-3 should send a StatusChangeNotification to the old session with GoodSubscriptionTransferred", function (done) {
            const client = OPCUAClient.create();
            const spy_status_changed = new sinon.spy();
            let the_session2;
            const spy_keepalive = new sinon.spy();

            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, inner_done) {

                subscription.on("status_changed", spy_status_changed);
                subscription.on("keepalive", spy_keepalive);
                async.series([
                    function (callback) {

                        const timeout = subscription.publishingInterval * 2;
                        setTimeout(function () {
                            //xx console.log("StatusChange Count ", spy_status_changed.callCount, " keepAlive count = ", spy_keepalive.callCount);
                            spy_status_changed.callCount.should.eql(0);
                            spy_keepalive.callCount.should.be.aboveOrEqual(1);
                            callback();
                        }, timeout);
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
                        const options = {
                            subscriptionIds: [subscription.subscriptionId],
                            sendInitialValues: true
                        };
                        the_session2.transferSubscriptions(options, function (err, response) {
                            //xx console.log("response",response.toString());
                            response.results.length.should.eql(1);
                            response.results[0].statusCode.should.eql(StatusCodes.Good);
                            if (!err) {
                                /* */
                            }
                            callback(err);
                        });
                    },

                    function (callback) {
                        setTimeout(function () {
                            //xx console.log("StatusChange Count ", spy_status_changed.callCount, " keepAlive count = ", spy_keepalive.callCount);
                            spy_status_changed.callCount.should.eql(1);
                            callback();
                        }, 1000);
                    },
                    function (callback) {
                        the_session2.close(callback);
                    }

                ], function (err) {
                    //xx console.log("-------------------", subscription.subscriptionId);
                    inner_done(err);
                });

            }, done);

        });

        it("TSS-4 should resend initialValue on monitored Item", function (done) {

            const client = OPCUAClient.create();
            let the_session2;

            const itemToMonitor = new opcua.ReadValueId({
                nodeId: "ns=2;s=Static_Scalar_Double",
                attributeId: opcua.AttributeIds.Value
            });

            const parameters = {
                clientHandle: 26,
                samplingInterval: 250,
                discardOldest: false,
                queueSize: 10,
                filter: null
            };


            const spy_publish_session1 = new sinon.spy();
            const spy_publish_session2 = new sinon.spy();

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                let subscriptionId;
                async.series([

                    // Create Subscription on session1
                    function (callback) {
                        const request = new opcua.CreateSubscriptionRequest({
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
                        const request = new opcua.CreateMonitoredItemsRequest({
                            subscriptionId: subscriptionId,
                            timestampsToReturn: opcua.TimestampsToReturn.Both,
                            itemsToCreate: [
                                {
                                    itemToMonitor: itemToMonitor,
                                    monitoringMode: opcua.MonitoringMode.Reporting,
                                    requestedParameters: parameters
                                }
                            ]
                        });

                        session.createMonitoredItems(request, function (err, response) {

                            response.should.be.instanceof(opcua.CreateMonitoredItemsResponse);
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
                        const options = {
                            subscriptionIds: [subscriptionId],
                            sendInitialValues: true
                        };
                        the_session2.transferSubscriptions(options, function (err, response) {
                            //xx console.log("response",response.toString());
                            response.results.length.should.eql(1);
                            response.results[0].statusCode.should.eql(StatusCodes.Good);
                            if (!err) {
                                /** */
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

                        //xx console.log("count = ", spy_publish_session1.callCount);

                        const response0 = spy_publish_session1.getCall(0).args[1];
                        //xx console.log("response=",response0.toString());
                        response0.notificationMessage.notificationData.length.should.eql(1);
                        response0.subscriptionId.should.eql(subscriptionId);
                        const notification0 = response0.notificationMessage.notificationData[0];
                        notification0.constructor.name.should.eql("DataChangeNotification");

                        const response1 = spy_publish_session1.getCall(1).args[1];
                        //xx console.log("response=",response1.toString());
                        response1.notificationMessage.notificationData.length.should.eql(1);
                        response1.subscriptionId.should.eql(subscriptionId);
                        const notification1 = response1.notificationMessage.notificationData[0];
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
                        //Xx console.log("count = ", spy_publish_session2.callCount);

                        const response0 = spy_publish_session2.getCall(0).args[1];
                        //xx console.log("response=",response0.toString());
                        response0.notificationMessage.notificationData.length.should.eql(1);
                        response0.subscriptionId.should.eql(subscriptionId);
                        const notification0 = response0.notificationMessage.notificationData[0];
                        notification0.constructor.name.should.eql("DataChangeNotification");

                        callback();

                    },

                    // now delete subscription
                    function (callback) {
                        the_session2.deleteSubscriptions({ subscriptionIds: [subscriptionId] }, callback);
                    },

                    function (callback) {
                        the_session2.close(callback);
                    },
                    function (callback) {
                        //xx console.log("count = ", spy_publish_session2.callCount);
                        spy_publish_session2.callCount.should.eql(4);

                        const response1 = spy_publish_session2.getCall(1).args[1];
                        const response2 = spy_publish_session2.getCall(2).args[1];
                        const response3 = spy_publish_session2.getCall(3).args[1];

                        response1.responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
                        response2.responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
                        response3.responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
                        //xx console.log(response1.toString())
                        //xx console.log(response2.toString())
                        //xx console.log(response3.toString())
                        callback();
                    }
                ], function (err) {
                    //xx console.log("-------------------", subscriptionId);
                    inner_done(err);
                });

            }, done);

        });

    });

};

