"use strict";
const async = require("async");
const should = require("should");
const _ = require("underscore");

const {
    ClientSubscription,
    OPCUAClient,
    ClientMonitoredItem,
    AttributeIds,
    TimestampsToReturn,
    ServerSession,
    StatusCodes
} = require("node-opcua");


const f = require("../../test_helpers/display_function_name").f.bind(null, true);

module.exports = function(test) {


    describe("Testing #195", function() {


        it("#195-A the node-opcua client shall automatically detect the maximum number of pending publish request supported by the server and avoid overflowing the server with too many", function(done) {

            let the_session;
            let the_subscription = 0;
            let the_monitoredItem = 0;

            function createSubscription(done) {

                async.series([

                    // create a single subscription
                    function(callback) {
                        const parameters = {
                            requestedPublishingInterval: 100000,
                            requestedLifetimeCount: 60,
                            requestedMaxKeepAliveCount: 10
                        };
                        the_subscription = ClientSubscription.create(the_session, parameters);
                        the_subscription.on("started", function() {
                            callback();
                        }).on("internal_error", function(err) {
                            console.log(" received internal error", err.message);
                        }).on("keepalive", function() {

                            console.log("keepalive  -pending request on server = ", the_subscription.publish_engine.nbPendingPublishRequests);

                        }).on("terminated", function(err) {
                            should.not.exist(err);
                        });
                    },
                    function(callback) {
                        const nodeIdToMonitor = "ns=0;i=2257"; // Server_ServerStatus_StartTime
                        the_monitoredItem = ClientMonitoredItem.create(the_subscription,
                            {
                                nodeId: nodeIdToMonitor,
                                attributeId: AttributeIds.Value
                            },
                            {
                                samplingInterval: 1000,
                                discardOldest: true,
                                queueSize: 100
                            }, TimestampsToReturn.Both);

                        the_monitoredItem.on("initialized", () => {
                            console.log("Initialize()");
                            setImmediate(callback);
                        });
                    }
                ], done);
            }

            const oldValue = ServerSession.maxPublishRequestInQueue;
            oldValue.should.be.greaterThan(20);
            ServerSession.maxPublishRequestInQueue = 10;

            // Given a server that only accept a limited number of pending Publish Request
            // Given a client session with many subscriptions
            // and many Publish Request send
            // the client shall detect the maximum number of pending publish request supported by the server
            const server = test.server;

            if (!server) { return done(); }

            const client1 = OPCUAClient.create({
                requestedSessionTimeout: 10000,
                keepSessionAlive: false
            });

            const endpointUrl = test.endpointUrl;

            async.series([

                function(callback) {
                    client1.connect(endpointUrl, callback);
                },

                // create a session using client1
                function(callback) {
                    client1.createSession(function(err, session) {
                        if (err) {
                            return callback(err);
                        }
                        the_session = session;
                        the_session.getPublishEngine().nbMaxPublishRequestsAcceptedByServer.should.be.greaterThan(100);
                        callback();
                    });
                },

                createSubscription.bind(null),
                createSubscription.bind(null),
                createSubscription.bind(null),
                createSubscription.bind(null),
                createSubscription.bind(null),


                // now wait for the session to expire
                function(callback) {

                    ServerSession.maxPublishRequestInQueue = oldValue;
                    the_session._publishEngine.nbMaxPublishRequestsAcceptedByServer.should.eql(10);

                    callback();
                },

                function(callback) {
                    client1.disconnect(function() {
                        callback();
                    });
                }
            ], done);

        });

        it("NXX1 #195-B a client shall detect when the server has closed a session due to timeout and  inactive subscriptions", function(done) {

            let the_session;

            // Given a server
            // Given a client with keepSessionAlive = false
            // Given a client session with a  10000 ms timeout
            // Given a subscription with a keep-alive duration longer than the client session timeout
            // at some point the server will send a publish response with BadSessionClosed
            // and the client will raise a "session_closed" event
            //
            const server = test.server;

            if (!server) { return done(); }

            const client1 = OPCUAClient.create({
                requestedSessionTimeout: 2500, // very short session timeout ....
                keepSessionAlive: false
            });

            const endpointUrl = test.endpointUrl;

            let the_subscription = 0;
            let the_monitoredItem = 0;

            let subscriptionId = null;
            async.series([

                f(function connect_a_client(callback) {
                    client1.connect(endpointUrl, callback);
                }),

                // create a session using client1
                f(function create_a_first_session(callback) {
                    client1.createSession(function(err, session) {
                        if (err) {
                            return callback(err);
                        }
                        the_session = session;
                        callback();
                    });
                }),

                // create a single subscription
                f(function create_subscription(callback) {
                    const parameters = {
                        requestedPublishingInterval: 1000,
                        requestedLifetimeCount: 100000,  // very long subscription lifetime
                        requestedMaxKeepAliveCount: 1000
                    };
                    the_subscription = ClientSubscription.create(the_session, parameters);
                    the_subscription.on("started", function() {
                        subscriptionId = the_subscription.subscriptionId;
                        callback();
                    }).on("internal_error", function(err) {
                        console.log(" received internal error", err.message);
                    }).on("keepalive", function() {

                        console.log("keepalive  -pending request on server = ", the_subscription.publish_engine.nbPendingPublishRequests);

                    }).on("terminated", function(err) {
                        should.not.exist(err);
                    });
                }),
                f(function create_some_monitored_item(callback) {

                    const nodeIdToMonitor = "ns=0;i=2257"; // Server_ServerStatus_StartTime
                    the_monitoredItem = ClientMonitoredItem.create(the_subscription,
                        {
                            nodeId: nodeIdToMonitor,
                            attributeId: AttributeIds.Value
                        },
                        {
                            samplingInterval: 1000,
                            discardOldest: true,
                            queueSize: 100
                        }, TimestampsToReturn.Both);
                    the_monitoredItem.on("initialized", () => {
                        callback();
                    });
                }),

                // now wait for the session to expire
                f(function wait_for_session_to_expire(callback) {

                    the_session.once("session_closed", function(statusCode) {
                        console.log(" Session has been closed ", statusCode.toString());
                        //callback();
                    });
                    the_session.close(false, () => {
                        callback();
                    })
                }),

                // now reopen a session to delete the pending subscription
                f(function create_a_new_session(callback) {

                    the_session = null;
                    client1.createSession(function(err, session) {
                        if (err) {
                            return callback(err);
                        }
                        the_session = session;
                        callback();
                    });
                }),

                f(function transfer_subscription_to_new_session(callback) {

                    typeof subscriptionId === "number".should.eql(true);

                    console.log("transferring subscription", subscriptionId);

                    the_session.transferSubscriptions({
                        subscriptionIds: [subscriptionId]
                    }, function(err, response) {
                        //xx console.log(response.toString());
                        response.results[0].statusCode.should.eql(StatusCodes.Good);
                        callback();
                    });

                }),
                f(function closing_session(callback) {
                    the_session.close(callback);
                }),

                f(function disconnecting(callback) {
                    client1.disconnect(function() {
                        //xx console.log(" Client disconnected ", (err ? err.message : "null"));
                        callback();
                    });
                }), function(callback) {
                    callback();
                }

            ], done);
        });
    });
};
