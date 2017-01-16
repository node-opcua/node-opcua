/*global describe, it, require*/
require("requirish")._(module);
var assert = require("better-assert");
var async = require("async");
var should = require("should");
var sinon = require("sinon");
var opcua = require("index");
var _ = require("underscore");

var OPCUAClient = opcua.OPCUAClient;
var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;


module.exports = function (test) {


    describe("Testing #195", function () {


        it("#195-A the node-opcua client shall automatically detect the maximum number of pending publish request supported by the server and avoid overflowing the server with too many",function(done) {

            function createSubsciption(done) {

                async.series([

                    // create a single subscription
                    function (callback) {
                        var parameters = {
                            requestedPublishingInterval: 100000,
                            requestedLifetimeCount: 10,
                            requestedMaxKeepAliveCount: 2
                        };
                        the_subscription = new opcua.ClientSubscription(the_session, parameters);
                        the_subscription.on("started",function() {
                            callback();
                        }).on("internal_error", function (err) {
                            console.log(" received internal error", err.message);
                        }).on("keepalive", function () {

                            console.log("keepalive  -pending request on server = ", the_subscription.publish_engine.nbPendingPublishRequests);

                        }).on("terminated", function (err) {

                        });
                    },
                    function (callback) {

                        var nodeIdToMonitor = "ns=0;i=2257"; // Server_ServerStatus_StartTime
                        the_monitoredItem = the_subscription.monitor(
                            {
                                nodeId: nodeIdToMonitor,
                                attributeId:  opcua.AttributeIds.Value
                            },
                            {
                                samplingInterval: 1000,
                                discardOldest: true,
                                queueSize: 100
                            },opcua.read_service.TimestampsToReturn.Both,function(err) {
                                callback(err);
                            });
                    }
                ],done);
            }

            var ServerSession = require("lib/server/server_session").ServerSession;
            var oldValue = ServerSession.maxPublishRequestInQueue;
            oldValue.should.be.greaterThan(20);
            ServerSession.maxPublishRequestInQueue = 10;

            // Given a server that only accept a limited number of pending Publish Request
            // Given a client session with many subscriptions
            // and many Publish Request send
            // the client shall detect the maximum number of pending publish request supported by the server
            var server = test.server;

            if (!server) { return done(); }

            var client1 = new OPCUAClient({
                requestedSessionTimeout: 10000,
                keepSessionAlive: false
            });

            var endpointUrl = test.endpointUrl;

            var the_subscription = 0;
            var the_monitoredItem =0;
            var the_session;
            async.series([

                function (callback) {
                    client1.connect(endpointUrl, callback);
                },

                // create a session using client1
                function (callback) {
                    client1.createSession(function (err, session) {
                        if (err) {
                            return callback(err);
                        }
                        the_session = session;
                        the_session.getPublishEngine().nbMaxPublishRequestsAcceptedByServer.should.be.greaterThan(100);
                        callback();
                    });
                },

                createSubsciption.bind(null),
                createSubsciption.bind(null),
                createSubsciption.bind(null),
                createSubsciption.bind(null),
                createSubsciption.bind(null),


                // now wait for the session to expire
                function (callback) {

                    the_session._publishEngine.nbMaxPublishRequestsAcceptedByServer.should.eql(10);

                    callback();
                },

                function (callback) {
                    client1.disconnect(function () {
                        callback();
                    });
                },function(callback) {

                    ServerSession.maxPublishRequestInQueue =oldValue;
                    callback();
                }
            ], done);

        });

        it("#195-B a client shall detect when the server has closed a session due to timeout and  inactive subscriptions", function (done) {

            // Given a server
            // Given a client with keepSessionAlive = false
            // Given a client session with a  10000 ms timeout
            // Given a subscription with a keep-alive duration longer than the client session timeout
            // at some point the server will send a publish response with BadSessionClosed
            // and the client will raise a "session_closed" event
            //
            var server = test.server;

            if (!server) { return done(); }

            var client1 = new OPCUAClient({
                requestedSessionTimeout: 2500,
                keepSessionAlive: false
            });

            var endpointUrl = test.endpointUrl;

            var the_subscription = 0;
            var the_monitoredItem =0;

            var subscriptionId = null;
            var the_session;
            async.series([

                function (callback) {
                    client1.connect(endpointUrl, callback);
                },

                // create a session using client1
                function (callback) {
                    client1.createSession(function (err, session) {
                        if (err) {
                            return callback(err);
                        }
                        the_session = session;
                        callback();
                    });
                },

                // create a single subscription
                function (callback) {
                    var parameters = {
                        requestedPublishingInterval: 1000,
                        requestedLifetimeCount:      100000,
                        requestedMaxKeepAliveCount:  50
                    };
                    the_subscription = new opcua.ClientSubscription(the_session, parameters);
                    the_subscription.on("started",function() {

                        subscriptionId =the_subscription.subscriptionId;

                        callback();
                    }).on("internal_error", function (err) {
                        console.log(" received internal error", err.message);
                    }).on("keepalive", function () {

                        console.log("keepalive  -pending request on server = ", the_subscription.publish_engine.nbPendingPublishRequests);

                    }).on("terminated", function (err) {

                    });
                },
                function (callback) {

                    var nodeIdToMonitor = "ns=0;i=2257"; // Server_ServerStatus_StartTime
                    the_monitoredItem = the_subscription.monitor(
                        {
                            nodeId: nodeIdToMonitor,
                            attributeId:  opcua.AttributeIds.Value
                        },
                        {
                            samplingInterval: 1000,
                            discardOldest: true,
                            queueSize: 100
                        },opcua.read_service.TimestampsToReturn.Both,function(err) {
                            callback(err);
                        });
                },

                // now wait for the session to expire
                function (callback) {

                    the_session.on("session_closed",function(statusCode) {
                        console.log(" Session has been closed ",statusCode.toString() );
                        callback();
                    });
                },

                // now reopen a session to delete the pending subscription
                function (callback) {

                    the_session = null;
                    client1.createSession(function (err, session) {
                        if (err) {
                            return callback(err);
                        }
                        the_session = session;
                        callback();
                    });
                },

                function( callback) {
                    _.isNumber(subscriptionId).should.eql(true);
                    console.log("transferring subscription", subscriptionId);
                    the_session.transferSubscriptions({
                        subscriptionIds: [ subscriptionId]
                    },function(err,response){
                        //xx console.log(response.toString());
                        response.results[0].statusCode.should.eql(opcua.StatusCodes.Good);
                        callback();
                    });
                },
                function(callback) {
                    the_session.close(callback);
                },

                function (callback) {
                    client1.disconnect(function () {
                        //xx console.log(" Client disconnected ", (err ? err.message : "null"));
                        callback();
                    });
                },function(callback) {
                    callback();
                }


            ], done);

        });

    });

};
