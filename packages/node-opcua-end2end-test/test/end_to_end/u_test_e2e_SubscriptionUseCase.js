/*global xit,it,describe,before,beforeEach,afterEach*/
"use strict";


var assert = require("node-opcua-assert");
var async = require("async");
var should = require("should");
var sinon = require("sinon");
var _ = require("underscore");

var opcua = require("node-opcua");

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
var VariantArrayType = opcua.VariantArrayType;
var MonitoredItem = opcua.MonitoredItem;

var perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var perform_operation_on_subscription = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_subscription;
var perform_operation_on_monitoredItem = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_monitoredItem;


function trace_console_log() {
    var log1 = global.console.log;
    global.console.log = function () {
        var t = (new Error()).stack.split("\n")[2];
        if (t.match(/opcua/)) {
            log1.call(console, t.cyan);
        }
        log1.apply(console, arguments);
    };
}

//xx trace_console_log();


module.exports = function (test) {

    describe("AZA1- testing Client-Server subscription use case, on a fake server exposing the temperature device", function () {

        var server, client, endpointUrl;

        beforeEach(function (done) {
            client = new OPCUAClient();
            server = test.server;
            endpointUrl = test.endpointUrl;
            done();
        });

        afterEach(function (done) {
            client = null;
            done();
        });


        it("AZA1-A should create a ClientSubscription to manage a subscription", function (done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                assert(session instanceof ClientSession);

                var subscription = new ClientSubscription(session, {
                    requestedPublishingInterval: 100,
                    requestedLifetimeCount: 100 * 60 * 10,
                    requestedMaxKeepAliveCount: 5,
                    maxNotificationsPerPublish: 5,
                    publishingEnabled: true,
                    priority: 6
                });
                subscription.on("started", function () {
                    setTimeout(function () {
                        subscription.terminate();
                    }, 200);
                });
                subscription.on("terminated", function () {
                    setTimeout(function () {
                        inner_done();
                    }, 200);
                });
            }, done);
        });

        it("AZA1-B should dump statistics ", function (done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, done) {

                assert(session instanceof ClientSession);

                var subscription = new ClientSubscription(session, {
                    requestedPublishingInterval: 100,
                    requestedLifetimeCount: 100 * 60 * 10,
                    requestedMaxKeepAliveCount: 5,
                    maxNotificationsPerPublish: 5,
                    publishingEnabled: true,
                    priority: 6
                });
                subscription.on("started", function () {
                    setTimeout(function () {
                        subscription.terminate();
                    }, 200);
                });
                subscription.on("terminated", function () {
                    done();
                });
            }, done);
        });

        it("AZA1-C a ClientSubscription should receive keep-alive events from the server", function (done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, done) {

                assert(session instanceof ClientSession);

                var nb_keep_alive_received = 0;

                var subscription = new ClientSubscription(session, {
                    requestedPublishingInterval: 100,
                    requestedLifetimeCount: 10,
                    requestedMaxKeepAliveCount: 2,
                    maxNotificationsPerPublish: 2,
                    publishingEnabled: true,
                    priority: 6
                });
                subscription.on("started", function () {
                    setTimeout(function () {
                        subscription.terminate();
                    }, 1000);
                });
                subscription.on("keepalive", function () {
                    nb_keep_alive_received += 1;
                });
                subscription.on("terminated", function () {
                    //xx console.log(" subscription has received ", nb_keep_alive_received, " keep-alive event(s)");
                    nb_keep_alive_received.should.be.greaterThan(0);
                    done();
                });
            }, done);
        });

        xit("AZA1-D a ClientSubscription should survive longer than the life time", function (done) {
            // todo
            done();
        });

        it("AZA1-E should be possible to monitor an nodeId value with a ClientSubscription", function (done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, done) {

                assert(session instanceof ClientSession);

                var subscription = new ClientSubscription(session, {
                    requestedPublishingInterval: 150,
                    requestedLifetimeCount: 10 * 60 * 10,
                    requestedMaxKeepAliveCount: 10,
                    maxNotificationsPerPublish: 2,
                    publishingEnabled: true,
                    priority: 6
                });

                subscription.on("started", function () {

                });
                subscription.on("terminated", function () {
                    done();
                });

                var monitoredItem = subscription.monitor({
                    nodeId: resolveNodeId("ns=0;i=2258"),
                    attributeId: AttributeIds.Value
                }, {
                    samplingInterval: 50,
                    discardOldest: true,
                    queueSize: 1
                });

                // subscription.on("item_added",function(monitoredItem){
                monitoredItem.on("initialized", function () {
                    monitoredItem.terminate(function () {
                        subscription.terminate();
                    });
                });

            }, done);
        });

        it("AZA1-F should be possible to monitor several nodeId value with a single client subscription", function (done) {
            perform_operation_on_client_session(client, endpointUrl, function (session, callback) {

                assert(session instanceof ClientSession);

                var subscription = new ClientSubscription(session, {
                    requestedPublishingInterval: 50,
                    requestedLifetimeCount: 10 * 60 * 10,
                    requestedMaxKeepAliveCount: 10,
                    maxNotificationsPerPublish: 2,
                    publishingEnabled: true,
                    priority: 6
                });


                var currentTime_changes = 0;
                var monitoredItemCurrentTime = subscription.monitor({
                    nodeId: resolveNodeId("ns=0;i=2258"),
                    attributeId: AttributeIds.Value
                }, {
                    samplingInterval: 20,
                    discardOldest: true,
                    queueSize: 1
                });

                // subscription.on("item_added",function(monitoredItem){
                monitoredItemCurrentTime.on("changed", function (dataValue) {
                    should.exist(dataValue);
                    //xx console.log("xxxx current time", dataValue.value.value);
                    currentTime_changes++;
                });

                var pumpSpeedId = "ns=4;b=0102030405060708090a0b0c0d0e0f10";
                var monitoredItemPumpSpeed = subscription.monitor({
                    nodeId: resolveNodeId(pumpSpeedId),
                    attributeId: AttributeIds.Value
                }, {
                    samplingInterval: 20,
                    discardOldest: true,
                    queueSize: 1
                });

                var pumpSpeed_changes = 0;
                monitoredItemPumpSpeed.on("changed", function (dataValue) {
                    should.exist(dataValue);
                    // console.log(" pump speed ", dataValue.value.value);
                    pumpSpeed_changes++;

                });

                setTimeout(function () {
                    pumpSpeed_changes.should.be.greaterThan(1);
                    currentTime_changes.should.be.greaterThan(1);
                    subscription.terminate(function () {
                        callback();
                    });

                }, 2000);

            }, done);
        });

        it("AZA1-G should terminate any pending subscription when the client is disconnected", function (done) {


            var the_session;

            async.series([

                // connect
                function (callback) {
                    client.connect(endpointUrl, callback);
                },

                // create session
                function (callback) {
                    client.createSession(function (err, session) {
                        assert(session instanceof ClientSession);
                        if (!err) {
                            the_session = session;
                        }
                        callback(err);
                    });
                },

                // create subscription
                function (callback) {

                    var subscription = new ClientSubscription(the_session, {
                        requestedPublishingInterval: 100,
                        requestedLifetimeCount: 100 * 60 * 10,
                        requestedMaxKeepAliveCount: 5,
                        maxNotificationsPerPublish: 5,
                        publishingEnabled: true,
                        priority: 6
                    });
                    subscription.on("started", function () {

                        var monitoredItem = subscription.monitor({
                            nodeId: resolveNodeId("ns=0;i=2258"),
                            attributeId: 13
                        }, {
                            samplingInterval: 100,
                            discardOldest: true,
                            queueSize: 1
                        });

                        callback();

                    });

                },
                // wait a little bit
                function (callback) {
                    setTimeout(function () {
                        // client.disconnect(done);
                        callback();
                    }, 100);
                },

                // now disconnect the client , without closing the subscription first
                function (callback) {
                    client.disconnect(callback);
                }

            ], function (err) {
                done(err);
            });

        });

    });

    describe("AZA2- testing server and subscription", function () {

        var server, client, endpointUrl;

        beforeEach(function (done) {
            server = test.server;
            //xx server.restart(function() {

            client = new OPCUAClient();
            endpointUrl = test.endpointUrl;
            done();
            //xx });
        });

        afterEach(function (done) {
            client.disconnect(function (err) {
                client = null;
                done(err);
            });
        });

        //function on_freshly_started_server(inner_func, done) {
        //
        //    async.series([
        //        function (callback) {
        //            console.log(" Restarting server;")
        //            server.restart(callback);
        //        },
        //        function (callback) {
        //            try {
        //                console.log(" ------------------------------------------------ INNER FUNC".bgWhite);
        //                inner_func(callback);
        //            }
        //            catch (err) {
        //                callback(err);
        //            }
        //        }
        //    ], done);
        //
        //}

        it("AZA2-A should return BadTooManySubscriptions if too many subscriptions are opened", function (done) {

            //XX on_freshly_started_server(function (inner_done) {

            var subscriptionIds = [];

            function create_an_other_subscription(session, expected_error, callback) {

                session.createSubscription({
                    requestedPublishingInterval: 100, // Duration
                    requestedLifetimeCount: 10,    // Counter
                    requestedMaxKeepAliveCount: 10, // Counter
                    maxNotificationsPerPublish: 10, // Counter
                    publishingEnabled: true, // Boolean
                    priority: 14 // Byte
                }, function (err, response) {

                    if (!expected_error) {
                        should(err).eql(null);
                        subscriptionIds.push(response.subscriptionId);
                    }
                    else {
                        err.message.should.match(new RegExp(expected_error));
                    }
                    callback();
                });
            }

            var MAX_SUBSCRIPTION_BACKUP = opcua.OPCUAServer.MAX_SUBSCRIPTION;
            opcua.OPCUAServer.MAX_SUBSCRIPTION = 5;

            perform_operation_on_client_session(client, endpointUrl, function (session, done) {

                async.series([

                    function (callback) {
                        var nbSessions = server.engine.currentSessionCount;
                        server.engine.currentSessionCount.should.equal(nbSessions);
                        callback();
                    },
                    function (callback) {
                        create_an_other_subscription(session, null, callback);
                    },
                    function (callback) {
                        create_an_other_subscription(session, null, callback);
                    },
                    function (callback) {
                        create_an_other_subscription(session, null, callback);
                    },
                    function (callback) {
                        create_an_other_subscription(session, null, callback);
                    },
                    function (callback) {
                        create_an_other_subscription(session, null, callback);
                    },
                    function (callback) {
                        create_an_other_subscription(session, "BadTooManySubscriptions", callback);
                    },
                    function (callback) {
                        create_an_other_subscription(session, "BadTooManySubscriptions", callback);
                    },

                    function (callback) {
                        session.deleteSubscriptions({
                            subscriptionIds: subscriptionIds
                        }, function (err, response) {
                            should.exist(response);
                            callback(err);
                        });
                    }
                ], function (err) {
                    opcua.OPCUAServer.MAX_SUBSCRIPTION = MAX_SUBSCRIPTION_BACKUP;
                    done(err);
                });

            }, done);
//XX                 }, inner_done);
        });

        it("AZA2-B a server should accept several Publish Requests from the client without sending notification immediately," +
          " and should still be able to reply to other requests",
          function (done) {

              var subscriptionId;
              perform_operation_on_client_session(client, endpointUrl, function (session, done) {

                  async.series([

                      function (callback) {
                          session.createSubscription({
                              requestedPublishingInterval: 100, // Duration
                              requestedLifetimeCount: 10, // Counter
                              requestedMaxKeepAliveCount: 10, // Counter
                              maxNotificationsPerPublish: 10, // Counter
                              publishingEnabled: true, // Boolean
                              priority: 14 // Byte
                          }, function (err, response) {
                              subscriptionId = response.subscriptionId;
                              callback(err);
                          });
                      },
                      function (callback) {
                          session.readVariableValue("RootFolder", function (err, dataValue, diagnosticInfos) {
                              should.exist(dataValue);
                              callback(err);
                          });
                      },
                      function (callback) {

                          function publish_callback(err, response) {
                              should.exist(response);
                              should(err.message).match(/BadNoSubscription/);
                          }

                          // send many publish requests, in one go
                          session.publish({}, publish_callback);
                          session.publish({}, publish_callback);
                          session.publish({}, publish_callback);
                          session.publish({}, publish_callback);
                          session.publish({}, publish_callback);
                          session.publish({}, publish_callback);
                          callback();
                      },
                      function (callback) {
                          session.readVariableValue("RootFolder", function (err, dataValue, diagnosticInfos) {
                              callback(err);
                          });
                      },
                      function (callback) {
                          session.deleteSubscriptions({
                              subscriptionIds: [subscriptionId]
                          }, function (err, response) {
                              should.exist(response);
                              callback(err);
                          });
                      }
                  ], function (err) {
                      done(err);
                  });

              }, done);
          });

        it("AZA2-C A Subscription can be added and then deleted", function (done) {
            var subscriptionId;
            perform_operation_on_client_session(client, endpointUrl, function (session, done) {

                async.series([

                    function (callback) {
                        session.createSubscription({
                            requestedPublishingInterval: 100, // Duration
                            requestedLifetimeCount: 10, // Counter
                            requestedMaxKeepAliveCount: 10, // Counter
                            maxNotificationsPerPublish: 10, // Counter
                            publishingEnabled: true, // Boolean
                            priority: 14 // Byte
                        }, function (err, response) {
                            subscriptionId = response.subscriptionId;
                            callback(err);
                        });
                    },


                    function (callback) {
                        session.deleteSubscriptions({
                            subscriptionIds: [subscriptionId]
                        }, function (err, response) {
                            should.exist(response);
                            callback(err);
                        });
                    }
                ], function (err) {
                    done(err);
                });

            }, done);

        });

        it("AZA2-D #deleteSubscriptions -  should return serviceResult=BadNothingToDo if subscriptionIds is empty", function (done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, done) {

                async.series([

                    function (callback) {
                        session.deleteSubscriptions({
                            subscriptionIds: []
                        }, function (err, response) {
                            should.exist(response);
                            err.message.should.match(/BadNothingToDo/);
                            callback();
                        });
                    }

                ], function (err) {
                    done(err);
                });

            }, done);

        });

        it("AZA2-E A MonitoredItem can be added to a subscription and then deleted", function (done) {

            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, callback) {

                var monitoredItem = subscription.monitor({
                    nodeId: resolveNodeId("ns=0;i=2258"),
                    attributeId: AttributeIds.Value
                }, {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1
                });

                // subscription.on("item_added",function(monitoredItem){
                monitoredItem.on("initialized", function () {
                    monitoredItem.terminate(function () {
                        callback();
                    });
                });
            }, done);

        });

        it("AZA2-F should return BadNodeIdUnknown  if the client tries to monitored an non-existent node", function (done) {

            this.timeout(5000);
            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, callback) {

                var monitoredItem = subscription.monitor({
                    nodeId: resolveNodeId("ns=0;s=**unknown**"),
                    attributeId: AttributeIds.Value
                }, {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1
                });

                monitoredItem.on("err", function (statusMessage) {

                    //xx console.log(" ERR event received");

                    statusMessage.should.eql(StatusCodes.BadNodeIdUnknown.toString());
                    callback();
                });

                // subscription.on("item_added",function(monitoredItem){
                monitoredItem.on("initialized", function () {
                    monitoredItem.terminate(function () {
                        callback(new Error("Should not have been initialized"));
                    });
                });
            }, done);

        });

        it("AZA2-G should return BadAttributeIdInvalid if the client tries to monitored an invalid attribute", function (done) {

            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, callback) {

                var monitoredItem = subscription.monitor({
                    nodeId: resolveNodeId("ns=0;i=2258"),
                    attributeId: AttributeIds.INVALID
                }, {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1
                });

                monitoredItem.on("err", function (statusMessage) {

                    //xx console.log(" ERR event received");

                    statusMessage.should.eql(StatusCodes.BadAttributeIdInvalid.toString());
                    callback();
                });


                // subscription.on("item_added",function(monitoredItem){
                monitoredItem.on("initialized", function () {
                    monitoredItem.terminate(function () {
                        callback(new Error("Should not have been initialized"));
                    });
                });
            }, done);
        });

        it("AZA2-H should return BadIndexRangeInvalid if the client tries to monitored with an invalid index range", function (done) {

            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, callback) {

                var monitoredItem = subscription.monitor({
                    nodeId: resolveNodeId("ns=0;i=2258"),
                    attributeId: AttributeIds.Value,
                    indexRange: "5:3" // << INTENTIONAL : Invalid Range
                }, {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1
                });

                monitoredItem.on("err", function (statusMessage) {
                    statusMessage.should.eql(StatusCodes.BadIndexRangeInvalid.toString());
                    callback();
                });

                // subscription.on("item_added",function(monitoredItem){
                monitoredItem.on("initialized", function () {
                    monitoredItem.terminate(function () {
                        callback(new Error("monitoredItem.on('initialized') should not be called"));
                    });
                });
            }, done);
        });

        it("AZA2-I should return BadIndexRangeNoData on first notification if the client tries to monitored with 2D index range when a 1D index range is required", function (done) {

            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, callback) {

                var notificationMessageSpy = new sinon.spy();
                subscription.on("raw_notification", notificationMessageSpy);

                subscription.publishingInterval.should.eql(100);

                var nodeId = "ns=411;s=Scalar_Static_Array_Boolean";

                var monitoredItem = subscription.monitor({
                    nodeId: nodeId,
                    attributeId: AttributeIds.Value,
                    indexRange: "0:1,0:1" // << INTENTIONAL : 2D RANGE
                }, {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1
                });

                monitoredItem.on("err", function (statusMessage) {
                    //xx console.log("Monitored Item error",statusMessage);
                    statusMessage.should.eql(StatusCodes.BadIndexRangeInvalid.toString());
                    callback();
                });

                // subscription.on("item_added",function(monitoredItem){
                monitoredItem.on("initialized", function () {
                    //xx console.log("Monitored Item Initialized")
                });

                var monitoredItemOnChangedSpy = new sinon.spy();
                monitoredItem.on("changed", monitoredItemOnChangedSpy);

                setTimeout(function () {
                    //xx console.log(notificationMessageSpy.getCall(0).args[0].toString());
                    monitoredItemOnChangedSpy.getCall(0).args[0].statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
                    monitoredItemOnChangedSpy.callCount.should.eql(1, "Only one reply");
                    callback();
                }, 500);

            }, done);
        });

        it("AZA2-J should not report notification if a monitored value array changes outside the monitored indexRange - 1", function (done) {
            // based on CTT : createMonitoredItems591025 - 015.js
            // Description:
            //  - Specify an item of type array. Do this for all configured supported data types.
            //  - Specify an IndexRange that equates to the last 3 elements of the array.
            //  - Write values to each data-type within the index range specified and then
            //    call Publish(). We expect to receive data in the Publish response.
            //    Write to each data-type outside of the index range (e.g. elements 0 and 1) and then call Publish().
            //    We do not expect to receive data in the Publish response.
            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, callback) {


                var notificationMessageSpy = new sinon.spy();
                subscription.on("raw_notification", notificationMessageSpy);

                var monitoredItemOnChangedSpy = new sinon.spy();

                subscription.publishingInterval.should.eql(100);

                var nodeId = "ns=411;s=Scalar_Static_Array_Int32";


                function wait(duration, callback) {
                    setTimeout(callback, duration); // make sure we get inital data
                }


                function write(value, indexRange, callback) {

                    assert(_.isFunction(callback));

                    var sourceTimestamp = new Date();
                    var serverTimestamp = sourceTimestamp;

                    var nodesToWrite = [
                        {
                            nodeId: nodeId,
                            attributeId: AttributeIds.Value,
                            value: /*new DataValue(*/{
                                serverTimestamp: null,
                                sourceTimestamp: null,
                                //xx serverTimestamp: serverTimestamp,
                                //xx sourceTimestamp: sourceTimestamp,
                                value: {
                                    /* Variant */
                                    dataType: DataType.Int32,
                                    value: value
                                }
                            },
                            indexRange: indexRange
                        }
                    ];

                    session.write(nodesToWrite, function (err, statusCodes) {
                        if (!err) {
                            statusCodes.length.should.equal(nodesToWrite.length);
                            statusCodes[0].should.eql(opcua.StatusCodes.Good);
                        }

                        session.read([{
                            attributeId: 13,
                            nodeId: nodeId,
                        }], function (err, a, result) {
                            should.exist(a);
                            should.exist(result);
                            //xx console.log(" written ",result[0].value.toString());
                            callback(err);

                        });
                    });

                }

                function create_monitored_item(callback) {
                    var monitoredItem = subscription.monitor({
                          nodeId: nodeId,
                          attributeId: AttributeIds.Value,
                          indexRange: "2:9"
                      }, {
                          samplingInterval: 0, // event based
                          discardOldest: true,
                          queueSize: 1
                      },
                      opcua.read_service.TimestampsToReturn.Both
                    );

                    monitoredItem.on("err", function (statusMessage) {
                        callback(new Error(statusMessage));
                    });

                    // subscription.on("item_added",function(monitoredItem){
                    monitoredItem.on("initialized", function () {
                        callback();
                    });

                    monitoredItem.on("changed", monitoredItemOnChangedSpy);

                }

                async.series([

                    write.bind(null, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], null),

                    create_monitored_item.bind(null),

                    wait.bind(null, 300),

                    function (callback) {
                        monitoredItemOnChangedSpy.callCount.should.eql(1);
                        monitoredItemOnChangedSpy.getCall(0).args[0].statusCode.should.eql(StatusCodes.Good);
                        //xx console.log(monitoredItemOnChangedSpy.getCall(0).args[0].toString());
                        monitoredItemOnChangedSpy.getCall(0).args[0].value.value.should.eql(new Int32Array([2, 3, 4, 5, 6, 7, 8, 9]));
                        callback();
                    },
                    write.bind(null, [100, 101], "0:1"),
                    wait.bind(null, 300),

                    write.bind(null, [200, 201], "0:1"),
                    wait.bind(null, 300),
                    function (callback) {
                        // no change ! there is no overlap
                        monitoredItemOnChangedSpy.callCount.should.eql(1);
                        callback();
                    },
                    write.bind(null, [222, 333], "2:3"),
                    wait.bind(null, 300),
                    function (callback) {
                        // there is a overlap ! we should receive a monitoredItem On Change event
                        monitoredItemOnChangedSpy.callCount.should.eql(2);
                        callback();
                    }
                ], callback);

            }, done);
        });

        it("AZA2-K should not report notification if a monitored value array changes outside the monitored indexRange", function (done) {

            // based on CTT : createMonitoredItems591024 - 014.js
            // Description:
            //  - Specify an item of type array. Do this for all configured data types.
            //  - Specify an IndexRange of "2:4".
            //  - write values to each data-type within the index range specified
            //  - call Publish()
            //  - VERIFY that a notification is sent
            //  - Write to each data-type outside of the index range (e.g. elements 0, 1 and 5) and then
            //  - call Publish()
            //  - VERIFY that no notification is sent.
            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, callback) {

                var notificationMessageSpy = new sinon.spy();
                subscription.on("raw_notification", notificationMessageSpy);

                var monitoredItemOnChangedSpy = new sinon.spy();

                subscription.publishingInterval.should.eql(100);

                var nodeId = "ns=411;s=Scalar_Static_Array_Int32";

                function create_monitored_item(callback) {

                    var monitoredItem = subscription.monitor({
                          nodeId: nodeId,
                          attributeId: AttributeIds.Value,
                          indexRange: "2:4"
                      }, {
                          samplingInterval: 100,
                          discardOldest: true,
                          queueSize: 1
                      },
                      opcua.read_service.TimestampsToReturn.Both
                    );

                    monitoredItem.on("err", function (statusMessage) {
                        callback(new Error(statusMessage));
                    });

                    // subscription.on("item_added",function(monitoredItem){
                    monitoredItem.on("initialized", function () {
                        //xxconsole.log("Monitored Item Initialized")
                        callback();
                    });

                    monitoredItem.on("changed", monitoredItemOnChangedSpy);
                }


                function wait(duration, callback) {
                    setTimeout(callback, duration); // make sure we get inital data
                }


                function write(value, callback) {

                    var sourceTimestamp = new Date();
                    var serverTimestamp = sourceTimestamp;
                    var nodesToWrite = [
                        {
                            nodeId: nodeId,
                            attributeId: AttributeIds.Value,
                            value: /*new DataValue(*/{
                                serverTimestamp: null,
                                sourceTimestamp: null,
                                //xx serverTimestamp: serverTimestamp,
                                //xx sourceTimestamp: sourceTimestamp,
                                value: {
                                    /* Variant */
                                    dataType: DataType.Int32,
                                    value: value
                                }
                            }
                        }
                    ];

                    session.write(nodesToWrite, function (err, statusCodes) {
                        if (!err) {
                            statusCodes.length.should.equal(nodesToWrite.length);
                            statusCodes[0].should.eql(opcua.StatusCodes.Good);
                        }
                        session.read([{
                            attributeId: 13,
                            nodeId: nodeId,
                        }], function (err, a, result) {
                            ///xx console.log(" written ",result[0].value.toString());
                            callback(err);

                        });
                    });

                }

                async.series([

                    write.bind(null, [0, 0, 0, 0, 0, 0]),


                    create_monitored_item.bind(null),

                    wait.bind(null, 300),
                    write.bind(null, [1, 2, 3, 4, 5]),
                    wait.bind(null, 300),
                    write.bind(null, [10, 20, 3, 4, 5, 60]),
                    wait.bind(null, 300),
                    write.bind(null, [10, 20, 13, 14, 15, 60]),
                    wait.bind(null, 300),
                    function (callback) {

                        //xx console.log(monitoredItemOnChangedSpy.getCall(0).args[0].toString());
                        //xx console.log(monitoredItemOnChangedSpy.getCall(1).args[0].toString());
                        //xx console.log(monitoredItemOnChangedSpy.getCall(2).args[0].toString());

                        monitoredItemOnChangedSpy.getCall(0).args[0].statusCode.should.eql(StatusCodes.Good);
                        monitoredItemOnChangedSpy.getCall(1).args[0].statusCode.should.eql(StatusCodes.Good);
                        monitoredItemOnChangedSpy.getCall(2).args[0].statusCode.should.eql(StatusCodes.Good);

                        monitoredItemOnChangedSpy.getCall(0).args[0].value.value.should.eql(new Int32Array([0, 0, 0]));
                        monitoredItemOnChangedSpy.getCall(1).args[0].value.value.should.eql(new Int32Array([3, 4, 5]));
                        monitoredItemOnChangedSpy.getCall(2).args[0].value.value.should.eql(new Int32Array([13, 14, 15]));

                        monitoredItemOnChangedSpy.callCount.should.eql(3);
                        callback();

                    }
                ], callback);

            }, done);
        });

        xit("AZA2-L disabled monitored item", function (done) {

            //TO DO
            var nodeId = "ns=411;s=Scalar_Static_Int32";

            var monitoredItemOnChangedSpy = new sinon.spy();
            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, callback) {

                // create a disabled monitored Item
                var monitoredItem = subscription.monitor(
                  /* itemToMonitor:*/
                  {
                      nodeId: nodeId,
                      attributeId: AttributeIds.Value
                  },
                  /* requestedParameters:*/
                  {
                      samplingInterval: 100,
                      discardOldest: true,
                      queueSize: 1
                  },
                  opcua.read_service.TimestampsToReturn.Both
                  //xx opcua.subscription_service.MonitoringMode.Disabled
                );
                monitoredItem.monitoringMode = opcua.subscription_service.MonitoringMode.Reporting;
                monitoredItem.on("changed", monitoredItemOnChangedSpy);

                monitoredItem.on("initialized", function () {

                    monitoredItem.setMonitoringMode(opcua.subscription_service.MonitoringMode.Disabled, function () {

                        setTimeout(function () {
                            ///xx console.log(monitoredItemOnChangedSpy.callCount);
                            callback();
                        }, 2000);

                    });

                });


                // var createMonitoredItemsRequest = new opcua.subscription_service.CreateMonitoredItemsRequest({
                //     subscriptionId: subscription.subscriptionId,
                //     timestampsToReturn: opcua.read_service.TimestampsToReturn.Neither,
                //     itemsToCreate: [
                //         {
                //             monitoringMode: MonitoringMode.Disabled,
                //             requestedParameters: {
                //                clientHandle:0,
                //                samplingInterval:-1,
                //                queueSize:1,
                //                discardOldest:true
                //             },
                //             itemToMonitor: {
                //                 attributeId: AttributeIds.Value,
                //                 nodeId: resolveNodeId(nodeId)
                //             }
                //         }
                //     ]
                // });
                //
                // async.series([
                //     function(callback){
                //         session.createMonitoredItems(createMonitoredItemsRequest, function (err, createMonitoredItemsResponse) {
                //             console.log("err = ")
                //             console.log("createMonitoredItemsResponse",createMonitoredItemsResponse.toString());
                //         });
                //     },
                //
                // ],callback);
            }, done);
        });

        it("AZA2-M #CreateMonitoredItemRequest should return BadNothingToDo if CreateMonitoredItemRequest has no nodes to monitored", function (done) {

            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, callback) {

                var createMonitoredItemsRequest = new opcua.subscription_service.CreateMonitoredItemsRequest({
                    subscriptionId: subscription.subscriptionId,
                    timestampsToReturn: opcua.read_service.TimestampsToReturn.Neither,
                    itemsToCreate: []
                });
                session.createMonitoredItems(createMonitoredItemsRequest, function (err, createMonitoredItemsResponse) {
                    should(err.message).match(/BadNothingToDo/);
                    createMonitoredItemsResponse.responseHeader.serviceResult.should.eql(StatusCodes.BadNothingToDo);
                    callback();
                });

            }, done);
        });

        it("AZA2-N #CreateMonitoredItemRequest should return BadIndexRangeInvalid if a invalid range is passed on CreateMonitoredItemRequest ", function (done) {

            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, callback) {

                var VariableIds = opcua.VariableIds;
                var nodeId = opcua.makeNodeId(VariableIds.Server_ServerArray);
                var samplingInterval = 1000;
                var itemToMonitor = new opcua.read_service.ReadValueId({
                    nodeId: nodeId,
                    attributeId: AttributeIds.Value,
                    indexRange: "1:2,3:4"
                });
                var parameters = {
                    samplingInterval: samplingInterval,
                    discardOldest: false,
                    queueSize: 1
                };

                var createMonitoredItemsRequest = new opcua.subscription_service.CreateMonitoredItemsRequest({
                    subscriptionId: subscription.subscriptionId,
                    timestampsToReturn: opcua.read_service.TimestampsToReturn.Neither,
                    itemsToCreate: [{
                        itemToMonitor: itemToMonitor,
                        requestedParameters: parameters,
                        monitoringMode: MonitoringMode.Reporting
                    }]
                });
                session.createMonitoredItems(createMonitoredItemsRequest, function (err, createMonitoredItemsResponse) {
                    should(err).eql(null);
                    createMonitoredItemsResponse.responseHeader.serviceResult.should.eql(StatusCodes.Good);

                    createMonitoredItemsResponse.results[0].statusCode.should.eql(StatusCodes.Good);
                    callback();
                });

                // now publish and check that monitored item returns
            }, done);
        });

        it("AZA2-O should return BadNothingToDo if ModifyMonitoredItemRequest has no nodes to monitored", function (done) {

            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, callback) {

                var modifyMonitoredItemsRequest = new opcua.subscription_service.ModifyMonitoredItemsRequest({
                    subscriptionId: subscription.subscriptionId,
                    timestampsToReturn: opcua.read_service.TimestampsToReturn.Neither,
                    itemsToModify: []
                });
                session.modifyMonitoredItems(modifyMonitoredItemsRequest, function (err, modifyMonitoredItemsResponse) {
                    should(err.message).match(/BadNothingToDo/);
                    modifyMonitoredItemsResponse.responseHeader.serviceResult.should.eql(StatusCodes.BadNothingToDo);
                    callback();
                });

            }, done);
        });

        it("AZA2-P should return BadNothingToDo if DeleteMonitoredItemsResponse has no nodes to delete", function (done) {

            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, callback) {

                var deleteMonitoredItemsRequest = new opcua.subscription_service.DeleteMonitoredItemsRequest({
                    subscriptionId: subscription.subscriptionId,
                    monitoredItemIds: []
                });
                session.deleteMonitoredItems(deleteMonitoredItemsRequest, function (err, deleteMonitoredItemsResponse) {
                    should(err.message).match(/BadNothingToDo/);
                    deleteMonitoredItemsResponse.responseHeader.serviceResult.should.eql(StatusCodes.BadNothingToDo);
                    callback();
                });

            }, done);
        });

        it("AZA2-Q A MonitoredItem should received changed event", function (done) {

            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, inner_callback) {

                var monitoredItem = subscription.monitor({
                    nodeId: resolveNodeId("ns=0;i=2258"),
                    attributeId: AttributeIds.Value
                }, {
                    samplingInterval: 100,
                    discardOldest: true,
                    queueSize: 1
                });

                monitoredItem.on("initialized", function () {
                    //xx console.log("Initialized");
                });

                monitoredItem.on("changed", function (dataValue) {
                    should.exist(dataValue);
                    // the changed event has been received !
                    // lets stop monitoring this item
                    setImmediate(function () {
                        monitoredItem.terminate();
                    });
                });
                monitoredItem.on("terminated", function () {
                    inner_callback();
                });

            }, done);

        });

        it("AZA2-R A Server should reject a CreateMonitoredItemRequest if timestamp is invalid ( catching error on monitored item )", function (done) {

            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, callback) {

                var monitoredItem = subscription.monitor({
                      nodeId: resolveNodeId("ns=0;i=2258"),
                      attributeId: AttributeIds.Value
                  }, {
                      samplingInterval: 100,
                      discardOldest: true,
                      queueSize: 1
                  },

                  TimestampsToReturn.Invalid
                );

                var err_counter = 0;
                // subscription.on("item_added",function(monitoredItem){
                monitoredItem.on("initialized", function () {
                });

                monitoredItem.on("changed", function (dataValue) {
                    should.exist(dataValue);
                });
                monitoredItem.on("err", function (err) {
                    should.exist(err);
                    err_counter++;
                });
                monitoredItem.on("terminated", function () {
                    err_counter.should.eql(1);
                    callback();
                });

            }, done);
        });

        it("AZA2-S A Server should reject a CreateMonitoredItemRequest if timestamp is invalid ( catching error on callback)", function (done) {

            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, callback) {

                var monitoredItem = subscription.monitor({
                      nodeId: resolveNodeId("ns=0;i=2258"),
                      attributeId: 13
                  }, {
                      samplingInterval: 100,
                      discardOldest: true,
                      queueSize: 1
                  },


                  TimestampsToReturn.Invalid, // <= A invalid  TimestampsToReturn

                  function (err) {

                      should(err).be.instanceOf(Error);
                      callback(!err);
                  }
                );


            }, done);
        });

        it("AZA2-T A Server should be able to revise publish interval to avoid trashing if client specify a very small or zero requestedPublishingInterval", function (done) {

            // from spec OPCUA Version 1.02  Part 4 $5.13.2.2 : requestedPublishingInterval:
            // The negotiated value for this parameter returned in the response is used as the
            // default sampling interval for MonitoredItems assigned to this Subscription.
            // If the requested value is 0 or negative, the server shall revise with the fastest
            // supported publishing interval.
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.createSubscription({
                    requestedPublishingInterval: -1
                }, function (err, createSubscriptionResponse) {

                    createSubscriptionResponse.revisedPublishingInterval.should.be.greaterThan(10);

                    inner_done(err);
                });
            }, done);


        });

        it("AZA2-U should handle PublishRequest to confirm closed subscriptions", function (done) {

            var subscriptionId;
            perform_operation_on_client_session(client, endpointUrl, function (session, done) {

                async.series([

                    function (callback) {
                        session.createSubscription({
                            requestedPublishingInterval: 200, // Duration
                            requestedLifetimeCount: 30, // Counter
                            requestedMaxKeepAliveCount: 10, // Counter
                            maxNotificationsPerPublish: 10, // Counter
                            publishingEnabled: true, // Boolean
                            priority: 14 // Byte
                        }, function (err, response) {
                            subscriptionId = response.subscriptionId;
                            callback(err);
                        });
                    },

                    // create a monitored item so we have pending notificiation
                    function (callback) {


                        var namespaceIndex = 411;
                        var nodeId = makeNodeId("Scalar_Static_Int16", namespaceIndex);

                        var node = server.engine.addressSpace.findNode(nodeId);
                        var parameters = {
                            samplingInterval: 0,
                            discardOldest: false,
                            queueSize: 1
                        };
                        var itemToMonitor = {
                            attributeId: 13,
                            nodeId: nodeId
                        };
                        var createMonitoredItemsRequest = new opcua.subscription_service.CreateMonitoredItemsRequest({

                            subscriptionId: subscriptionId,
                            timestampsToReturn: TimestampsToReturn.Both,
                            itemsToCreate: [{
                                itemToMonitor: itemToMonitor,
                                requestedParameters: parameters,
                                monitoringMode: MonitoringMode.Reporting
                            }]
                        });
                        session.createMonitoredItems(createMonitoredItemsRequest, function (err, results) {

                            callback(err);
                        });
                    },
                    function (callback) {
                        setTimeout(callback, 300);
                    },
                    function (callback) {
                        session.deleteSubscriptions({
                            subscriptionIds: [subscriptionId]
                        }, function (err, response) {
                            callback(err);
                        });
                    },

                    function (callback) {
                        session.publish({}, function (err, publishResult) {
                            callback();
                        });
                    }
                ], function (err) {
                    done(err);
                });

            }, done);
        });

    });

    describe("AZA3- testing Client-Server subscription use case 2/2, on a fake server exposing the temperature device", function () {

        var server, client, temperatureVariableId, endpointUrl;

        var nodeIdVariant = "ns=1234;s=SomeDouble";
        var nodeIdByteString = "ns=1234;s=ByteString";
        var nodeIdString = "ns=1234;s=String";

        var subscriptionId = null;
        var samplingInterval = -1;

        before(function (done) {
            server = test.server;
            endpointUrl = test.endpointUrl;
            temperatureVariableId = server.temperatureVariableId;

            var rootFolder = server.engine.addressSpace.rootFolder;
            var objectsFolder = rootFolder.objects;

            // Variable with dataItem capable of sending data change notification events
            // this type of variable can be continuously monitored.
            var n1 = server.engine.addressSpace.addVariable({
                organizedBy: objectsFolder,
                browseName: "SomeDouble",
                nodeId: nodeIdVariant,
                dataType: "Double",
                value: {
                    dataType: DataType.Double,
                    value: 0.0
                }
            });
            n1.minimumSamplingInterval.should.eql(0);

            var changeDetected = 0;
            n1.on("value_changed", function (dataValue) {
                changeDetected += 1;
            });

            n1.setValueFromSource({dataType: DataType.Double, value: 3.14}, StatusCodes.Good);
            changeDetected.should.equal(1);


            server.engine.addressSpace.addVariable({
                organizedBy: objectsFolder,
                browseName: "SomeByteString",
                nodeId: nodeIdByteString,
                dataType: "ByteString",
                value: {
                    dataType: DataType.ByteString,
                    value: new Buffer("Lorem ipsum", "ascii")
                }
            });
            server.engine.addressSpace.addVariable({
                organizedBy: objectsFolder,
                browseName: "Some String",
                nodeId: nodeIdString,
                dataType: "String",
                value: {
                    dataType: DataType.String,
                    value: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                }
            });
            done();
        });

        beforeEach(function (done) {
            client = new OPCUAClient();
            done();
        });

        afterEach(function (done) {
            client = null;
            done();
        });


        it("AZA3-A A server should send a StatusChangeNotification if the client doesn't send PublishRequest within the expected interval", function (done) {

            //xx endpointUrl = "opc.tcp://localhost:2200/OPCUA/SimulationServer";

            var nb_keep_alive_received = 0;
            // from Spec OPCUA Version 1.03 Part 4 - 5.13.1.1 Description : Page 69
            // h. Subscriptions have a lifetime counter that counts the number of consecutive publishing cycles in
            //    which there have been no Publish requests available to send a Publish response for the
            //    Subscription. Any Service call that uses the SubscriptionId or the processing of a Publish
            //    response resets the lifetime counter of this Subscription. When this counter reaches the value
            //    calculated for the lifetime of a Subscription based on the MaxKeepAliveCount parameter in the
            //    CreateSubscription Service (5.13.2), the Subscription is closed. Closing the Subscription causes
            //    its MonitoredItems to be deleted. In addition the Server shall issue a StatusChangeNotification
            //    notificationMessage with the status code Bad_Timeout. The StatusChangeNotification
            //    notificationMessage type is defined in 7.19.4.

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {


                var subscription = new ClientSubscription(session, {
                    requestedPublishingInterval: 100,
                    requestedLifetimeCount: 6,
                    requestedMaxKeepAliveCount: 2,
                    maxNotificationsPerPublish: 10,
                    publishingEnabled: true,
                    priority: 6
                });

                subscription.publish_engine._send_publish_request.should.be.instanceOf(Function);
                // replace _send_publish_request so that it doesn't do anything for a little while
                sinon.stub(subscription.publish_engine, "_send_publish_request").callsFake(function () {
                });

                subscription.on("keepalive", function () {
                    nb_keep_alive_received += 1;
                });

                subscription.on("started", function () {

                    if (false) {
                        console.log("subscriptionId     :", subscription.subscriptionId);
                        console.log("publishingInterval :", subscription.publishingInterval);
                        console.log("lifetimeCount      :", subscription.lifetimeCount);
                        console.log("maxKeepAliveCount  :", subscription.maxKeepAliveCount);
                    }

                    setTimeout(function () {
                        ///xx console.log(" Restoring default behavior");
                        subscription.publish_engine._send_publish_request.callCount.should.be.greaterThan(1);
                        subscription.publish_engine._send_publish_request.restore();
                        subscription.publish_engine._send_publish_request();
                    }, subscription.publishingInterval * ( subscription.lifetimeCount + 10) + 500);


                }).on("status_changed", function (statusCode) {

                    statusCode.should.eql(StatusCodes.BadTimeout);

                    // let explicitly close the subscription by calling terminate
                    // but delay a little bit so we can verify that _send_publish_request
                    // is not called
                    setTimeout(function () {
                        subscription.terminate();
                    }, 200);

                }).on("terminated", function () {
                    nb_keep_alive_received.should.be.equal(0);
                    inner_done();
                });

            }, done);


        });

        it("AZA3-B A subscription without a monitored item should not dropped too early ( see #59)", function (done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var subscription = new ClientSubscription(session, {
                    requestedPublishingInterval: 10,
                    requestedLifetimeCount: 6,
                    requestedMaxKeepAliveCount: 2,
                    maxNotificationsPerPublish: 10,
                    publishingEnabled: true,
                    priority: 6
                });

                function termination_is_a_failure() {
                    inner_done(new Error("subscription has been terminated !!!!"));
                }

                subscription.on("terminated", termination_is_a_failure);

                setTimeout(function () {
                    subscription.removeListener("terminated", termination_is_a_failure);
                    inner_done();
                }, 1000);

            }, done);
        });

        it("AZA3-C #bytesRead #transactionsCount #bytesWritten", function (done) {
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                server.bytesRead.should.be.greaterThan(10);
                server.transactionsCount.should.be.greaterThan(3);
                server.bytesWritten.should.be.greaterThan(10);
                inner_done();
            }, done);
        });

        it("AZA3-D #CreateMonitoredItemsRequest : A server should return statusCode === BadSubscriptionIdInvalid when appropriate  ", function (done) {
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                var options = {
                    subscriptionId: 999, // << invalide subscription id
                };
                session.createMonitoredItems(options, function (err, results) {
                    err.message.should.match(/BadSubscriptionIdInvalid/);
                    inner_done();
                });
            }, done);
        });

        it("AZA3-E #SetPublishingModeRequest: A server should set status codes to BadSubscriptionIdInvalid when appropriate  ", function (done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var publishingEnabled = true;
                var subscriptionIds = [999]; //<< invalid subscription ID
                session.setPublishingMode(publishingEnabled, subscriptionIds, function (err, results) {
                    results.should.be.instanceOf(Array);
                    results[0].should.eql(StatusCodes.BadSubscriptionIdInvalid);
                    inner_done(err);
                });
            }, done);
        });

        it("AZA3-F A server should suspend/resume publishing when client send a setPublishingMode Request ", function (done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var subscription = new ClientSubscription(session, {
                    requestedPublishingInterval: 10,
                    requestedLifetimeCount: 6,
                    requestedMaxKeepAliveCount: 2,
                    maxNotificationsPerPublish: 10,
                    publishingEnabled: true,
                    priority: 6
                });


                subscription.on("terminated", function () {
                });
                var monitoredItem = subscription.monitor({
                    nodeId: resolveNodeId("ns=0;i=2258"),
                    attributeId: AttributeIds.Value
                }, {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1
                });


                var change_count = 0;
                monitoredItem.on("changed", function (dataValue) {
                    change_count += 1;
                    should.exist(dataValue);
                    //xx console.log("xxxxxxxxxxxx=> dataValue",dataValue.toString());
                });

                async.series([
                    function (callback) {
                        // wait 400 milliseconds and verify that the subscription is sending some notification
                        setTimeout(function () {
                            change_count.should.be.greaterThan(2);
                            callback();
                        }, 3600);

                    },
                    function (callback) {
                        // suspend subscription
                        subscription.setPublishingMode(false, function (err) {
                            change_count = 0;
                            callback(err);
                        });

                    },
                    function (callback) {
                        // wait  400 milliseconds and verify that the subscription is  NOT sending any notification
                        setTimeout(function () {
                            change_count.should.equal(0);
                            callback();
                        }, 400);

                    },

                    function (callback) {
                        // resume subscription
                        subscription.setPublishingMode(true, function (err) {
                            change_count = 0;
                            callback(err);
                        });
                    },

                    function (callback) {
                        // wait 600 milliseconds and verify that the subscription is sending some notification again
                        setTimeout(function () {
                            change_count.should.be.greaterThan(2);
                            callback();
                        }, 3600);
                    },

                    function (callback) {
                        subscription.terminate();
                        subscription.on("terminated", function () {
                            callback();
                        });
                    }
                ], inner_done);


            }, done);
        });

        it("AZA3-G A client should be able to create a subscription that have  publishingEnable=false", function (done) {
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var subscription = new ClientSubscription(session, {
                    requestedPublishingInterval: 10,
                    requestedLifetimeCount: 6,
                    requestedMaxKeepAliveCount: 2,
                    maxNotificationsPerPublish: 10,
                    publishingEnabled: false,
                    priority: 6
                });


                subscription.on("terminated", function () {
                });
                var monitoredItem = subscription.monitor({
                    nodeId: resolveNodeId("ns=0;i=2258"),
                    attributeId: AttributeIds.Value
                }, {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1
                });


                var change_count = 0;
                monitoredItem.on("changed", function (dataValue) {
                    should.exist(dataValue);
                    change_count += 1;
                });
                async.series([
                    function (callback) {
                        // wait 400 ms and verify that the subscription is not sending notification.
                        setTimeout(function () {
                            change_count.should.equal(0);
                            callback();
                        }, 400);

                    }
                ], inner_done);

            }, done);
        });

        it("AZA3-H #ModifyMonitoredItemRequest : server should send BadSubscriptionIdInvalid if client send a wrong subscription id", function (done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var modifyMonitoredItemsRequest = {
                    subscriptionId: 999,
                    timestampsToReturn: opcua.read_service.TimestampsToReturn.Neither,
                    itemsToModify: [{}]
                };

                session.modifyMonitoredItems(modifyMonitoredItemsRequest, function (err) {
                    err.message.should.match(/BadSubscriptionIdInvalid/);
                    inner_done();
                });
            }, done);
        });

        it("AZA3-I #ModifyMonitoredItemRequest : server should send BadSubscriptionIdInvalid if client send a wrong subscription id", function (done) {

            var TimestampsToReturn = opcua.read_service.TimestampsToReturn;

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var subscription = new ClientSubscription(session, {
                    requestedPublishingInterval: 20,
                    requestedLifetimeCount: 600,
                    requestedMaxKeepAliveCount: 20,
                    maxNotificationsPerPublish: 10,
                    publishingEnabled: true,
                    priority: 6
                });
                subscription.on("started", function () {
                    var modifyMonitoredItemsRequest = {
                        subscriptionId: subscription.subscriptionId,
                        timestampsToReturn: TimestampsToReturn.Invalid
                    };

                    session.modifyMonitoredItems(modifyMonitoredItemsRequest, function (err, modifyMonitoredItemsResponse) {
                        err.message.should.match(/BadTimestampsToReturnInvalid/);
                        inner_done();
                    });
                });
            }, done);
        });

        it("AZA3-J #ModifyMonitoredItemRequest : server should send BadMonitoredItemIdInvalid  if client send a wrong monitored item id", function (done) {

            var TimestampsToReturn = opcua.read_service.TimestampsToReturn;
            var MonitoredItemModifyRequest = opcua.subscription_service.MonitoredItemModifyRequest;

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var subscription = new ClientSubscription(session, {
                    requestedPublishingInterval: 20,
                    requestedLifetimeCount: 600,
                    requestedMaxKeepAliveCount: 20,
                    maxNotificationsPerPublish: 10,
                    publishingEnabled: true,
                    priority: 6
                });
                subscription.on("started", function () {
                    var modifyMonitoredItemsRequest = {
                        subscriptionId: subscription.subscriptionId,
                        timestampsToReturn: TimestampsToReturn.Neither,
                        itemsToModify: [
                            new MonitoredItemModifyRequest({
                                monitoredItemId: 999,
                                requestedParameters: {}
                            })
                        ]
                    };

                    session.modifyMonitoredItems(modifyMonitoredItemsRequest, function (err, modifyMonitoredItemsResponse) {
                        if (err) {
                            return inner_done(err);
                        }
                        modifyMonitoredItemsResponse.results.length.should.eql(1);
                        modifyMonitoredItemsResponse.results[0].statusCode.should.eql(StatusCodes.BadMonitoredItemIdInvalid);
                        inner_done();
                    });
                });
            }, done);
        });

        function test_modify_monitored_item(itemToMonitor, parameters, inner_func, done) {


            perform_operation_on_monitoredItem(client, endpointUrl, itemToMonitor, function (session, subscription, monitoredItem, inner_done) {

                var change_count = 0;
                monitoredItem.on("changed", function (dataValue) {
                    //xx console.log("xx changed",dataValue.value.toString());
                    change_count += 1;
                });

                async.series([
                    function (callback) {
                        // wait 400 ms to make sure we get the initial notification
                        setTimeout(function () {
                            // we reset change count,
                            change_count = 0;
                            callback();
                        }, 400);
                    },
                    function (callback) {
                        // wait 400 ms and verify that the subscription is not sending notification.
                        setTimeout(function () {
                            change_count.should.equal(0);
                            callback();
                        }, 400);
                    },


                    function (callback) {
                        // let modify monitored item with new parameters.
                        monitoredItem.modify(parameters,
                          function (err, result) {
                              inner_func(err, result, callback);
                          }
                        );
                    },

                    function (callback) {
                        // wait 400 ms and verify that the subscription is now sending notification.
                        setTimeout(function () {
                            change_count.should.be.greaterThan(1);
                            callback();
                        }, 2000); // wait at least 2 seconds as date resolution is 1 sec.
                    }
                ], inner_done);

            }, done); //
        }

        it("AZA3-K #ModifyMonitoredItemRequest : server should handle samplingInterval === -1", function (done) {
            var itemToMonitor = "ns=0;i=2258";

            var parameters = {
                samplingInterval: -1, // SAMPLING INTERVAL = -1
                discardOldest: false,
                queueSize: 1
            };
            test_modify_monitored_item(itemToMonitor, parameters, function (err, results, callback) {

                callback(err);
            }, done);

        });

        it("AZA3-L #ModifyMonitoredItemRequest : server should handle samplingInterval === 0", function (done) {
            var itemToMonitor = "ns=0;i=2258";

            var parameters = {
                samplingInterval: 0, // SAMPLING INTERVAL = 0 => use fastest allowed by server
                discardOldest: false,
                queueSize: 1
            };
            test_modify_monitored_item(itemToMonitor, parameters, function (err, results, callback) {

                callback(err);
            }, done);

        });
        it("AZA3-M #ModifyMonitoredItemsRequest : a client should be able to modify a monitored item", function (done) {

            var itemToMonitor = "ns=0;i=2258";
            var parameters = {
                samplingInterval: 20,
                discardOldest: false,
                queueSize: 1
            };
            test_modify_monitored_item(itemToMonitor, parameters, function (err, results, callback) {

                if (!err) {
                    results.revisedSamplingInterval.should.be.greaterThan(19);
                }
                callback(err);
            }, done);

        });

        function test_modify_monitored_item_on_noValue_attribute(parameters, done) {
            var nodeId = "ns=0;i=2258";
            var itemToMonitor = {
                nodeId: resolveNodeId(nodeId),
                attributeId: AttributeIds.BrowseName
            };


            perform_operation_on_monitoredItem(client, endpointUrl, itemToMonitor, function (session, subscription, monitoredItem, inner_done) {

                var change_count = 0;
                monitoredItem.on("changed", function (dataValue) {
                    //xx console.log("xx changed",dataValue.value.toString());
                    dataValue.value.toString().should.eql("Variant(Scalar<QualifiedName>, value: CurrentTime)");
                    change_count += 1;
                });
                async.series([
                    function (callback) {
                        setTimeout(function () {
                            change_count.should.eql(1);
                            callback();
                        }, 1000);
                    },
                    function (callback) {
                        monitoredItem.modify(parameters, function (err, result) {
                            callback(err);
                        });
                    },
                    function (callback) {
                        // modifying monitoredItem parameters shall not cause the monitored Item to resend a data notification
                        setTimeout(function () {
                            change_count.should.eql(1);
                            callback();
                        }, 1000);
                    },

                    // setting mode to disable
                    function (callback) {
                        monitoredItem.setMonitoringMode(MonitoringMode.Disabled, callback);
                    },
                    // setting mode to disable
                    function (callback) {
                        monitoredItem.setMonitoringMode(MonitoringMode.Reporting, callback);

                    },
                    function (callback) {
                        // Changing mode from Disabled to Reporting shall cause the monitored Item to resend a data notification
                        setTimeout(function () {
                            change_count.should.eql(2);
                            callback();
                        }, 1000);
                    },

                ], inner_done)
            }, done);

        }

        it("AZA3-N #ModifyMonitoredItemRequest on a non-Value attribute: server should handle samplingInterval === 0", function (done) {
            var parameters = {
                samplingInterval: 0, // SAMPLING INTERVAL = 0 => use fastest allowed by server or event base
                discardOldest: false,
                queueSize: 1
            };
            test_modify_monitored_item_on_noValue_attribute(parameters, done);
        });

        it("AZA3-O #ModifyMonitoredItemRequest on a non-Value attribute: server should handle samplingInterval > 0", function (done) {
            var parameters = {
                samplingInterval: 20,
                discardOldest: false,
                queueSize: 1
            };
            test_modify_monitored_item_on_noValue_attribute(parameters, done);
        });

        it("AZA3-P #ModifyMonitoredItemRequest on a non-Value attribute: server should handle samplingInterval === -1", function (done) {
            var parameters = {
                samplingInterval: -1,
                discardOldest: false,
                queueSize: 1
            };
            test_modify_monitored_item_on_noValue_attribute(parameters, done);
        });

        /**
         * see CTT createMonitoredItems591064
         * Description:
         * Create a monitored item with the nodeId set to that of a non-Variable node and
         * the attributeId set to a non-Value attribute. call Publish().
         * Expected Results: All service and operation level results are Good. Publish response contains a DataChangeNotification.
         */
        it("AZA3-Q a monitored item with the nodeId set to that of a non-Variable node an  and the attributeId set to a non-Value attribute should send a DataChangeNotification", function (done) {

            // Attributes, other than the  Value  Attribute, are only monitored for a change in value.
            // The filter is not used for these  Attributes. Any change in value for these  Attributes
            // causes a  Notification  to be  generated.

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var subscription = new ClientSubscription(session, {
                    requestedPublishingInterval: 10,
                    requestedLifetimeCount: 600,
                    requestedMaxKeepAliveCount: 20,
                    maxNotificationsPerPublish: 10,
                    publishingEnabled: true,
                    priority: 6
                });

                subscription.on("terminated", function () {
                    //xx console.log(" subscription terminated ".yellow);
                    inner_done();
                });

                var readValue = {
                    nodeId: resolveNodeId("Server"),
                    attributeId: AttributeIds.DisplayName
                };

                var monitoredItem = subscription.monitor(readValue, {
                      samplingInterval: 10,
                      discardOldest: true,
                      queueSize: 1
                  },
                  TimestampsToReturn.Both);

                monitoredItem.on("err", function (err) {
                    should(err).eql(null);
                });

                var change_count = 0;

                monitoredItem.on("changed", function (dataValue) {
                    //xx console.log("dataValue = ", dataValue.toString());
                    change_count += 1;
                });

                async.series([


                    function (callback) {
                        setTimeout(function () {
                            change_count.should.equal(1);
                            callback();
                        }, 1000);
                    },
                    function (callback) {
                        // on server side : modify displayName
                        var node = server.engine.addressSpace.findNode(readValue.nodeId);
                        node.displayName = "Changed Value";
                        callback();
                    },

                    function (callback) {
                        setTimeout(function () {
                            change_count.should.equal(2);
                            callback();
                        }, 1000);
                    },

                    function (callback) {
                        subscription.terminate();
                        callback();
                    }
                ], function (err) {
                    if (err) {
                        done(err);
                    }
                });


            }, done);


        });

        it("AZA3-R Server should revise publishingInterval to be at least server minimum publishing interval", function (done) {

            var server_minimumPublishingInterval = 100;
            var too_small_PublishingInterval = 30;
            var server_actualPublishingInterval = 100;

            var subscriptionId = -1;

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                async.series([

                    function (callback) {

                        var createSubscriptionRequest = new opcua.subscription_service.CreateSubscriptionRequest({
                            requestedPublishingInterval: too_small_PublishingInterval,
                            requestedLifetimeCount: 60,
                            requestedMaxKeepAliveCount: 10,
                            maxNotificationsPerPublish: 10,
                            publishingEnabled: true,
                            priority: 6
                        });

                        session.performMessageTransaction(createSubscriptionRequest, function (err, response) {

                            subscriptionId = response.subscriptionId;
                            response.revisedPublishingInterval.should.eql(server_minimumPublishingInterval);

                            callback(err);
                        });
                    }

                ], inner_done);

            }, done);
        });

        // If the Server specifies a value for the
        // MinimumSamplingInterval Attribute it shall always return a revisedSamplingInterval that is equal or
        // higher than the MinimumSamplingInterval if the Client subscribes to the Value Attribute.

        function test_revised_sampling_interval(requestedPublishingInterval, requestedSamplingInterval, revisedSamplingInterval, done) {

            var namespaceIndex = 411;
            var nodeId = makeNodeId("Scalar_Static_Int16", namespaceIndex);
            nodeId = opcua.VariableIds.Server_ServerStatus_CurrentTime;

            var node = server.engine.addressSpace.findNode(nodeId);

            //xx console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~".cyan,node.toString());

            var itemToMonitor = new opcua.read_service.ReadValueId({
                nodeId: nodeId,
                attributeId: AttributeIds.Value
            });
            var subscriptionId = -1;
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                async.series([
                    function (callback) {


                        var createSubscriptionRequest = new opcua.subscription_service.CreateSubscriptionRequest({
                            requestedPublishingInterval: requestedPublishingInterval,
                            requestedLifetimeCount: 60,
                            requestedMaxKeepAliveCount: 10,
                            maxNotificationsPerPublish: 10,
                            publishingEnabled: true,
                            priority: 6
                        });

                        session.performMessageTransaction(createSubscriptionRequest, function (err, response) {

                            subscriptionId = response.subscriptionId;
                            callback(err);
                        });
                    },

                    function (callback) {

                        var parameters = {
                            samplingInterval: requestedSamplingInterval,
                            discardOldest: false,
                            queueSize: 1
                        };
                        var createMonitoredItemsRequest = new opcua.subscription_service.CreateMonitoredItemsRequest({

                            subscriptionId: subscriptionId,
                            timestampsToReturn: TimestampsToReturn.Both,
                            itemsToCreate: [{
                                itemToMonitor: itemToMonitor,
                                requestedParameters: parameters,
                                monitoringMode: MonitoringMode.Reporting
                            }]
                        });

                        //xx console.log("createMonitoredItemsRequest = ", createMonitoredItemsRequest.toString());

                        session.performMessageTransaction(createMonitoredItemsRequest, function (err, response) {
                            //xx console.log("ERRR = ", err);
                            should.not.exist(err);
                            response.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                            //xx console.log(response.results[0].toString());

                            response.results[0].statusCode.should.eql(StatusCodes.Good);
                            samplingInterval = response.results[0].revisedSamplingInterval;
                            samplingInterval.should.eql(revisedSamplingInterval, "expected revisedSamplingInterval to be modified");

                            callback(err);
                        });

                    }

                ], inner_done);

            }, done);

        }

        var fastest_possible_sampling_rate = MonitoredItem.minimumSamplingInterval;
        fastest_possible_sampling_rate.should.eql(50);

        it("AZA3-S when createMonitored Item samplingInterval is Zero server shall return the fastest possible sampling rate", function (done) {

            // Spec : OpcUA 1.03 part 4 page 125 7.16 MonitoringParameters:
            // The interval that defines the fastest rate at which the MonitoredItem(s) should be accessed and evaluated.
            // This interval is defined in milliseconds.
            // The value 0 indicates that the Server should use the fastest practical rate.
            test_revised_sampling_interval(0, 0, fastest_possible_sampling_rate, done);
        });

        it("AZA3-T when createMonitored Item samplingInterval is -1 (minus one) server shall return the sampling rate of the subscription 1/2", function (done) {

            // Spec : OpcUA 1.03 part 4 page 125 7.16 MonitoringParameters:
            // The value -1 indicates that the default sampling interval defined by the publishing interval of the
            // Subscription is requested.
            // A different sampling interval is used if the publishing interval is not a
            // supported sampling interval.
            // Any negative number is interpreted as -1. The sampling interval is not changed
            // if the publishing interval is changed by a subsequent call to the ModifySubscription Service.
            test_revised_sampling_interval(100, -1, 100, done);
        });

        it("AZA3-U when createMonitored Item samplingInterval is -1 (minus one) server shall return the sampling rate of the subscription 2/2", function (done) {
            test_revised_sampling_interval(200, -1, 200, done);
        });

        it("AZA3-V when createMonitored Item samplingInterval is too small, server shall return the sampling rate of the subscription", function (done) {
            // Spec : OpcUA 1.03 part 4 page 125 7.16 MonitoringParameters:
            test_revised_sampling_interval(100, 10, fastest_possible_sampling_rate, done);
        });

        xit("AZA3-W When a user adds a monitored item that the user is denied read access to, the add operation for the" +
          " item shall succeed and the bad status  Bad_NotReadable  or  Bad_UserAccessDenied  shall be" +
          " returned in the Publish response",
          function (done) {
              done();
          });

        /**
         * see CTT createMonitoredItems591014 ( -009.js)
         */
        function writeValue(nodeId, session, value, callback) {
            var nodesToWrite = [{
                nodeId: nodeId,
                attributeId: AttributeIds.Value,
                value: /*new DataValue(*/ {
                    serverTimestamp: new Date(),
                    sourceTimestamp: new Date(),
                    value: {
                        /* Variant */
                        dataType: DataType.Double,
                        value: value
                    }
                }
            }];

            setTimeout(function () {
                session.write(nodesToWrite, function (err, statusCodes) {
                    statusCodes.length.should.eql(1);
                    statusCodes[0].should.eql(StatusCodes.Good);
                    setTimeout(function () {
                        callback(err);
                    }, 100);
                });
            }, 100);
        }

        function sendPublishRequest(session, callback) {

            session.publish({}, function (err, response) {
                try {
                    callback(err, response);
                }
                catch (err) {
                    //xx console.log('================> error =>'.red,err);
                    callback(err, response);
                }
            });
        }

        function createSubscription2(session, createSubscriptionRequest, callback) {
            session.performMessageTransaction(createSubscriptionRequest, function (err, response) {
                response.subscriptionId.should.be.greaterThan(0);
                subscriptionId = response.subscriptionId;
                callback(err, response.subscriptionId, response);
            });
        }

        function createSubscription(session, callback) {
            var publishingInterval = 400;
            var createSubscriptionRequest = new opcua.subscription_service.CreateSubscriptionRequest({
                requestedPublishingInterval: publishingInterval,
                requestedLifetimeCount: 60000,
                requestedMaxKeepAliveCount: 10000,
                maxNotificationsPerPublish: 10,
                publishingEnabled: true,
                priority: 6
            });
            createSubscription2(session, createSubscriptionRequest, callback);
        }

        function createMonitoredItems(session, nodeId, parameters, itemToMonitor, callback) {

            /* backdoor */
            var node = server.engine.addressSpace.findNode(nodeId);
            node.minimumSamplingInterval.should.eql(0); // exception-based change notification

            //xx parameters.samplingInterval.should.eql(0);


            var createMonitoredItemsRequest = new opcua.subscription_service.CreateMonitoredItemsRequest({

                subscriptionId: subscriptionId,
                timestampsToReturn: TimestampsToReturn.Both,
                itemsToCreate: [{
                    itemToMonitor: itemToMonitor,
                    requestedParameters: parameters,
                    monitoringMode: MonitoringMode.Reporting
                }]
            });

            session.performMessageTransaction(createMonitoredItemsRequest, function (err, response) {

                response.responseHeader.serviceResult.should.eql(StatusCodes.Good);

                samplingInterval = response.results[0].revisedSamplingInterval;
                //xx console.log(" revised Sampling interval ",samplingInterval);
                callback(err);
            });
        }

        function deleteSubscription(session, callback) {
            session.deleteSubscriptions({
                subscriptionIds: [subscriptionId]
            }, callback);
        }

        function _test_with_queue_size_of_one(parameters, done) {

            var nodeId = nodeIdVariant;

            var itemToMonitor = new opcua.read_service.ReadValueId({
                nodeId: nodeId,
                attributeId: AttributeIds.Value
            });

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                async.series([

                    function (callback) {
                        createSubscription(session, function (err, id) {
                            id.should.be.greaterThan(0);
                            callback(err);
                        });
                    },

                    function (callback) {
                        createMonitoredItems(session, nodeId, parameters, itemToMonitor, callback);
                    },

                    function (callback) {
                        sendPublishRequest(session, function (err, response) {
                            if (!err) {
                                //Xx var notification = response.notificationMessage.notificationData[0].monitoredItems[0];
                            }
                            callback(err);
                        });
                    },

                    function (callback) {
                        writeValue(nodeId, session, 1, callback);
                    },
                    function (callback) {
                        writeValue(nodeId, session, 2, callback);
                    },
                    function (callback) {
                        writeValue(nodeId, session, 3, callback);
                    },
                    function (callback) {
                        writeValue(nodeId, session, 4, callback);
                    },
                    function (callback) {
                        writeValue(nodeId, session, 5, callback);
                    },
                    function (callback) {
                        writeValue(nodeId, session, 6, callback);
                    },
                    function (callback) {
                        writeValue(nodeId, session, 7, callback);
                    },

                    function (callback) {
                        sendPublishRequest(session, function (err, response) {

                            if (!err) {
                                response.notificationMessage.notificationData.length.should.eql(1);

                                var notification = response.notificationMessage.notificationData[0].monitoredItems[0];
                                //xx console.log("notification= ", notification.toString().red);
                                notification.value.value.value.should.eql(7);

                                parameters.queueSize.should.eql(1);
                                notification.value.statusCode.should.eql(StatusCodes.Good, "OverFlow bit shall not be set when queueSize =1");

                            }
                            callback(err);
                        });
                    }

                ], inner_done);

            }, done);

        }

        it("#CTT1 - should make sure that only the latest value is returned when queue size is one and discard oldest is false", function (done) {

            var samplingInterval = 0; // exception based
            var parameters = {
                samplingInterval: samplingInterval,
                discardOldest: false,
                queueSize: 1
            };
            _test_with_queue_size_of_one(parameters, done);

        });
        it("#CTT2 - should make sure that only the latest value is returned when queue size is one and discard oldest is true", function (done) {

            var samplingInterval = 0; // exception based
            var parameters = {
                samplingInterval: samplingInterval,
                discardOldest: true,
                queueSize: 1
            };
            _test_with_queue_size_of_one(parameters, done);
        });

        function _test_with_queue_size_of_two(parameters, expected_values, expected_statusCodes, done) {

            var nodeId = nodeIdVariant;
            var itemToMonitor = new opcua.read_service.ReadValueId({
                nodeId: nodeId,
                attributeId: AttributeIds.Value
            });

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                async.series([

                    function (callback) {
                        createSubscription(session, callback);
                    },

                    function (callback) {
                        createMonitoredItems(session, nodeId, parameters, itemToMonitor, callback);
                    },

                    function (callback) {
                        sendPublishRequest(session, function (err, response) {
                            var notification = response.notificationMessage.notificationData[0].monitoredItems[0];
                            callback(err);
                        });
                    },

                    function (callback) {
                        writeValue(nodeId, session, 1, callback);
                    },
                    function (callback) {
                        writeValue(nodeId, session, 2, callback);
                    },
                    function (callback) {
                        writeValue(nodeId, session, 3, callback);
                    },
                    function (callback) {
                        writeValue(nodeId, session, 4, callback);
                    },
                    function (callback) {
                        writeValue(nodeId, session, 5, callback);
                    },
                    function (callback) {
                        writeValue(nodeId, session, 6, callback);
                    },
                    function (callback) {
                        writeValue(nodeId, session, 7, callback);
                    },
                    function (callback) {
                        setTimeout(callback, 100);
                    },
                    function (callback) {

                        sendPublishRequest(session, function (err, response) {

                            if (!err) {
                                should(!!response.notificationMessage.notificationData).eql(true);
                                response.notificationMessage.notificationData.length.should.eql(1);

                                // we should have 2 elements in queue
                                response.notificationMessage.notificationData[0].monitoredItems.length.should.eql(2);

                                var notification = response.notificationMessage.notificationData[0].monitoredItems[0];
                                //xx console.log(notification.value.value.value);
                                notification.value.value.value.should.eql(expected_values[0]);
                                notification.value.statusCode.should.eql(expected_statusCodes[0]);

                                notification = response.notificationMessage.notificationData[0].monitoredItems[1];
                                //xx console.log(notification.value.value.value);
                                notification.value.value.value.should.eql(expected_values[1]);
                                notification.value.statusCode.should.eql(expected_statusCodes[1]);
                                //xx parameters.queueSize.should.eql(2);
                                //xx notification.value.statusCode.should.eql(StatusCodes.GoodWithOverflowBit, "OverFlow bit shall not be set when queueSize =2");

                            }
                            callback(err);
                        });
                    },
                ], inner_done);

            }, done);

        }

        it("#CTT3 - should make sure that only the last 2 values are returned when queue size is two and discard oldest is TRUE", function (done) {

            var samplingInterval = 0;
            var parameters = {
                samplingInterval: samplingInterval,
                discardOldest: true,
                queueSize: 2
            };

            _test_with_queue_size_of_two(parameters, [6, 7], [StatusCodes.GoodWithOverflowBit, StatusCodes.Good], done);

        });

        it("#CTT4 - should make sure that only the last 2 values are returned when queue size is two and discard oldest is false", function (done) {

            var samplingInterval = 0;
            var parameters = {
                samplingInterval: samplingInterval,
                discardOldest: false,
                queueSize: 2
            };
            _test_with_queue_size_of_two(parameters, [1, 7], [StatusCodes.Good, StatusCodes.GoodWithOverflowBit], done);
        });

        it("#CTT5 Monitoring a non-Variable node with delayed PublishRequest:", function (done) {
            // CTT Monitored Item Service / Monitor Basic / 001.js
            // Description:
            //     Create a monitored item with the nodeId set to that of a non-Variable node and
            //     the attributeId set to a non-Value attribute. call Publish().
            //  Expected Results:
            //      All service and operation level results are Good. Publish response contains a DataChangeNotification.


            var parameters = {
                samplingInterval: 0,
                discardOldest: true,
                queueSize: 1
            };

            var nodeId = nodeIdVariant;

            var itemToMonitor = new opcua.read_service.ReadValueId({
                nodeId: nodeId,
                attributeId: AttributeIds.Description
            });

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                async.series([
                    function (callback) {
                        createSubscription(session, callback);
                    },

                    function (callback) {
                        createMonitoredItems(session, nodeId, parameters, itemToMonitor, callback);
                    },

                    function (callback) {
                        sendPublishRequest(session, function (err, response) {
                            if (!err) {
                                response.notificationMessage.notificationData.length.should.eql(1);

                                //xx console.log("xxxx ", response.notificationMessage.notificationData.toString());

                                //Xx var notification = response.notificationMessage.notificationData[0].monitoredItems[0];
                            }
                            callback(err);
                        });
                    },

                ], inner_done);

            }, done);

        });

        it("#CTT6 Late Publish should have data", function (done) {
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var nodeId = "ns=411;s=Scalar_Static_Double";
                var samplingInterval = 500;
                var parameters = {
                    samplingInterval: samplingInterval,
                    discardOldest: true,
                    queueSize: 2
                };
                var itemToMonitor = new opcua.read_service.ReadValueId({
                    nodeId: nodeId,
                    attributeId: AttributeIds.Value
                });


                var time_to_wait = 0;

                async.series([

                    function (callback) {
                        var publishingInterval = 100;
                        var createSubscriptionRequest = new opcua.subscription_service.CreateSubscriptionRequest({
                            requestedPublishingInterval: publishingInterval,
                            requestedLifetimeCount: 30,
                            requestedMaxKeepAliveCount: 10,
                            maxNotificationsPerPublish: 10,
                            publishingEnabled: true,
                            priority: 6
                        });
                        createSubscription2(session, createSubscriptionRequest, function (err, subscriptionId, response) {
                            time_to_wait = response.revisedPublishingInterval * response.revisedLifetimeCount;
                            callback(err);
                        });
                    },
                    function (callback) {
                        //xx console.log(" SubscriptionId =",subscriptionId);
                        callback();
                    },
                    function (callback) {
                        createMonitoredItems(session, nodeId, parameters, itemToMonitor, callback);
                    },
                    function (callback) {
                        setTimeout(callback, time_to_wait + 1500);
                    },

                    function (callback) {
                        //xx console.log("--------------");
                        // we should get notified immediately that the session has timedout
                        sendPublishRequest(session, function (err, response) {
                            response.notificationMessage.notificationData.length.should.eql(1);
                            var notificationData = response.notificationMessage.notificationData[0];
                            //xx console.log(notificationData.toString());
                            //.monitoredItems[0];
                            notificationData.constructor.name.should.eql("StatusChangeNotification");
                            notificationData.statusCode.should.eql(StatusCodes.BadTimeout);
                            callback(err);
                        });

                    }
                ], inner_done);

            }, done);
        });

        describe("#CTT - Monitored Value Change", function () {

            it("should monitor a substring ", function (done) {

                perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                    var nodeId = nodeIdString;
                    var samplingInterval = 0;

                    var parameters = {
                        samplingInterval: samplingInterval,
                        discardOldest: false,
                        queueSize: 2
                    };

                    var itemToMonitor = new opcua.read_service.ReadValueId({
                        nodeId: nodeId,
                        attributeId: AttributeIds.Value,
                        indexRange: "4:10"
                    });

                    async.series([

                        function (callback) {
                            createSubscription(session, callback);
                        },

                        function (callback) {
                            createMonitoredItems(session, nodeId, parameters, itemToMonitor, callback);
                        },

                        function (callback) {
                            sendPublishRequest(session, function (err, response) {
                                var notification = response.notificationMessage.notificationData[0].monitoredItems[0];
                                //xx console.log("notification", notification.toString());
                                notification.value.value.value.should.eql("EFGHIJK");
                                callback(err);
                            });
                        },

                        function (callback) {

                            var nodesToWrite = [{
                                nodeId: nodeId,
                                attributeId: AttributeIds.Value,
                                value: /*new DataValue(*/ {
                                    value: {
                                        /* Variant */
                                        dataType: DataType.String,
                                        //      01234567890123456789012345
                                        value: "ZYXWVUTSRQPONMLKJIHGFEDCBA"
                                    }
                                }
                            }];

                            session.write(nodesToWrite, function (err, statusCodes) {
                                statusCodes.length.should.eql(1);
                                statusCodes[0].should.eql(StatusCodes.Good);
                                callback(err);
                            });
                        },

                        function (callback) {
                            sendPublishRequest(session, function (err, response) {
                                var notification = response.notificationMessage.notificationData[0].monitoredItems[0];
                                //xx console.log("notification", notification.toString());
                                notification.value.value.value.should.eql("VUTSRQP");
                                callback(err);
                            });
                        }


                    ], inner_done);
                }, done);
            });

            it("ZZE it should return a publish Response with Bad_IndexRangeNoData , when the size of the monitored item change", function (done) {

                // as per CTT test 036.js (MonitoredItem Service/Monitored Value Changed
                // Create a monitored item of an array with an IndexRange of “2:4” (the array must currently have at least five elements).
                // call Publish(). Write to the array such that the size changes to two elements (0:1). call Publish().
                // ExpectedResults:
                // All service and operation level results are Good. Second Publish response contains a DataChangeNotification
                // with a value.statusCode of Bad_IndexRangeNoData.
                perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                    samplingInterval = 0; // exception based

                    var nodeId = "ns=411;s=Scalar_Static_Array_Int32";

                    var parameters = {
                        samplingInterval: 0, // exception based : whenever value changes
                        discardOldest: false,
                        queueSize: 2
                    };

                    var itemToMonitor = new opcua.read_service.ReadValueId({
                        nodeId: nodeId,
                        attributeId: AttributeIds.Value,
                        indexRange: "2:4"
                    });

                    function write_node(value, callback) {
                        assert(value instanceof Array);
                        var nodesToWrite = [{
                            nodeId: nodeId,
                            attributeId: AttributeIds.Value,
                            value: /*new DataValue(*/ {
                                value: {
                                    /* Variant */
                                    arrayType: VariantArrayType.Array,
                                    dataType: DataType.Int32,
                                    value: new Int32Array(value)
                                }
                            }
                        }];
                        session.write(nodesToWrite, function (err, statusCodes) {
                            statusCodes.length.should.eql(1);
                            statusCodes[0].should.eql(StatusCodes.Good);

                            session.read([{
                                attributeId: 13,
                                nodeId: nodeId,
                            }], function (err, a, result) {
                                //xx console.log(" written ",result[0].value.toString());
                                callback(err);
                            });

                        });
                    }

                    async.series([

                        // write initial value => [1,2,3,4,5,6,7,8,9,10]
                        write_node.bind(null, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),

                        function (callback) {
                            createSubscription(session, callback);
                        },

                        function (callback) {
                            createMonitoredItems(session, nodeId, parameters, itemToMonitor, callback);
                        },
                        function (callback) {
                            setTimeout(callback, 10);
                        },
                        function (callback) {
                            sendPublishRequest(session, function (err, response) {
                                var notification = response.notificationMessage.notificationData[0].monitoredItems[0];
                                notification.value.statusCode.should.eql(StatusCodes.Good);
                                notification.value.value.value.should.eql(new Int32Array([2, 3, 4]));
                                callback(err);
                            });
                        },

                        write_node.bind(null, [-1, -2]),

                        function (callback) {
                            sendPublishRequest(session, function (err, response) {
                                var notification = response.notificationMessage.notificationData[0].monitoredItems[0];
                                notification.value.statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
                                notification.value.value.value.should.eql(new Int32Array([]));
                                callback(err);
                            });
                        },

                        write_node.bind(null, [-1, -2, -3]),

                        write_node.bind(null, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),

                        function (callback) {
                            setTimeout(callback, 10);
                        },

                        function (callback) {

                            sendPublishRequest(session, function (err, response) {


                                var notification1 = response.notificationMessage.notificationData[0].monitoredItems[0];
                                notification1.value.statusCode.should.eql(StatusCodes.Good);
                                notification1.value.value.value.should.eql(new Int32Array([-3]));
                                var notification2 = response.notificationMessage.notificationData[0].monitoredItems[1];
                                notification2.value.statusCode.should.eql(StatusCodes.Good);
                                notification2.value.value.value.should.eql(new Int32Array([2, 3, 4]));
                                callback(err);
                            });
                        },

                        write_node.bind(null, [0, 1, 2, 3]),

                        function (callback) {
                            sendPublishRequest(session, function (err, response) {
                                var notification = response.notificationMessage.notificationData[0].monitoredItems[0];
                                notification.value.statusCode.should.eql(StatusCodes.Good);
                                notification.value.value.value.should.eql(new Int32Array([2, 3]));
                                callback(err);
                            });
                        },

                        // restore orignal value
                        write_node.bind(null, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),

                    ], inner_done);


                }, done);


            });

        });

        it("#ModifySubscriptionRequest: should return BadSubscriptionIdInvalid if client specifies a invalid subscriptionId", function (done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var modifySubscriptionRequest = {
                    subscriptionId: 999,
                };

                session.modifySubscription(modifySubscriptionRequest, function (err) {
                    err.message.should.match(/BadSubscriptionIdInvalid/);
                    inner_done();
                });
            }, done);
        });

        it("#ModifySubscriptionRequest: should return StatusGood", function (done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {


                var subscription = new ClientSubscription(session, {
                    requestedPublishingInterval: 10,
                    requestedLifetimeCount: 600,
                    requestedMaxKeepAliveCount: 20,
                    maxNotificationsPerPublish: 10,
                    publishingEnabled: true,
                    priority: 6
                });

                subscription.on("terminated", function () {
                    //xx console.log(" subscription terminated ".yellow);
                    inner_done();
                });
                subscription.on("started", function () {

                    async.series([

                        function (callback) {
                            var modifySubscriptionRequest = {
                                subscriptionId: subscription.subscriptionId,
                                requestedPublishingInterval: 200
                            };
                            session.modifySubscription(modifySubscriptionRequest, function (err, response) {

                                response.revisedPublishingInterval.should.eql(200);

                                callback(err);
                            });
                        },
                        function (callback) {
                            subscription.terminate();
                            callback();
                        }
                    ], function () {
                    });

                });

            }, done);
        });

        it("#SetMonitoringMode, should return BadSubscriptionIdInvalid when subscriptionId is invalid", function (done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                var setMonitoringModeRequest = {
                    subscriptionId: 999,
                };
                session.setMonitoringMode(setMonitoringModeRequest, function (err) {
                    err.message.should.match(/BadSubscriptionIdInvalid/);
                    inner_done();
                });
            }, done);
        });

        it("#SetMonitoringMode, should return BadNothingToDo if monitoredItemId is empty", function (done) {

            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, inner_done) {
                var setMonitoringModeRequest = {
                    subscriptionId: subscription.subscriptionId,
                    monitoredItemIds: []
                };
                session.setMonitoringMode(setMonitoringModeRequest, function (err) {
                    err.message.should.match(/BadNothingToDo/);
                    inner_done();
                });

            }, done);
        });

        it("#SetMonitoringMode, should return BadMonitoredItemIdInvalid is monitoringMode is invalid", function (done) {

            var itemToMonitor = "ns=0;i=2254"; // temperatureVariableId;
            perform_operation_on_monitoredItem(client, endpointUrl, itemToMonitor, function (session, subscription, monitoredItem, inner_done) {
                var setMonitoringModeRequest = {
                    subscriptionId: subscription.subscriptionId,
                    monitoringMode: opcua.subscription_service.MonitoringMode.Invalid,
                    monitoredItemIds: [
                        monitoredItem.monitoredItemId
                    ]
                };
                session.setMonitoringMode(setMonitoringModeRequest, function (err) {
                    err.message.should.match(/BadMonitoringModeInvalid/);
                    inner_done();
                });
            }, done);

        });

        it("#SetMonitoringMode, should return BadMonitoredItemIdInvalid when monitoredItem is invalid", function (done) {
            var itemToMonitor = "ns=0;i=2254"; // temperatureVariableId;
            perform_operation_on_monitoredItem(client, endpointUrl, itemToMonitor, function (session, subscription, monitoredItem, inner_done) {
                var setMonitoringModeRequest = {
                    subscriptionId: subscription.subscriptionId,
                    monitoringMode: opcua.subscription_service.MonitoringMode.Sampling,
                    monitoredItemIds: [
                        monitoredItem.monitoredItemId + 9999
                    ]
                };
                session.setMonitoringMode(setMonitoringModeRequest, function (err, response) {

                    response.results.length.should.eql(1);
                    response.results[0].should.eql(StatusCodes.BadMonitoredItemIdInvalid);
                    inner_done(err);
                });
            }, done);
        });

        it("#SetMonitoringMode, should return Good when request is valid", function (done) {
            var itemToMonitor = "ns=0;i=2254"; // temperatureVariableId;
            perform_operation_on_monitoredItem(client, endpointUrl, itemToMonitor, function (session, subscription, monitoredItem, inner_done) {

                var setMonitoringModeRequest = {
                    subscriptionId: subscription.subscriptionId,
                    monitoringMode: opcua.subscription_service.MonitoringMode.Sampling,
                    monitoredItemIds: [
                        monitoredItem.monitoredItemId
                    ]
                };
                session.setMonitoringMode(setMonitoringModeRequest, function (err, response) {
                    response.results.length.should.eql(1);
                    response.results[0].should.eql(StatusCodes.Good);
                    inner_done(err);
                });
            }, done);
        });

        it("#subscription operations should extend subscription lifetime", function (done) {

            this.timeout(Math.max(200000, this._timeout));

            // see CTT test063

            var monitoredItem;

            function step1(session, subscription, callback) {

                monitoredItem = subscription.monitor({
                    nodeId: resolveNodeId("ns=0;i=2254"),
                    attributeId: AttributeIds.Value
                }, {
                    samplingInterval: 100,
                    discardOldest: true,
                    queueSize: 1
                });

                monitoredItem.on("initialized", function () {
                    callback();
                });
            }

            function step2(session, subscription, callback) {
                var setMonitoringModeRequest = {
                    subscriptionId: subscription.subscriptionId,
                    monitoringMode: opcua.subscription_service.MonitoringMode.Sampling,
                    monitoredItemIds: [
                        monitoredItem.monitoredItemId
                    ]
                };
                session.setMonitoringMode(setMonitoringModeRequest, function (err, response) {
                    response.results[0].should.eql(StatusCodes.Good);
                    callback(err);
                });
            }

            function step3(session, subcription, callback) {
                session.deleteSubscriptions({
                    subscriptionIds: [subcription.subscriptionId]
                }, function (err, response) {
                    should.exist(response);
                    callback(err);
                });
            }

            function my_perform_operation_on_subscription(client, endpointUrl, do_func, done_func) {

                perform_operation_on_client_session(client, endpointUrl, function (session, done) {

                    var subscription;
                    async.series([

                        function (callback) {
                            subscription = new ClientSubscription(session, {
                                requestedPublishingInterval: 100,
                                requestedLifetimeCount: 10 * 60,
                                requestedMaxKeepAliveCount: 10,
                                maxNotificationsPerPublish: 2,
                                publishingEnabled: true,
                                priority: 6
                            });
                            subscription.on("started", function () {
                                callback();
                            });
                        },

                        function (callback) {
                            do_func(session, subscription, callback);
                        },

                        function (callback) {
                            subscription.on("terminated", callback);
                            subscription.terminate();
                        }
                    ], function (err) {
                        done(err);
                    });

                }, done_func);
            }

            my_perform_operation_on_subscription(client, endpointUrl, function (session, subscription, inner_done) {

                subscription.publishingInterval.should.eql(100);
                subscription.maxKeepAliveCount.should.eql(10);

                var waitingTime = subscription.publishingInterval * (subscription.maxKeepAliveCount - 3) - 100;

                var nb_keep_alive_received = 0;
                subscription.on("keepalive", function () {
                    nb_keep_alive_received += 1;
                });

                async.series([

                    function (callback) {
                        nb_keep_alive_received.should.eql(0);
                        callback();
                    },
                    function (callback) {
                        setTimeout(callback, subscription.publishingInterval * 2);
                    },
                    function (callback) {
                        nb_keep_alive_received.should.eql(1);
                        callback();
                    },

                    function (callback) {
                        setTimeout(callback, waitingTime);
                    },
                    function (callback) {
                        step1(session, subscription, callback);
                    },

                    function (callback) {
                        nb_keep_alive_received.should.eql(1);
                        callback();
                    },

                    function (callback) {
                        setTimeout(callback, waitingTime);
                    },
                    function (callback) {
                        step2(session, subscription, callback);
                    },
                    function (callback) {
                        nb_keep_alive_received.should.eql(1);
                        callback();
                    },

                    function (callback) {
                        setTimeout(callback, waitingTime);
                    },
                    function (callback) {
                        step3(session, subscription, callback);
                    },
                    function (callback) {
                        nb_keep_alive_received.should.eql(1);
                        callback();
                    },


                ], inner_done);

            }, done);

        });

        describe("#Republish", function () {
            var DataType = opcua.DataType;
            var Variant = opcua.Variant;

            var VALID_SUBSCRIPTION;
            var VALID_RETRANSMIT_SEQNUM = 0;
            var INVALID_SUBSCRIPTION = 1234;
            var INVALID_RETRANSMIT_SEQNUM = 1234;

            var subscription_service = opcua.subscription_service;
            var read_service = opcua.read_service;
            var g_session;
            var client, fanSpeed;
            before(function (done) {

                VALID_RETRANSMIT_SEQNUM = 0;

                client = new OPCUAClient();
                fanSpeed = server.engine.addressSpace.findNode("ns=2;s=FanSpeed");
                //xxx console.log(fanSpeed.toString());
                done();
            });

            function inner_test(the_test_function, done) {

                perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                    assert(session instanceof ClientSession);
                    g_session = session;
                    async.series([

                        function (callback) {
                            // CreateSubscriptionRequest
                            var request = new subscription_service.CreateSubscriptionRequest({
                                requestedPublishingInterval: 100,
                                requestedLifetimeCount: 1000,
                                requestedMaxKeepAliveCount: 1000,
                                maxNotificationsPerPublish: 2000,
                                publishingEnabled: true,
                                priority: 6
                            });
                            g_session.createSubscription(request, function (err, response) {
                                if (err) {
                                    return callback(err);
                                }
                                VALID_SUBSCRIPTION = response.subscriptionId;
                                callback();
                            });

                        },

                        function (callback) {
                            // CreateMonitoredItemsRequest
                            var request = new subscription_service.CreateMonitoredItemsRequest({
                                subscriptionId: VALID_SUBSCRIPTION,
                                timestampsToReturn: read_service.TimestampsToReturn.Both,
                                itemsToCreate: [
                                    {
                                        itemToMonitor: {
                                            nodeId: fanSpeed.nodeId
                                            // nodeId: opcua.makeNodeId(VariableIds.Server_ServerStatus_CurrentTime)
                                        },
                                        monitoringMode: subscription_service.MonitoringMode.Reporting,
                                        requestedParameters: {
                                            clientHandle: 26,
                                            samplingInterval: 10,
                                            filter: null,
                                            queueSize: 100,
                                            discardOldest: true
                                        }
                                    }
                                ]
                            });

                            g_session.createMonitoredItems(request, function (err, response) {

                                response.should.be.instanceof(subscription_service.CreateMonitoredItemsResponse);
                                response.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                                response.results.length.should.eql(1);
                                response.results[0].statusCode.should.eql(StatusCodes.Good);

                                callback(err);
                            });
                        },

                        function (callback) {
                            fanSpeed.setValueFromSource(new Variant({dataType: DataType.Double, value: 1}));
                            setTimeout(callback, 50);
                            fanSpeed.setValueFromSource(new Variant({dataType: DataType.Double, value: 2}));
                            //console.log(fanSpeed.toString());
                        },

                        //publish_republish,

                        function (callback) {

                            // publish request now requires a subscriptions
                            var request = new subscription_service.PublishRequest({
                                subscriptionAcknowledgements: []
                            });
                            g_session.publish(request, function (err, response) {
                                assert(response instanceof subscription_service.PublishResponse);
                                assert(response.availableSequenceNumbers.length > 0);
                                VALID_RETRANSMIT_SEQNUM = response.availableSequenceNumbers[0];
                                VALID_RETRANSMIT_SEQNUM.should.not.eql(0);

                                callback(err);

                            });

                        },

                        the_test_function

                    ], inner_done);

                }, done);
            }

            it("server should handle Republish request (BadMessageNotAvailable) ", function (done) {

                inner_test(function (done) {
                    var request = new subscription_service.RepublishRequest({
                        subscriptionId: VALID_SUBSCRIPTION,
                        retransmitSequenceNumber: INVALID_RETRANSMIT_SEQNUM
                    });
                    g_session.republish(request, function (err, response) {
                        should.exist(err);
                        response.should.be.instanceof(subscription_service.RepublishResponse);
                        response.responseHeader.serviceResult.should.eql(StatusCodes.BadMessageNotAvailable);
                        done();
                    });
                }, done);

            });

            it("server should handle Republish request (BadSubscriptionIdInvalid) ", function (done) {

                inner_test(function (done) {

                    VALID_RETRANSMIT_SEQNUM.should.not.eql(0);

                    var request = new subscription_service.RepublishRequest({
                        subscriptionId: INVALID_SUBSCRIPTION,
                        retransmitSequenceNumber: VALID_RETRANSMIT_SEQNUM
                    });
                    g_session.republish(request, function (err, response) {
                        should.exist(err);
                        response.should.be.instanceof(subscription_service.RepublishResponse);
                        response.responseHeader.serviceResult.should.eql(StatusCodes.BadSubscriptionIdInvalid);
                        done();
                    });
                }, done);
            });

            it("server should handle Republish request (Good) ", function (done) {

                inner_test(function (done) {

                    VALID_RETRANSMIT_SEQNUM.should.not.eql(0);

                    var request = new subscription_service.RepublishRequest({
                        subscriptionId: VALID_SUBSCRIPTION,
                        retransmitSequenceNumber: VALID_RETRANSMIT_SEQNUM
                    });

                    g_session.republish(request, function (err, response) {
                        response.should.be.instanceof(subscription_service.RepublishResponse);
                        response.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                        done(err);
                    });
                }, done);
            });
        });
    });
};
