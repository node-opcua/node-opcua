/* eslint-disable max-statements */
"use strict";

const chalk = require("chalk");
const { assert } = require("node-opcua-assert");
const async = require("async");
const should = require("should");
const sinon = require("sinon");

const {
    OPCUAClient,
    ClientSession,
    ClientSubscription,
    AttributeIds,
    resolveNodeId,
    makeNodeId,
    StatusCodes,
    DataType,
    TimestampsToReturn,
    MonitoringMode,
    VariantArrayType,
    MonitoredItem,
    ReadValueId,
    ClientMonitoredItem,
    CreateSubscriptionRequest,
    CreateMonitoredItemsResponse,
    CreateMonitoredItemsRequest,
    SetMonitoringModeRequest,
    ModifyMonitoredItemsRequest,
    MonitoredItemModifyRequest,
    DeleteMonitoredItemsRequest,
    ClientMonitoredItemGroup,
    PublishResponse,
    PublishRequest,
    RepublishRequest,
    RepublishResponse,
    OPCUAServer,
    VariableIds,
    Variant,
    Subscription
} = require("node-opcua");
const { make_debugLog, checkDebugFlag } = require("node-opcua-debug");

const {
    perform_operation_on_client_session,
    perform_operation_on_subscription,
    perform_operation_on_subscription_with_parameters,
    perform_operation_on_monitoredItem,
    perform_operation_on_subscription_async
} = require("../../test_helpers/perform_operation_on_client_session");

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const f = require("../../test_helpers/display_function_name").f.bind(null, doDebug);

function trace_console_log() {
    const log1 = global.console.log;
    global.console.log = function () {
        const t = new Error("").stack.split("\n")[2];
        if (t.match(/opcua/)) {
            log1.call(console, chalk.cyan(t));
        }
        log1.apply(console, arguments);
    };
}

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function (test) {
    describe("AZA1- testing Client-Server subscription use case, on a fake server exposing the temperature device", function () {
        let server, client, endpointUrl;

        beforeEach(function (done) {
            client = OPCUAClient.create({});
            server = test.server;
            endpointUrl = test.endpointUrl;
            done();
        });

        afterEach(function (done) {
            client = null;
            done();
        });

        it("AZA1-A should create a ClientSubscription to manage a subscription", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    const subscription = ClientSubscription.create(session, {
                        requestedPublishingInterval: 100,
                        requestedLifetimeCount: 6000,
                        requestedMaxKeepAliveCount: 100,
                        maxNotificationsPerPublish: 5,
                        publishingEnabled: true,
                        priority: 6
                    });
                    subscription.on("started", function () {
                        setTimeout(function () {
                            subscription.terminate(function () {
                                setTimeout(function () {
                                    inner_done();
                                }, 200);
                            });
                        }, 200);
                    });
                },
                done
            );
        });

        it("AZA1-B should dump statistics ", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, done) {
                    const subscription = ClientSubscription.create(session, {
                        requestedPublishingInterval: 100, // ms
                        requestedLifetimeCount: 6000,
                        requestedMaxKeepAliveCount: 100,
                        maxNotificationsPerPublish: 5,
                        publishingEnabled: true,
                        priority: 6
                    });
                    subscription.on("started", function () {
                        setTimeout(function () {
                            subscription.terminate(done);
                        }, 200);
                    });
                },
                done
            );
        });

        it("AZA1-C a ClientSubscription should receive keep-alive events from the server", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, done) {
                    let nb_keep_alive_received = 0;

                    const subscription = ClientSubscription.create(session, {
                        requestedPublishingInterval: 100,
                        requestedLifetimeCount: 6000,
                        requestedMaxKeepAliveCount: 100,
                        maxNotificationsPerPublish: 2,
                        publishingEnabled: true,
                        priority: 6
                    });
                    subscription.on("started", function () {
                        setTimeout(function () {
                            subscription.terminate(function () {
                                nb_keep_alive_received.should.be.greaterThan(0);
                                done();
                            });
                        }, 1000);
                    });
                    subscription.on("keepalive", function () {
                        nb_keep_alive_received += 1;
                    });
                    subscription.on("terminated", function () {
                        //xx console.log(" subscription has received ", nb_keep_alive_received, " keep-alive event(s)");
                    });
                },
                done
            );
        });

        xit("AZA1-D a ClientSubscription should survive longer than the life time", function (done) {
            // todo
            done();
        });

        it("AZA1-E should be possible to monitor an nodeId value with a ClientSubscription", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, done) {
                    const subscription = ClientSubscription.create(session, {
                        requestedPublishingInterval: 150,
                        requestedLifetimeCount: 6000,
                        requestedMaxKeepAliveCount: 100,
                        maxNotificationsPerPublish: 2,
                        publishingEnabled: true,
                        priority: 6
                    });

                    subscription.on("started",  ()=> {
                        debugLog("subscription started")
                    });

                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: resolveNodeId("ns=0;i=2258"),
                            attributeId: AttributeIds.Value
                        },
                        {
                            samplingInterval: 50,
                            discardOldest: true,
                            queueSize: 1
                        }
                    );

                    // subscription.on("item_added",function(monitoredItem){
                    monitoredItem.on("initialized", function () {
                        monitoredItem.terminate(function () {
                            subscription.terminate(done);
                        });
                    });
                },
                done
            );
        });

        it("AZA1-F should be possible to monitor several nodeId value with a single client subscription", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, callback) {
                    const subscription = ClientSubscription.create(session, {
                        requestedPublishingInterval: 50,
                        requestedLifetimeCount: 6000,
                        requestedMaxKeepAliveCount: 100,
                        maxNotificationsPerPublish: 2,
                        publishingEnabled: true,
                        priority: 6
                    });

                    let currentTime_changes = 0;
                    const monitoredItemCurrentTime = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: resolveNodeId("ns=0;i=2258"),
                            attributeId: AttributeIds.Value
                        },
                        {
                            samplingInterval: 20,
                            discardOldest: true,
                            queueSize: 1
                        }
                    );

                    // subscription.on("item_added",function(monitoredItem){
                    monitoredItemCurrentTime.on("changed", function (dataValue) {
                        should.exist(dataValue);
                        //xx console.log("xxxx current time", dataValue.value.value);
                        currentTime_changes++;
                    });

                    const pumpSpeedId = "ns=1;b=0102030405060708090a0b0c0d0e0f10";
                    const monitoredItemPumpSpeed = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: resolveNodeId(pumpSpeedId),
                            attributeId: AttributeIds.Value
                        },
                        {
                            samplingInterval: 20,
                            discardOldest: true,
                            queueSize: 1
                        }
                    );

                    let pumpSpeed_changes = 0;
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
                },
                done
            );
        });

        it("AZA1-G should terminate any pending subscription when the client is disconnected", function (done) {
            let the_session;

            async.series(
                [
                    // connect
                    function (callback) {
                        client.connect(endpointUrl, callback);
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

                    // create subscription
                    function (callback) {
                        const subscription = ClientSubscription.create(the_session, {
                            requestedPublishingInterval: 100,
                            requestedLifetimeCount: 6000,
                            requestedMaxKeepAliveCount: 100,
                            maxNotificationsPerPublish: 5,
                            publishingEnabled: true,
                            priority: 6
                        });
                        subscription.on("started", function () {
                            const monitoredItem = ClientMonitoredItem.create(
                                subscription,
                                {
                                    nodeId: resolveNodeId("ns=0;i=2258"),
                                    attributeId: 13
                                },
                                {
                                    samplingInterval: 100,
                                    discardOldest: true,
                                    queueSize: 1
                                }
                            );
                            monitoredItem.on("initialized", callback);
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
                ],
                function (err) {
                    done(err);
                }
            );
        });

        it("AZA1-H should terminate any pending subscription when the client is disconnected twice", function (done) {
            let the_session;

            async.series(
                [
                    // connect
                    function (callback) {
                        client.connect(endpointUrl, callback);
                    },

                    // create session
                    function (callback) {
                        client.createSession(function (err, session) {
                            if (err) {
                                return callback(err);
                            }
                            the_session = session;
                            callback();
                        });
                    },

                    // create subscription
                    function (callback) {
                        const subscription = ClientSubscription.create(the_session, {
                            requestedPublishingInterval: 100,
                            requestedLifetimeCount: 6000,
                            requestedMaxKeepAliveCount: 100,
                            maxNotificationsPerPublish: 5,
                            publishingEnabled: true,
                            priority: 6
                        });
                        subscription.on("started", function () {
                            // monitor some
                            const monitoredItem = ClientMonitoredItem.create(
                                subscription,
                                {
                                    nodeId: resolveNodeId("ns=0;i=2258"),
                                    attributeId: 13
                                },
                                {
                                    samplingInterval: 100,
                                    discardOldest: true,
                                    queueSize: 1
                                }
                            );

                            // note that at this point the monitoredItem has bee declared in the client
                            // but not created yet on the server side ....
                            monitoredItem.once("initialized", () => {
                                callback();
                            });
                        });
                    },

                    // wait a little bit and disconnect client
                    function (callback) {
                        setTimeout(function () {
                            client.disconnect(callback);
                        }, 600);
                    },

                    // connect the same client again !!!!
                    function (callback) {
                        client.connect(endpointUrl, callback);
                    },

                    // create session again
                    function (callback) {
                        client.createSession(function (err, session) {
                            if (err) {
                                return callback(err);
                            }

                            the_session = session;
                            callback();
                        });
                    },

                    // create subscription again
                    function (callback) {
                        should.exist(the_session);
                        const subscription = ClientSubscription.create(the_session, {
                            requestedPublishingInterval: 100,
                            requestedLifetimeCount: 6000,
                            requestedMaxKeepAliveCount: 100,
                            maxNotificationsPerPublish: 5,
                            publishingEnabled: true,
                            priority: 6
                        });
                        subscription.on("started", function () {
                            // monitor some again
                            const monitoredItem = ClientMonitoredItem.create(
                                subscription,
                                {
                                    nodeId: resolveNodeId("ns=0;i=2258"),
                                    attributeId: 13
                                },
                                {
                                    samplingInterval: 100,
                                    discardOldest: true,
                                    queueSize: 1
                                }
                            );

                            monitoredItem.once("initialized", callback);
                        });
                    },

                    // now disconnect the client, without terminating the subscription &
                    // without closing the session first
                    function (callback) {
                        setTimeout(function () {
                            client.disconnect(callback);
                        }, 400);
                    }
                ],
                function (err) {
                    done(err);
                }
            );
        });
    });

    describe("AZA2- testing server and subscription", function () {
        let server, client, endpointUrl;

        beforeEach(function (done) {
            server = test.server;
            //xx server.restart(function() {

            client = OPCUAClient.create();
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
        //                console.log(chalk.bgWhite.black(" ------------------------------------------------ INNER FUNC"));
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

            const subscriptionIds = [];

            function create_an_other_subscription(session, expected_error, callback) {
                session.createSubscription(
                    {
                        requestedPublishingInterval: 100, // Duration
                        requestedLifetimeCount: 10, // Counter
                        requestedMaxKeepAliveCount: 10, // Counter
                        maxNotificationsPerPublish: 10, // Counter
                        publishingEnabled: true, // Boolean
                        priority: 14 // Byte
                    },
                    function (err, response) {
                        if (!expected_error) {
                            should.not.exist(err);
                            subscriptionIds.push(response.subscriptionId);
                        } else {
                            err.message.should.match(new RegExp(expected_error));
                        }
                        callback();
                    }
                );
            }

            const MAX_SUBSCRIPTION_BACKUP = OPCUAServer.MAX_SUBSCRIPTION;
            OPCUAServer.MAX_SUBSCRIPTION = 5;

            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, done) {
                    async.series(
                        [
                            function (callback) {
                                const nbSessions = server.engine.currentSessionCount;
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
                                session.deleteSubscriptions(
                                    {
                                        subscriptionIds: subscriptionIds
                                    },
                                    function (err, response) {
                                        should.exist(response);
                                        callback(err);
                                    }
                                );
                            }
                        ],
                        function (err) {
                            OPCUAServer.MAX_SUBSCRIPTION = MAX_SUBSCRIPTION_BACKUP;
                            done(err);
                        }
                    );
                },
                done
            );
            //XX                 }, inner_done);
        });

        it(
            "AZA2-B a server should accept several Publish Requests from the client without sending notification immediately," +
                " and should still be able to reply to other requests",
            function (done) {
                let subscriptionId;
                perform_operation_on_client_session(
                    client,
                    endpointUrl,
                    function (session, done) {
                        async.series(
                            [
                                function (callback) {
                                    session.createSubscription(
                                        {
                                            requestedPublishingInterval: 1000, // Duration
                                            requestedLifetimeCount: 1000, // Counter
                                            requestedMaxKeepAliveCount: 100, // Counter
                                            maxNotificationsPerPublish: 10, // Counter
                                            publishingEnabled: true, // Boolean
                                            priority: 14 // Byte
                                        },
                                        function (err, response) {
                                            subscriptionId = response.subscriptionId;
                                            callback(err);
                                        }
                                    );
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
                                    session.deleteSubscriptions(
                                        {
                                            subscriptionIds: [subscriptionId]
                                        },
                                        function (err, response) {
                                            should.exist(response);
                                            callback(err);
                                        }
                                    );
                                }
                            ],
                            function (err) {
                                done(err);
                            }
                        );
                    },
                    done
                );
            }
        );

        it("AZA2-C A Subscription can be added and then deleted", function (done) {
            let subscriptionId;
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, done) {
                    async.series(
                        [
                            function (callback) {
                                session.createSubscription(
                                    {
                                        requestedPublishingInterval: 100, // Duration
                                        requestedLifetimeCount: 10, // Counter
                                        requestedMaxKeepAliveCount: 10, // Counter
                                        maxNotificationsPerPublish: 10, // Counter
                                        publishingEnabled: true, // Boolean
                                        priority: 14 // Byte
                                    },
                                    function (err, response) {
                                        subscriptionId = response.subscriptionId;
                                        callback(err);
                                    }
                                );
                            },

                            function (callback) {
                                session.deleteSubscriptions(
                                    {
                                        subscriptionIds: [subscriptionId]
                                    },
                                    function (err, response) {
                                        should.exist(response);
                                        callback(err);
                                    }
                                );
                            }
                        ],
                        function (err) {
                            done(err);
                        }
                    );
                },
                done
            );
        });

        it("AZA2-D #deleteSubscriptions -  should return serviceResult=BadNothingToDo if subscriptionIds is empty", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, done) {
                    async.series(
                        [
                            function (callback) {
                                session.deleteSubscriptions(
                                    {
                                        subscriptionIds: []
                                    },
                                    function (err, response) {
                                        should.exist(response);
                                        err.message.should.match(/BadNothingToDo/);
                                        callback();
                                    }
                                );
                            }
                        ],
                        function (err) {
                            done(err);
                        }
                    );
                },
                done
            );
        });

        it("AZA2-E A MonitoredItem can be added to a subscription and then deleted", function (done) {
            perform_operation_on_subscription(
                client,
                endpointUrl,
                function (session, subscription, callback) {
                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: resolveNodeId("ns=0;i=2258"),
                            attributeId: AttributeIds.Value
                        },
                        {
                            samplingInterval: 10,
                            discardOldest: true,
                            queueSize: 1
                        }
                    );

                    // subscription.on("item_added",function(monitoredItem){
                    monitoredItem.on("initialized", function () {
                        monitoredItem.terminate(function () {
                            callback();
                        });
                    });
                },
                done
            );
        });

        it("AZA2-F should return BadNodeIdUnknown  if the client tries to monitored an non-existent node", function (done) {
            perform_operation_on_subscription(
                client,
                endpointUrl,
                function (session, subscription, callback) {
                    const itemToMonitor = {
                        nodeId: resolveNodeId("ns=0;s=**unknown**"),
                        attributeId: AttributeIds.Value
                    };
                    const parameters = {
                        samplingInterval: 10,
                        discardOldest: true,
                        queueSize: 1
                    };

                    const monitoredItem = ClientMonitoredItem.create(subscription, itemToMonitor, parameters);

                    monitoredItem.on("err", function (statusMessage) {
                        console.log(" ERR event received");
                        statusMessage.should.eql(StatusCodes.BadNodeIdUnknown.toString());
                        callback();
                    });

                    // subscription.on("item_added",function(monitoredItem){
                    monitoredItem.on("initialized", function () {
                        monitoredItem.terminate(function () {
                            callback(new Error("Should not have been initialized"));
                        });
                    });
                },
                done
            );
        });

        it("AZA2-G should return BadAttributeIdInvalid if the client tries to monitored an invalid attribute", function (done) {
            perform_operation_on_subscription(
                client,
                endpointUrl,
                function (session, subscription, callback) {
                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: resolveNodeId("ns=0;i=2258"),
                            attributeId: AttributeIds.INVALID
                        },
                        {
                            samplingInterval: 10,
                            discardOldest: true,
                            queueSize: 1
                        }
                    );

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
                },
                done
            );
        });

        it("AZA2-H should return BadIndexRangeInvalid if the client tries to monitored with an invalid index range", function (done) {
            perform_operation_on_subscription(
                client,
                endpointUrl,
                function (session, subscription, callback) {
                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: resolveNodeId("ns=0;i=2258"),
                            attributeId: AttributeIds.Value,
                            indexRange: "5:3" // << INTENTIONAL : Invalid Range
                        },
                        {
                            samplingInterval: 10,
                            discardOldest: true,
                            queueSize: 1
                        }
                    );

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
                },
                done
            );
        });

        it("AZA2-I should return BadIndexRangeNoData on first notification if the client tries to monitored with 2D index range when a 1D index range is required", function (done) {
            perform_operation_on_subscription(
                client,
                endpointUrl,
                function (session, subscription, callback) {
                    const notificationMessageSpy = new sinon.spy();
                    subscription.on("raw_notification", notificationMessageSpy);

                    subscription.publishingInterval.should.eql(100);

                    const nodeId = "ns=2;s=Static_Array_Boolean";

                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: nodeId,
                            attributeId: AttributeIds.Value,
                            indexRange: "0:1,0:1" // << INTENTIONAL : 2D RANGE
                        },
                        {
                            samplingInterval: 10,
                            discardOldest: true,
                            queueSize: 1
                        }
                    );

                    monitoredItem.on("err", function (statusMessage) {
                        //xx console.log("Monitored Item error",statusMessage);
                        statusMessage.should.eql(StatusCodes.BadIndexRangeInvalid.toString());
                        callback();
                    });

                    // subscription.on("item_added",function(monitoredItem){
                    monitoredItem.on("initialized", function () {
                        //xx console.log("Monitored Item Initialized")
                    });

                    const monitoredItemOnChangedSpy = new sinon.spy();
                    monitoredItem.on("changed", monitoredItemOnChangedSpy);

                    setTimeout(function () {
                        //xx console.log(notificationMessageSpy.getCall(0).args[0].toString());
                        monitoredItemOnChangedSpy.getCall(0).args[0].statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
                        monitoredItemOnChangedSpy.callCount.should.eql(1, "Only one reply");
                        callback();
                    }, 500);
                },
                done
            );
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
            perform_operation_on_subscription(
                client,
                endpointUrl,
                function (session, subscription, callback) {
                    const notificationMessageSpy = new sinon.spy();
                    subscription.on("raw_notification", notificationMessageSpy);

                    const monitoredItemOnChangedSpy = new sinon.spy();

                    subscription.publishingInterval.should.eql(100);

                    const nodeId = "ns=2;s=Static_Array_Int32";

                    function wait(duration, callback) {
                        setTimeout(callback, duration); // make sure we get inital data
                    }

                    function write(value, indexRange, callback) {
                        assert(typeof callback === "function");
                        assert(Array.isArray(value));

                        const nodeToWrite = {
                            nodeId: nodeId,
                            attributeId: AttributeIds.Value,
                            value: /*new DataValue(*/ {
                                serverTimestamp: null,
                                sourceTimestamp: null,
                                value: {
                                    /* Variant */
                                    dataType: DataType.Int32,
                                    arrayType: VariantArrayType.Array,
                                    value: value
                                }
                            },
                            indexRange: indexRange
                        };

                        session.write(nodeToWrite, function (err, statusCode) {
                            if (!err) {
                                statusCode.should.eql(StatusCodes.Good);
                            }

                            session.read(
                                {
                                    attributeId: AttributeIds.Value,
                                    nodeId: nodeId
                                },
                                function (err, dataValue) {
                                    should.not.exist(err);
                                    should.exist(dataValue);
                                    //xx console.log(" written ",dataValue.toString());
                                    callback(err);
                                }
                            );
                        });
                    }

                    function create_monitored_item(callback) {
                        const monitoredItem = ClientMonitoredItem.create(
                            subscription,
                            {
                                nodeId: nodeId,
                                attributeId: AttributeIds.Value,
                                indexRange: "2:9"
                            },
                            {
                                samplingInterval: 0, // event based
                                discardOldest: true,
                                queueSize: 1
                            },
                            TimestampsToReturn.Both
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

                    async.series(
                        [
                            write.bind(null, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], null),

                            create_monitored_item.bind(null),

                            wait.bind(null, 300),

                            function (callback) {
                                monitoredItemOnChangedSpy.callCount.should.eql(1);
                                monitoredItemOnChangedSpy.getCall(0).args[0].statusCode.should.eql(StatusCodes.Good);
                                //xx console.log(monitoredItemOnChangedSpy.getCall(0).args[0].toString());
                                monitoredItemOnChangedSpy
                                    .getCall(0)
                                    .args[0].value.value.should.eql(new Int32Array([2, 3, 4, 5, 6, 7, 8, 9]));
                                callback();
                            },
                            write.bind(null, [100, 101], "0:1"),
                            wait.bind(null, 300),

                            write.bind(null, [200, 201], "0:1"),
                            wait.bind(null, 300),
                            function (callback) {
                                // no change ! there is no overlap
                                //xx console.log(monitoredItemOnChangedSpy.getCall(1).args[0].value.toString());
                                monitoredItemOnChangedSpy.callCount.should.eql(1);
                                callback();
                            },
                            write.bind(null, [222, 333], "2:3"),
                            wait.bind(null, 300),
                            function (callback) {
                                // there is a overlap ! we should receive a monitoredItem On Change event
                                monitoredItemOnChangedSpy.callCount.should.eql(2);
                                monitoredItemOnChangedSpy
                                    .getCall(1)
                                    .args[0].value.value.should.eql(new Int32Array([222, 333, 4, 5, 6, 7, 8, 9]));
                                callback();
                            }
                        ],
                        callback
                    );
                },
                done
            );
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
            perform_operation_on_subscription(
                client,
                endpointUrl,
                function (session, subscription, callback) {
                    const notificationMessageSpy = new sinon.spy();
                    subscription.on("raw_notification", notificationMessageSpy);

                    const monitoredItemOnChangedSpy = new sinon.spy();

                    subscription.publishingInterval.should.eql(100);

                    const nodeId = "ns=2;s=Static_Array_Int32";

                    function create_monitored_item(callback) {
                        const monitoredItem = ClientMonitoredItem.create(
                            subscription,
                            {
                                nodeId: nodeId,
                                attributeId: AttributeIds.Value,
                                indexRange: "2:4"
                            },
                            {
                                samplingInterval: 100,
                                discardOldest: true,
                                queueSize: 1
                            },
                            TimestampsToReturn.Both
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
                        const nodeToWrite = {
                            nodeId: nodeId,
                            attributeId: AttributeIds.Value,
                            value: /*new DataValue(*/ {
                                value: {
                                    /* Variant */
                                    dataType: DataType.Int32,
                                    arrayType: VariantArrayType.Array,
                                    value: value
                                }
                            }
                        };

                        session.write(nodeToWrite, function (err, statusCode) {
                            if (!err) {
                                statusCode.should.eql(StatusCodes.Good);
                            }
                            session.read(
                                {
                                    attributeId: AttributeIds.Value,
                                    nodeId: nodeId
                                },
                                function (err, dataValue) {
                                    should.exist(dataValue);
                                    ///xx console.log(" written ",dataValue.value.toString());
                                    callback(err);
                                }
                            );
                        });
                    }

                    async.series(
                        [
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
                        ],
                        callback
                    );
                },
                done
            );
        });

        it("AZA2-K1 should not report notification if a monitored value & status are written but did not change", function (done) {
            const subscriptionParameters = {
                requestedPublishingInterval: 100,
                requestedLifetimeCount: 6000,
                requestedMaxKeepAliveCount: 10,
                maxNotificationsPerPublish: 4,
                publishingEnabled: true,
                priority: 6
            };
            // based on CTT : createMonitoredItems591060 - 009.js
            // Description:
            //  - Create one monitored item.
            //  - call Publish().
            //  - Write a status code to the Value  attribute (don’t change the value of the Value attribute).
            //  - call Publish().
            //  - Write the existing value and status code to the Value attribute.
            //  - call Publish().
            // Expected results:
            //   - All service and operation level results are Good.
            //   - The second Publish contains a DataChangeNotification with a value.statusCode matching
            //     the written value (and value.value matching the value before the write).
            //   - The third Publish contains no DataChangeNotifications.
            //     (Did not expect a dataChange since the values written were the same, i.e. unchanged.)
            perform_operation_on_subscription_with_parameters(
                client,
                endpointUrl,
                subscriptionParameters,
                function (session, subscription, callback) {
                    const notificationMessageSpy = new sinon.spy();
                    subscription.on("raw_notification", notificationMessageSpy);
                    subscription.on("raw_notification", (notification) => {
                        // console.log(notification.toString());
                    });

                    const monitoredItemOnChangedSpy = new sinon.spy();
                    const subscription_raw_notificationSpy = new sinon.spy();

                    subscription.publishingInterval.should.eql(100);

                    const nodeId = "ns=2;s=Static_Scalar_Int32";

                    function create_monitored_item(callback) {
                        const monitoredItem = ClientMonitoredItem.create(
                            subscription,
                            {
                                nodeId,
                                attributeId: AttributeIds.Value
                            },
                            {
                                samplingInterval: 20,
                                discardOldest: true,
                                queueSize: 100
                            },
                            TimestampsToReturn.Both
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

                        subscription.on("raw_notification", subscription_raw_notificationSpy);
                    }

                    function wait(duration, callback) {
                        setTimeout(callback, duration);
                    }

                    function write(value, statusCode, callback) {
                        if (doDebug) {
                            console.log("monitoredItemOnChanged count    = ", monitoredItemOnChangedSpy.callCount);
                        }
                        const nodeToWrite = {
                            nodeId: nodeId,
                            attributeId: AttributeIds.Value,
                            value: /*new DataValue(*/ {
                                statusCode,
                                value: {
                                    /* Variant */
                                    dataType: DataType.Int32,
                                    value: value
                                },
                                sourceTimestamp: null
                            }
                        };

                        session.write(nodeToWrite, function (err, statusCode) {
                            if (!err) {
                                statusCode.should.eql(StatusCodes.Good);
                            }
                            session.read(
                                {
                                    attributeId: AttributeIds.Value,
                                    nodeId: nodeId
                                },
                                function (err, dataValue) {
                                    should.exist(dataValue);
                                    // xx console.log(" written ",dataValue.toString());
                                    callback(err);
                                }
                            );
                        });
                    }

                    async.series(
                        [
                            write.bind(null, 1, StatusCodes.Good),
                            wait.bind(null, 300),

                            create_monitored_item.bind(null),
                            wait.bind(null, 300),

                            //  - Write a status code to the Value  attribute (don’t change the value of the Value attribute).
                            write.bind(null, 1, StatusCodes.GoodWithOverflowBit),
                            wait.bind(null, 300),

                            //  - Write the existing value and status code to the Value attribute.
                            write.bind(null, 1, StatusCodes.GoodWithOverflowBit),
                            wait.bind(null, 300),

                            function (callback) {
                                // wait until next notification received;
                                const lambda = (response) => {
                                    if (doDebug) {
                                        console.log(
                                            "response: ",
                                            response.constructor.name,
                                            "notificationData.length",
                                            response.notificationMessage.notificationData.length
                                        );
                                    }
                                    if (response.constructor.name === "PublishResponse") {
                                        client.removeListener("receive_response", lambda);
                                        // console.log(" xxxx ", response.toString());
                                        if (response.notificationMessage.notificationData.length !== 0) {
                                            return callback(
                                                new Error(
                                                    "Test has failed because PublishResponse has a unexpected notification data"
                                                )
                                            );
                                        }
                                        callback();
                                    }
                                };
                                client.on("receive_response", lambda);
                            },
                            //xx wait.bind(null, subscription.publishingInterval * subscription.maxKeepAliveCount + 500),
                            function (callback) {
                                try {
                                    if (doDebug) {
                                        console.log(
                                            "subscription_raw_notificiationSpy = ",
                                            subscription_raw_notificationSpy.callCount
                                        );
                                        console.log("monitoredItemOnChangedSpy         = ", monitoredItemOnChangedSpy.callCount);
                                        for (let i = 0; i < monitoredItemOnChangedSpy.callCount; i++) {
                                            console.log("    ", monitoredItemOnChangedSpy.getCall(i).args[0].statusCode.toString());
                                        }
                                    }
                                    monitoredItemOnChangedSpy.callCount.should.eql(2);
                                    monitoredItemOnChangedSpy.getCall(0).args[0].statusCode.should.eql(StatusCodes.Good);
                                    monitoredItemOnChangedSpy
                                        .getCall(1)
                                        .args[0].statusCode.should.eql(StatusCodes.GoodWithOverflowBit);
                                    callback();
                                } catch (err) {
                                    console.log(err);
                                    callback(err);
                                }
                            }
                        ],
                        callback
                    );
                },
                (err) => {
                    done(err);
                }
            );
        });

        it("AZA2-L disabled monitored item", async () => {
            const nodeId = "ns=2;s=Static_Scalar_Int32";

            const monitoredItemOnChangedSpy = new sinon.spy();
            await perform_operation_on_subscription_async(client, endpointUrl, async (session, subscription) => {
                // create a disabled monitored Item
                const monitoredItem = await subscription.monitor(
                    /* itemToMonitor:*/
                    {
                        nodeId,
                        attributeId: AttributeIds.Value
                    },
                    /* requestedParameters:*/
                    {
                        samplingInterval: 100,
                        discardOldest: true,
                        queueSize: 1
                    },
                    TimestampsToReturn.Both
                );
                monitoredItem.monitoringMode = MonitoringMode.Reporting;
                monitoredItem.on("changed", monitoredItemOnChangedSpy);

                await monitoredItem.setMonitoringMode(MonitoringMode.Disabled);
            });
        });

        it("AZA2-M #CreateMonitoredItemRequest should return BadNothingToDo if CreateMonitoredItemRequest has no nodes to monitored", function (done) {
            perform_operation_on_subscription(
                client,
                endpointUrl,
                function (session, subscription, callback) {
                    const createMonitoredItemsRequest = new CreateMonitoredItemsRequest({
                        subscriptionId: subscription.subscriptionId,
                        timestampsToReturn: TimestampsToReturn.Neither,
                        itemsToCreate: []
                    });
                    session.createMonitoredItems(createMonitoredItemsRequest, function (err, createMonitoredItemsResponse) {
                        should(err.message).match(/BadNothingToDo/);
                        createMonitoredItemsResponse.responseHeader.serviceResult.should.eql(StatusCodes.BadNothingToDo);
                        callback();
                    });
                },
                done
            );
        });

        it("AZA2-N #CreateMonitoredItemRequest should return BadIndexRangeInvalid if a invalid range is passed on CreateMonitoredItemRequest ", function (done) {
            perform_operation_on_subscription(
                client,
                endpointUrl,
                function (session, subscription, callback) {
                    const nodeId = makeNodeId(VariableIds.Server_ServerArray);
                    const samplingInterval = 1000;
                    const itemToMonitor = new ReadValueId({
                        nodeId: nodeId,
                        attributeId: AttributeIds.Value,
                        indexRange: "1:2,3:4"
                    });
                    const parameters = {
                        samplingInterval: samplingInterval,
                        discardOldest: false,
                        queueSize: 1
                    };

                    const createMonitoredItemsRequest = new CreateMonitoredItemsRequest({
                        subscriptionId: subscription.subscriptionId,
                        timestampsToReturn: TimestampsToReturn.Neither,
                        itemsToCreate: [
                            {
                                itemToMonitor: itemToMonitor,
                                requestedParameters: parameters,
                                monitoringMode: MonitoringMode.Reporting
                            }
                        ]
                    });
                    session.createMonitoredItems(createMonitoredItemsRequest, function (err, createMonitoredItemsResponse) {
                        should.not.exist(err);
                        createMonitoredItemsResponse.responseHeader.serviceResult.should.eql(StatusCodes.Good);

                        createMonitoredItemsResponse.results[0].statusCode.should.eql(StatusCodes.Good);
                        callback();
                    });

                    // now publish and check that monitored item returns
                },
                done
            );
        });

        it("AZA2-O should return BadNothingToDo if ModifyMonitoredItemRequest has no nodes to monitored", function (done) {
            perform_operation_on_subscription(
                client,
                endpointUrl,
                function (session, subscription, callback) {
                    const modifyMonitoredItemsRequest = new ModifyMonitoredItemsRequest({
                        subscriptionId: subscription.subscriptionId,
                        timestampsToReturn: TimestampsToReturn.Neither,
                        itemsToModify: []
                    });
                    session.modifyMonitoredItems(modifyMonitoredItemsRequest, function (err, modifyMonitoredItemsResponse) {
                        should(err.message).match(/BadNothingToDo/);
                        modifyMonitoredItemsResponse.responseHeader.serviceResult.should.eql(StatusCodes.BadNothingToDo);
                        callback();
                    });
                },
                done
            );
        });

        it("AZA2-P should return BadNothingToDo if DeleteMonitoredItemsResponse has no nodes to delete", function (done) {
            perform_operation_on_subscription(
                client,
                endpointUrl,
                function (session, subscription, callback) {
                    const deleteMonitoredItemsRequest = new DeleteMonitoredItemsRequest({
                        subscriptionId: subscription.subscriptionId,
                        monitoredItemIds: []
                    });
                    session.deleteMonitoredItems(deleteMonitoredItemsRequest, function (err, deleteMonitoredItemsResponse) {
                        should(err.message).match(/BadNothingToDo/);
                        deleteMonitoredItemsResponse.responseHeader.serviceResult.should.eql(StatusCodes.BadNothingToDo);
                        callback();
                    });
                },
                done
            );
        });

        it("AZA2-Q A MonitoredItem should received changed event", function (done) {
            perform_operation_on_subscription(
                client,
                endpointUrl,
                function (session, subscription, inner_callback) {
                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: resolveNodeId("ns=0;i=2258"),
                            attributeId: AttributeIds.Value
                        },
                        {
                            samplingInterval: 100,
                            discardOldest: true,
                            queueSize: 1
                        }
                    );

                    monitoredItem.on("initialized", function () {
                        debugLog("Initialized");
                    });
                    monitoredItem.on("terminated", function () {
                        debugLog("monitored item terminated");
                    });

                    monitoredItem.on("changed", function (dataValue) {
                        should.exist(dataValue);
                        // the changed event has been received !
                        // lets stop monitoring this item
                        setImmediate(function () {
                            monitoredItem.terminate(inner_callback);
                        });
                    });
                },
                done
            );
        });

        it("AZA2-R A Server should reject a CreateMonitoredItemRequest if timestamp is invalid ( catching error on monitored item )", function (done) {
            perform_operation_on_subscription(
                client,
                endpointUrl,
                (session, subscription, callback) => {
                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: resolveNodeId("ns=0;i=2258"),
                            attributeId: AttributeIds.Value
                        },
                        {
                            samplingInterval: 100,
                            discardOldest: true,
                            queueSize: 1
                        },
                        TimestampsToReturn.Invalid
                    );

                    let err_counter = 0;
                    // subscription.on("item_added",function(monitoredItem){
                    monitoredItem.on("initialized", () => {
                        // eslint-disable-next-line no-debugger
                        // debugger;
                    });

                    monitoredItem.on("changed", (dataValue) => {
                        should.exist(dataValue);
                    });
                    monitoredItem.on("err", (err) => {
                        should.exist(err);
                        err_counter++;
                        console.log("err received => terminated event expected ", err.message);
                    });
                    monitoredItem.on("terminated", () => {
                        console.log("terminated event received");
                        err_counter.should.eql(1);
                        callback();
                    });
                },
                done
            );
        });

        it("AZA2-SA A Server should reject a CreateMonitoredItemRequest if timestamp is invalid ( catching error on callback)", function (done) {
            perform_operation_on_subscription(
                client,
                endpointUrl,
                function (session, subscription, callback) {
                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: resolveNodeId("ns=0;i=2258"),
                            attributeId: 13
                        },
                        {
                            samplingInterval: 100,
                            discardOldest: true,
                            queueSize: 1
                        },
                        TimestampsToReturn.Invalid // <= A invalid  TimestampsToReturn
                    );
                    monitoredItem.on("initialized", () => {
                        callback(new Error("Should not get there"));
                    });
                    monitoredItem.on("err", () => {
                        callback();
                    });
                },
                done
            );
        });

        it("AZA2-SB - GROUP - A Server should reject a CreateMonitoredItemRequest if timestamp is invalid ( catching error on callback)", function (done) {
            perform_operation_on_subscription(
                client,
                endpointUrl,
                function (session, subscription, callback) {
                    const group = ClientMonitoredItemGroup.create(
                        subscription,
                        [
                            {
                                nodeId: resolveNodeId("ns=0;i=2258"),
                                attributeId: 13
                            }
                        ],
                        {
                            samplingInterval: 100,
                            discardOldest: true,
                            queueSize: 1
                        },
                        TimestampsToReturn.Invalid // <= A invalid  TimestampsToReturn
                    );
                    group.on("initialized", () => {
                        callback(new Error("Should not get there"));
                    });
                    group.on("err", () => {
                        callback();
                    });
                },
                done
            );
        });
        it("AZA2-SB A Server should reject a CreateMonitoredItemRequest if timestamp is invalid ( catching error on callback)", function (done) {
            perform_operation_on_subscription(
                client,
                endpointUrl,
                function (session, subscription, callback) {
                    subscription.monitor(
                        {
                            nodeId: resolveNodeId("ns=0;i=2258"),
                            attributeId: 13
                        },
                        {
                            samplingInterval: 100,
                            discardOldest: true,
                            queueSize: 1
                        },
                        TimestampsToReturn.Invalid, // <= A invalid  TimestampsToReturn
                        function (err, monitoredItem) {
                            if (!err) {
                                callback(new Error("Should not get there"));
                            } else {
                                callback();
                            }
                        }
                    );
                },
                done
            );
        });

        it("AZA2-T A Server should be able to revise publish interval to avoid trashing if client specify a very small or zero requestedPublishingInterval", function (done) {
            // from spec OPCUA Version 1.02  Part 4 $5.13.2.2 : requestedPublishingInterval:
            // The negotiated value for this parameter returned in the response is used as the
            // default sampling interval for MonitoredItems assigned to this Subscription.
            // If the requested value is 0 or negative, the server shall revise with the fastest
            // supported publishing interval.
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    session.createSubscription(
                        {
                            requestedPublishingInterval: -1
                        },
                        function (err, createSubscriptionResponse) {
                            createSubscriptionResponse.revisedPublishingInterval.should.be.greaterThan(10);

                            inner_done(err);
                        }
                    );
                },
                done
            );
        });

        it("AZA2-U should handle PublishRequest to confirm closed subscriptions", function (done) {
            let subscriptionId;
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, done) {
                    async.series(
                        [
                            function (callback) {
                                session.createSubscription(
                                    {
                                        requestedPublishingInterval: 200, // Duration
                                        requestedLifetimeCount: 30, // Counter
                                        requestedMaxKeepAliveCount: 10, // Counter
                                        maxNotificationsPerPublish: 10, // Counter
                                        publishingEnabled: true, // Boolean
                                        priority: 14 // Byte
                                    },
                                    function (err, response) {
                                        subscriptionId = response.subscriptionId;
                                        callback(err);
                                    }
                                );
                            },

                            // create a monitored item so we have pending notificiation
                            function (callback) {
                                const namespaceIndex = 2;
                                const nodeId = "s=" + "Static_Scalar_Int16";

                                const node = server.engine.addressSpace.findNode(nodeId);
                                const parameters = {
                                    samplingInterval: 0,
                                    discardOldest: false,
                                    queueSize: 1
                                };
                                const itemToMonitor = {
                                    attributeId: 13,
                                    nodeId: nodeId
                                };
                                const createMonitoredItemsRequest = new CreateMonitoredItemsRequest({
                                    subscriptionId: subscriptionId,
                                    timestampsToReturn: TimestampsToReturn.Both,
                                    itemsToCreate: [
                                        {
                                            itemToMonitor: itemToMonitor,
                                            requestedParameters: parameters,
                                            monitoringMode: MonitoringMode.Reporting
                                        }
                                    ]
                                });
                                session.createMonitoredItems(createMonitoredItemsRequest, function (err, results) {
                                    callback(err);
                                });
                            },
                            function (callback) {
                                setTimeout(callback, 300);
                            },
                            function (callback) {
                                session.deleteSubscriptions(
                                    {
                                        subscriptionIds: [subscriptionId]
                                    },
                                    function (err, response) {
                                        callback(err);
                                    }
                                );
                            },

                            function (callback) {
                                session.publish({}, function (err, publishResult) {
                                    callback();
                                });
                            }
                        ],
                        function (err) {
                            done(err);
                        }
                    );
                },
                done
            );
        });
    });

    describe("AZA3- testing Client-Server subscription use case 2/2, on a fake server exposing the temperature device", function () {
        let server, client, temperatureVariableId, endpointUrl;

        const nodeIdVariant = "ns=1;s=SomeDouble";
        const nodeIdByteString = "ns=1;s=ByteString";
        const nodeIdString = "ns=1;s=String";

        let subscriptionId = null;
        let samplingInterval = -1;

        before(function (done) {
            server = test.server;
            endpointUrl = test.endpointUrl;
            temperatureVariableId = server.temperatureVariableId;

            const namespace = server.engine.addressSpace.getOwnNamespace();

            const rootFolder = server.engine.addressSpace.rootFolder;
            const objectsFolder = rootFolder.objects;

            // Variable with dataItem capable of sending data change notification events
            // this type of variable can be continuously monitored.
            const n1 = namespace.addVariable({
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

            let changeDetected = 0;
            n1.on("value_changed", function (dataValue) {
                changeDetected += 1;
            });

            n1.setValueFromSource({ dataType: DataType.Double, value: 3.14 }, StatusCodes.Good);
            changeDetected.should.equal(1);

            namespace.addVariable({
                organizedBy: objectsFolder,
                browseName: "SomeByteString",
                nodeId: nodeIdByteString,
                dataType: "ByteString",
                value: {
                    dataType: DataType.ByteString,
                    value: Buffer.from("Lorem ipsum", "ascii")
                }
            });
            namespace.addVariable({
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
            client = OPCUAClient.create({
                keepSessionAlive: true,
                requestedSessionTimeout: 240 * 1000 // 4 min ! make sure that session doesn't drop during test
            });
            done();
        });

        afterEach(function (done) {
            client = null;
            done();
        });

        /**
         * async method to create a client subscription
         * @param session
         * @param subscriptionParameters
         * @param callback
         */
        function my_CreateSubscription(session, subscriptionParameters, callback) {
            const subscription = ClientSubscription.create(session, subscriptionParameters);

            subscription.once("started", function () {
                callback(null, subscription);
            });

            // install a little keepalive counter
            subscription.nb_keep_alive_received = 0;
            subscription.on("keepalive", function () {
                subscription.nb_keep_alive_received += 1;
            });

            subscription.on("timeout", function () {
                console.log("Subscription has timed out");
            });
        }

        it("AZA3-A A server should send a StatusChangeNotification (BadTimeout) if the client doesn't send PublishRequest within the expected interval", function (done) {
            if (process.platform === "darwin") {
                return done(); // skipping on MacOS
            }
            //xx endpointUrl = "opc.tcp://localhost:2200/OPCUA/SimulationServer";

            const nb_keep_alive_received = 0;
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

            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    function setUnpublishing(session) {
                        // replace internalSendPublishRequest so that it doesn't do anything for a little while
                        // The publish engine is shared amongst all subscriptions and belongs to the  session object
                        session.getPublishEngine().internalSendPublishRequest.should.be.instanceOf(Function);
                        sinon.stub(session.getPublishEngine(), "internalSendPublishRequest").returns();
                    }

                    /**
                     * restore the publishing mechanism on a unpublishing subscription
                     * @param session
                     */
                    function repairUnpublishing(session) {
                        session.getPublishEngine().internalSendPublishRequest.callCount.should.be.greaterThan(1);
                        session.getPublishEngine().internalSendPublishRequest.restore();
                        session.getPublishEngine().internalSendPublishRequest();
                    }

                    setUnpublishing(session);

                    // in this test we need two subscriptions
                    //    - one subscription with a short live time
                    //    - one subscription with a long life time,
                    //
                    // at the beginning, both subscriptions will not send PublishRequest

                    let longLifeSubscription, shortLifeSubscription;
                    async.series(
                        [
                            f(function create_long_life_subscription(callback) {
                                const subscriptionParameters = {
                                    requestedPublishingInterval: 100, // short publishing interval required here
                                    requestedLifetimeCount: 1000, // long lifetimeCount needed here !
                                    requestedMaxKeepAliveCount: 50,
                                    maxNotificationsPerPublish: 30,
                                    publishingEnabled: true,
                                    priority: 6
                                };

                                my_CreateSubscription(session, subscriptionParameters, function (err, subscription) {
                                    if (err) {
                                        return callback(err);
                                    }
                                    longLifeSubscription = subscription;
                                    setImmediate(callback);
                                });
                            }),

                            f(function create_short_life_subscription(callback) {
                                const subscriptionParameters = {
                                    requestedPublishingInterval: 100, // short publishing interval required here
                                    requestedLifetimeCount: 30, // short lifetimeCount needed here !
                                    requestedMaxKeepAliveCount: 10,
                                    maxNotificationsPerPublish: 30,
                                    publishingEnabled: true,
                                    priority: 6
                                };

                                my_CreateSubscription(session, subscriptionParameters, function (err, subscription) {
                                    if (err) {
                                        return callback(err);
                                    }
                                    shortLifeSubscription = subscription;
                                    setImmediate(callback);
                                });
                            }),
                            f(function wait_for_short_life_subscription_to_expire(callback) {
                                // let's make sure that the subscription will expired
                                const timeToWaitBeforeResendingPublishInterval =
                                    shortLifeSubscription.publishingInterval *
                                    (shortLifeSubscription.lifetimeCount + shortLifeSubscription.maxKeepAliveCount);

                                if (doDebug) {
                                    console.log(shortLifeSubscription.toString());
                                    console.log(
                                        "timetoWaitBeforeResendingPublishInterval  :",
                                        timeToWaitBeforeResendingPublishInterval
                                    );
                                    console.log(
                                        "Count To WaitBeforeResendingPublishInterval  :",
                                        timeToWaitBeforeResendingPublishInterval / shortLifeSubscription.publishingInterval
                                    );
                                }

                                setTimeout(function () {
                                    if (doDebug) {
                                        console.log(" Restoring default Publishing behavior");
                                    }
                                    repairUnpublishing(session);
                                }, timeToWaitBeforeResendingPublishInterval);

                                shortLifeSubscription.once("status_changed", function (statusCode) {
                                    statusCode.should.eql(StatusCodes.BadTimeout);
                                    setImmediate(callback);
                                });
                            }),
                            f(function terminate_short_life_subscription(callback) {
                                const timeout =
                                    shortLifeSubscription.publishingInterval * shortLifeSubscription.maxKeepAliveCount * 2;
                                if (doDebug) {
                                    console.log("timeout = ", timeout);
                                }
                                // let explicitly close the subscription by calling terminate
                                // but delay a little bit so we can verify that internalSendPublishRequest
                                // is not called
                                setTimeout(function () {
                                    shortLifeSubscription.terminate(function (err) {
                                        shortLifeSubscription.nb_keep_alive_received.should.be.equal(0);
                                        setImmediate(callback);
                                    });
                                }, timeout);
                            }),
                            f(function terminate_long_life_subscription(callback) {
                                longLifeSubscription.terminate(function (err) {
                                    setImmediate(callback);
                                });
                            })
                        ],
                        inner_done
                    );
                },
                done
            );
        });

        it("AZA3-B A subscription without a monitored item should not dropped too early ( see #59)", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    const subscription = ClientSubscription.create(session, {
                        requestedPublishingInterval: 100,
                        requestedLifetimeCount: 6000,
                        requestedMaxKeepAliveCount: 100,
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
                },
                done
            );
        });

        it("AZA3-C #bytesRead #transactionsCount #bytesWritten", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    server.bytesRead.should.be.greaterThan(10);
                    server.transactionsCount.should.be.greaterThan(3);
                    server.bytesWritten.should.be.greaterThan(10);
                    inner_done();
                },
                done
            );
        });

        it("AZA3-D #CreateMonitoredItemsRequest : A server should return statusCode === BadSubscriptionIdInvalid when appropriate  ", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    const options = {
                        subscriptionId: 999 // << invalide subscription id
                    };
                    session.createMonitoredItems(options, function (err, results) {
                        err.message.should.match(/BadSubscriptionIdInvalid/);
                        inner_done();
                    });
                },
                done
            );
        });

        it("AZA3-E #SetPublishingModeRequest: A server should set status codes to BadSubscriptionIdInvalid when appropriate  ", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    const publishingEnabled = true;
                    const subscriptionIds = [999]; //<< invalid subscription ID
                    session.setPublishingMode(publishingEnabled, subscriptionIds, function (err, results) {
                        results.should.be.instanceOf(Array);
                        results[0].should.eql(StatusCodes.BadSubscriptionIdInvalid);
                        inner_done(err);
                    });
                },
                done
            );
        });

        it("AZA3-F A server should suspend/resume publishing when client send a setPublishingMode Request ", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    const parameters = {
                        requestedPublishingInterval: 100,
                        requestedLifetimeCount: 6000,
                        requestedMaxKeepAliveCount: 100,
                        maxNotificationsPerPublish: 10,
                        publishingEnabled: true,
                        priority: 6
                    };

                    const subscription = ClientSubscription.create(session, parameters);

                    subscription.on("terminated", function () {
                        debugLog("subscription terminated")
                    });

                    const itemToMonitor = {
                        nodeId: resolveNodeId("ns=0;i=2258"),
                        attributeId: AttributeIds.Value
                    };
                    const monitoringParameters = {
                        samplingInterval: 10,
                        discardOldest: true,
                        queueSize: 1
                    };
                    const monitoredItem = ClientMonitoredItem.create(subscription, itemToMonitor, monitoringParameters);

                    let change_count = 0;
                    monitoredItem.on("changed", function (dataValue) {
                        change_count += 1;
                        should.exist(dataValue);
                        //xx console.log("xxxxxxxxxxxx=> dataValue",dataValue.toString());
                    });

                    async.series(
                        [
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
                                subscription.terminate(function (err) {
                                    callback(err);
                                });
                            }
                        ],
                        inner_done
                    );
                },
                done
            );
        });

        it("AZA3-G A client should be able to create a subscription that have  publishingEnable=false", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    const subscription = ClientSubscription.create(session, {
                        requestedPublishingInterval: 100,
                        requestedLifetimeCount: 6000,
                        requestedMaxKeepAliveCount: 100,
                        maxNotificationsPerPublish: 10,
                        publishingEnabled: false,
                        priority: 6
                    });

                    subscription.on("terminated", function () {
                        debugLog("subscription terminated");
                    });
                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: resolveNodeId("ns=0;i=2258"),
                            attributeId: AttributeIds.Value
                        },
                        {
                            samplingInterval: 10,
                            discardOldest: true,
                            queueSize: 1
                        }
                    );

                    let change_count = 0;
                    monitoredItem.on("changed", function (dataValue) {
                        should.exist(dataValue);
                        change_count += 1;
                    });
                    async.series(
                        [
                            function (callback) {
                                // wait 400 ms and verify that the subscription is not sending notification.
                                setTimeout(function () {
                                    change_count.should.equal(0);
                                    callback();
                                }, 400);
                            }
                        ],
                        inner_done
                    );
                },
                done
            );
        });

        it("AZA3-H #ModifyMonitoredItemRequest : server should send BadSubscriptionIdInvalid if client send a wrong subscription id", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    const modifyMonitoredItemsRequest = {
                        subscriptionId: 999,
                        timestampsToReturn: TimestampsToReturn.Neither,
                        itemsToModify: [{}]
                    };

                    session.modifyMonitoredItems(modifyMonitoredItemsRequest, function (err) {
                        err.message.should.match(/BadSubscriptionIdInvalid/);
                        inner_done();
                    });
                },
                done
            );
        });

        it("AZA3-I #ModifyMonitoredItemRequest : server should send BadSubscriptionIdInvalid if client send a wrong subscription id", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    const subscription = ClientSubscription.create(session, {
                        requestedPublishingInterval: 100,
                        requestedLifetimeCount: 6000,
                        requestedMaxKeepAliveCount: 100,
                        maxNotificationsPerPublish: 10,
                        publishingEnabled: true,
                        priority: 6
                    });
                    subscription.on("started", function () {
                        const modifyMonitoredItemsRequest = {
                            subscriptionId: subscription.subscriptionId,
                            timestampsToReturn: TimestampsToReturn.Invalid
                        };

                        session.modifyMonitoredItems(modifyMonitoredItemsRequest, function (err, modifyMonitoredItemsResponse) {
                            err.message.should.match(/BadTimestampsToReturnInvalid/);
                            inner_done();
                        });
                    });
                },
                done
            );
        });

        it("AZA3-J #ModifyMonitoredItemRequest : server should send BadMonitoredItemIdInvalid  if client send a wrong monitored item id", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    const subscription = ClientSubscription.create(session, {
                        requestedPublishingInterval: 200,
                        requestedLifetimeCount: 60000,
                        requestedMaxKeepAliveCount: 10,
                        maxNotificationsPerPublish: 10,
                        publishingEnabled: true,
                        priority: 6
                    });
                    subscription.on("started", function () {
                        const modifyMonitoredItemsRequest = {
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
                },
                done
            );
        });

        function test_modify_monitored_item(itemToMonitor, parameters, inner_func, done) {
            perform_operation_on_monitoredItem(
                client,
                endpointUrl,
                itemToMonitor,
                function (session, subscription, monitoredItem, inner_done) {
                    let change_count = 0;
                    subscription.publishingInterval.should.be.aboveOrEqual(100);
                    monitoredItem.on("changed", function (dataValue) {
                        //xx console.log("xx changed",dataValue.value.toString());
                        change_count += 1;
                    });

                    async.series(
                        [
                            function (callback) {
                                setTimeout(callback, 1500);
                            },
                            function (callback) {
                                // let's wait for first notification to be received
                                monitoredItem.once("changed", () => {
                                    // we reset change count,
                                    change_count = 0;
                                    callback();
                                });
                            },
                            function (callback) {
                                // wait at least 2 x publishingInterval ms and verify that the subscription is not sending notification.
                                setTimeout(() => {
                                    change_count.should.equal(0);
                                    callback();
                                }, 800);
                            },

                            function (callback) {
                                // let modify monitored item with new parameters.
                                monitoredItem.modify(parameters, function (err, result) {
                                    inner_func(err, result, callback);
                                });
                            },

                            function (callback) {
                                // wait 1.5 ms and verify that the subscription is now sending notification.
                                setTimeout(() => {
                                    change_count.should.be.greaterThan(1);
                                    callback();
                                }, 2000); // wait at least 2 seconds as date resolution is 1 sec.
                            }
                        ],
                        inner_done
                    );
                },
                done
            ); //
        }

        it("AZA3-K #ModifyMonitoredItemRequest : server should handle samplingInterval === -1", function (done) {
            const itemToMonitor = "ns=0;i=2258";

            /**
             * The value - 1 indicates that the default sampling interval defined
             * by the publishing interval of the Subscription is requested.A different
             * sampling interval is used if the publishing interval is not a supported
             * sampling interval.Any negative number is interpreted as -1. The sampling
             * interval is not changed if the publishing interval is changed by a
             * subsequent call to the ModifySubscription Service.
             */

            const parameters = {
                samplingInterval: -1, // SAMPLING INTERVAL = -1
                discardOldest: false,
                queueSize: 1
            };
            test_modify_monitored_item(
                itemToMonitor,
                parameters,
                function (err, results, callback) {
                    callback(err);
                },
                done
            );
        });

        it("AZA3-L #ModifyMonitoredItemRequest : server should handle samplingInterval === 0", function (done) {
            const itemToMonitor = "ns=0;i=2258";

            const parameters = {
                samplingInterval: 0, // SAMPLING INTERVAL = 0 => use fastest allowed by server
                discardOldest: false,
                queueSize: 1
            };
            test_modify_monitored_item(
                itemToMonitor,
                parameters,
                function (err, results, callback) {
                    callback(err);
                },
                done
            );
        });
        it("AZA3-M #ModifyMonitoredItemsRequest : a client should be able to modify a monitored item", function (done) {
            const itemToMonitor = "ns=0;i=2258";
            const parameters = {
                samplingInterval: 20,
                discardOldest: false,
                queueSize: 1
            };
            test_modify_monitored_item(
                itemToMonitor,
                parameters,
                function (err, results, callback) {
                    if (!err) {
                        results.revisedSamplingInterval.should.be.greaterThan(19);
                    }
                    callback(err);
                },
                done
            );
        });

        function test_modify_monitored_item_on_noValue_attribute(parameters, done) {
            const nodeId = "ns=0;i=2258";
            const itemToMonitor = {
                nodeId: resolveNodeId(nodeId),
                attributeId: AttributeIds.BrowseName
            };

            perform_operation_on_monitoredItem(
                client,
                endpointUrl,
                itemToMonitor,
                function (session, subscription, monitoredItem, inner_done) {
                    let change_count = 0;
                    monitoredItem.on("changed", function (dataValue) {
                        //xx console.log("xx changed",dataValue.value.toString());
                        dataValue.value.toString().should.eql("Variant(Scalar<QualifiedName>, value: CurrentTime)");
                        change_count += 1;
                    });
                    async.series(
                        [
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
                            }
                        ],
                        inner_done
                    );
                },
                done
            );
        }

        it("AZA3-N #ModifyMonitoredItemRequest on a non-Value attribute: server should handle samplingInterval === 0", function (done) {
            const parameters = {
                samplingInterval: 0, // SAMPLING INTERVAL = 0 => use fastest allowed by server or event base
                discardOldest: false,
                queueSize: 1
            };
            test_modify_monitored_item_on_noValue_attribute(parameters, done);
        });

        it("AZA3-O #ModifyMonitoredItemRequest on a non-Value attribute: server should handle samplingInterval > 0", function (done) {
            const parameters = {
                samplingInterval: 20,
                discardOldest: false,
                queueSize: 1
            };
            test_modify_monitored_item_on_noValue_attribute(parameters, done);
        });

        it("AZA3-P #ModifyMonitoredItemRequest on a non-Value attribute: server should handle samplingInterval === -1", function (done) {
            const parameters = {
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

            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    const subscription = ClientSubscription.create(session, {
                        requestedPublishingInterval: 10,
                        requestedLifetimeCount: 6000,
                        requestedMaxKeepAliveCount: 10,
                        maxNotificationsPerPublish: 10,
                        publishingEnabled: true,
                        priority: 6
                    });

                    subscription.on("terminated", function () {
                        //xx console.log(chalk.yellow(" subscription terminated "));
                        inner_done();
                    });

                    const readValue = {
                        nodeId: resolveNodeId("Server"),
                        attributeId: AttributeIds.DisplayName
                    };

                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        readValue,
                        {
                            samplingInterval: 10,
                            discardOldest: true,
                            queueSize: 1
                        },
                        TimestampsToReturn.Both
                    );

                    monitoredItem.on("err", function (err) {
                        should.not.exist(err);
                    });

                    let change_count = 0;

                    monitoredItem.on("changed", function (dataValue) {
                        //xx console.log("dataValue = ", dataValue.toString());
                        change_count += 1;
                    });

                    async.series(
                        [
                            function (callback) {
                                setTimeout(function () {
                                    change_count.should.equal(1);
                                    callback();
                                }, 1000);
                            },
                            function (callback) {
                                // on server side : modify displayName
                                const node = server.engine.addressSpace.findNode(readValue.nodeId);
                                node.setDisplayName("Changed Value");
                                callback();
                            },

                            function (callback) {
                                setTimeout(function () {
                                    change_count.should.equal(2);
                                    callback();
                                }, 1000);
                            },

                            function (callback) {
                                subscription.terminate(callback);
                            }
                        ],
                        function (err) {
                            if (err) {
                                done(err);
                            }
                        }
                    );
                },
                done
            );
        });

        it("AZA3-R Server should revise publishingInterval to be at least server minimum publishing interval", function (done) {
            Subscription.minimumPublishingInterval.should.eql(50);
            const too_small_PublishingInterval = 30;
            const server_actualPublishingInterval = 100;

            let subscriptionId = -1;

            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    async.series(
                        [
                            function (callback) {
                                const createSubscriptionRequest = new CreateSubscriptionRequest({
                                    requestedPublishingInterval: too_small_PublishingInterval,
                                    requestedLifetimeCount: 60,
                                    requestedMaxKeepAliveCount: 10,
                                    maxNotificationsPerPublish: 10,
                                    publishingEnabled: true,
                                    priority: 6
                                });

                                session.performMessageTransaction(createSubscriptionRequest, function (err, response) {
                                    if (err) {
                                        return callback(err);
                                    }

                                    if (doDebug) {
                                        console.log("response", response.toString());
                                    }

                                    subscriptionId = response.subscriptionId;
                                    response.revisedPublishingInterval.should.eql(Subscription.minimumPublishingInterval);

                                    callback(err);
                                });
                            }
                        ],
                        inner_done
                    );
                },
                done
            );
        });

        // If the Server specifies a value for the
        // MinimumSamplingInterval Attribute it shall always return a revisedSamplingInterval that is equal or
        // higher than the MinimumSamplingInterval if the Client subscribes to the Value Attribute.

        function test_revised_sampling_interval(
            requestedPublishingInterval,
            requestedSamplingInterval,
            revisedSamplingInterval,
            done
        ) {
            const forcedMinimumInterval = 1;
            const nodeId = "ns=2;s=Static_Scalar_Int16";

            const node = server.engine.addressSpace.findNode(nodeId);
            //xx console.log(chalk.cyan("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"),node.toString());
            const server_node = test.server.engine.addressSpace.rootFolder.objects.simulation.static["all Profiles"].scalars.int16;
            //xx console.log("server_node.minimumSamplingInterval = ",server_node.minimumSamplingInterval);
            server_node.minimumSamplingInterval = forcedMinimumInterval;

            const itemToMonitor = new ReadValueId({
                nodeId: nodeId,
                attributeId: AttributeIds.Value
            });
            let subscriptionId = -1;
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    async.series(
                        [
                            function read_minimumSamplingInterval(callback) {
                                let minimumSamplingIntervalOnNode;
                                const nodeToRead = {
                                    nodeId: nodeId,
                                    attributeId: AttributeIds.MinimumSamplingInterval
                                };
                                session.read(nodeToRead, function (err, dataValue) {
                                    if (err) {
                                        return callback(err);
                                    }
                                    dataValue.statusCode.should.eql(StatusCodes.Good);
                                    minimumSamplingIntervalOnNode = dataValue.value.value;
                                    //xx console.log("minimumSamplingIntervalOnNode= =",minimumSamplingIntervalOnNode);

                                    minimumSamplingIntervalOnNode.should.eql(forcedMinimumInterval);

                                    callback();
                                });
                            },
                            function (callback) {
                                const createSubscriptionRequest = new CreateSubscriptionRequest({
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
                                const parameters = {
                                    samplingInterval: requestedSamplingInterval,
                                    discardOldest: false,
                                    queueSize: 1
                                };
                                const createMonitoredItemsRequest = new CreateMonitoredItemsRequest({
                                    subscriptionId: subscriptionId,
                                    timestampsToReturn: TimestampsToReturn.Both,
                                    itemsToCreate: [
                                        {
                                            itemToMonitor: itemToMonitor,
                                            requestedParameters: parameters,
                                            monitoringMode: MonitoringMode.Reporting
                                        }
                                    ]
                                });

                                //xx console.log("createMonitoredItemsRequest = ", createMonitoredItemsRequest.toString());

                                session.performMessageTransaction(createMonitoredItemsRequest, function (err, response) {
                                    if (err) {
                                        return callback(err);
                                    }
                                    //xx console.log("ERRR = ", err);
                                    should.not.exist(err);
                                    response.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                                    //xx console.log(response.results[0].toString());

                                    response.results[0].statusCode.should.eql(StatusCodes.Good);
                                    samplingInterval = response.results[0].revisedSamplingInterval;
                                    samplingInterval.should.eql(
                                        revisedSamplingInterval,
                                        "expected revisedSamplingInterval to be modified"
                                    );

                                    callback(err);
                                });
                            }
                        ],
                        inner_done
                    );
                },
                done
            );
        }

        const fastest_possible_sampling_rate = MonitoredItem.minimumSamplingInterval;
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

        xit(
            "AZA3-W When a user adds a monitored item that the user is denied read access to, the add operation for the" +
                " item shall succeed and the bad status  Bad_NotReadable  or  Bad_UserAccessDenied  shall be" +
                " returned in the Publish response",
            function (done) {
                done();
            }
        );

        /**
         * see CTT createMonitoredItems591014 ( -009.js)
         */
        function writeValue(nodeId, session, value, callback) {
            const nodesToWrite = [
                {
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
                }
            ];

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
                } catch (err) {
                    //xx console.log('================> error =>'.red,err);
                    callback(err, response);
                }
            });
        }

        function createSubscription2(session, createSubscriptionRequest, callback) {
            createSubscriptionRequest = new CreateSubscriptionRequest(createSubscriptionRequest);

            (typeof callback === "function").should.eql(true, "expecting a function");

            session.performMessageTransaction(createSubscriptionRequest, function (err, response) {
                response.subscriptionId.should.be.greaterThan(0);
                subscriptionId = response.subscriptionId;
                callback(err, response.subscriptionId, response);
            });
        }

        const publishingInterval = 40;

        function createSubscription(session, callback) {
            (typeof callback === "function").should.eql(true, "expecting a function");
            const createSubscriptionRequest = {
                requestedPublishingInterval: publishingInterval,
                requestedLifetimeCount: 600,
                requestedMaxKeepAliveCount: 10,
                maxNotificationsPerPublish: 10,
                publishingEnabled: true,
                priority: 6
            };
            createSubscription2(session, createSubscriptionRequest, callback);
        }

        function createMonitoredItems(session, nodeId, parameters, itemToMonitor, callback) {
            /* backdoor */
            const node = server.engine.addressSpace.findNode(nodeId);
            should.exist(node, " " + nodeId.toString() + " must exist");
            node.minimumSamplingInterval.should.eql(0); // exception-based change notification

            //xx parameters.samplingInterval.should.eql(0);

            const createMonitoredItemsRequest = new CreateMonitoredItemsRequest({
                subscriptionId: subscriptionId,
                timestampsToReturn: TimestampsToReturn.Both,
                itemsToCreate: [
                    {
                        itemToMonitor: itemToMonitor,
                        requestedParameters: parameters,
                        monitoringMode: MonitoringMode.Reporting
                    }
                ]
            });

            session.performMessageTransaction(createMonitoredItemsRequest, function (err, response) {
                response.responseHeader.serviceResult.should.eql(StatusCodes.Good);

                samplingInterval = response.results[0].revisedSamplingInterval;
                //xx console.log(" revised Sampling interval ",samplingInterval);
                callback(err);
            });
        }

        function deleteSubscription(session, callback) {
            session.deleteSubscriptions(
                {
                    subscriptionIds: [subscriptionId]
                },
                callback
            );
        }

        function _test_with_queue_size_of_one(parameters, done) {
            const nodeId = nodeIdVariant;

            const itemToMonitor = new ReadValueId({
                nodeId: nodeId,
                attributeId: AttributeIds.Value
            });

            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    async.series(
                        [
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

                                        const notification = response.notificationMessage.notificationData[0].monitoredItems[0];
                                        notification.value.value.value.should.eql(7);

                                        parameters.queueSize.should.eql(1);
                                        notification.value.statusCode.should.eql(
                                            StatusCodes.Good,
                                            "OverFlow bit shall not be set when queueSize =1"
                                        );
                                    }
                                    callback(err);
                                });
                            }
                        ],
                        inner_done
                    );
                },
                done
            );
        }

        it("#CTT1 - should make sure that only the latest value is returned when queue size is one and discard oldest is false", function (done) {
            const samplingInterval = 0; // exception based
            const parameters = {
                samplingInterval: samplingInterval,
                discardOldest: false,
                queueSize: 1
            };
            _test_with_queue_size_of_one(parameters, done);
        });
        it("#CTT2 - should make sure that only the latest value is returned when queue size is one and discard oldest is true", function (done) {
            const samplingInterval = 0; // exception based
            const parameters = {
                samplingInterval: samplingInterval,
                discardOldest: true,
                queueSize: 1
            };
            _test_with_queue_size_of_one(parameters, done);
        });

        function _test_with_queue_size_of_two(parameters, expected_values, expected_statusCodes, done) {
            const nodeId = nodeIdVariant;
            const itemToMonitor = new ReadValueId({
                nodeId: nodeId,
                attributeId: AttributeIds.Value
            });

            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    async.series(
                        [
                            function (callback) {
                                createSubscription(session, callback);
                            },

                            function (callback) {
                                createMonitoredItems(session, nodeId, parameters, itemToMonitor, callback);
                            },

                            function (callback) {
                                sendPublishRequest(session, function (err, response) {
                                    const notification = response.notificationMessage.notificationData[0].monitoredItems[0];
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
                            function wait_a_little_bit(callback) {
                                setTimeout(callback, 1000);
                            },
                            function (callback) {
                                sendPublishRequest(session, function (err, response) {
                                    if (!err) {
                                        should(!!response.notificationMessage.notificationData).eql(true);
                                        response.notificationMessage.notificationData.length.should.eql(1);

                                        // we should have 2 elements in queue
                                        response.notificationMessage.notificationData[0].monitoredItems.length.should.eql(2);

                                        let notification = response.notificationMessage.notificationData[0].monitoredItems[0];
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
                            }
                        ],
                        inner_done
                    );
                },
                done
            );
        }

        it("#CTT3 - should make sure that only the last 2 values are returned when queue size is two and discard oldest is TRUE", function (done) {
            const samplingInterval = 0;
            const parameters = {
                samplingInterval: samplingInterval,
                discardOldest: true,
                queueSize: 2
            };

            _test_with_queue_size_of_two(parameters, [6, 7], [StatusCodes.GoodWithOverflowBit, StatusCodes.Good], done);
        });

        it("#CTT4 - should make sure that only the last 2 values are returned when queue size is two and discard oldest is false", function (done) {
            const samplingInterval = 0;
            const parameters = {
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

            const parameters = {
                samplingInterval: 0,
                discardOldest: true,
                queueSize: 1
            };

            const nodeId = nodeIdVariant;

            const itemToMonitor = new ReadValueId({
                nodeId: nodeId,
                attributeId: AttributeIds.Description
            });

            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    async.series(
                        [
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
                            }
                        ],
                        inner_done
                    );
                },
                done
            );
        });

        it("#CTT6 Late Publish should have data", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    const nodeId = "ns=2;s=Static_Scalar_Double";
                    const samplingInterval = 500;
                    const parameters = {
                        samplingInterval: samplingInterval,
                        discardOldest: true,
                        queueSize: 2
                    };
                    const itemToMonitor = new ReadValueId({
                        nodeId: nodeId,
                        attributeId: AttributeIds.Value
                    });

                    let time_to_wait = 0;

                    async.series(
                        [
                            function (callback) {
                                const publishingInterval = 100;
                                const createSubscriptionRequest = new CreateSubscriptionRequest({
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
                                // we should get notified immediately that the session has timed out
                                sendPublishRequest(session, function (err, response) {
                                    response.notificationMessage.notificationData.length.should.eql(1);
                                    const notificationData = response.notificationMessage.notificationData[0];
                                    //xx console.log(notificationData.toString());
                                    //.monitoredItems[0];
                                    notificationData.constructor.name.should.eql("StatusChangeNotification");
                                    notificationData.status.should.eql(StatusCodes.BadTimeout);
                                    callback(err);
                                });
                            }
                        ],
                        inner_done
                    );
                },
                done
            );
        });

        describe("#CTT - Monitored Value Change", function () {
            it("should monitor a substring ", function (done) {
                perform_operation_on_client_session(
                    client,
                    endpointUrl,
                    function (session, inner_done) {
                        const nodeId = nodeIdString;
                        const samplingInterval = 0;

                        const parameters = {
                            samplingInterval: samplingInterval,
                            discardOldest: false,
                            queueSize: 2
                        };

                        const itemToMonitor = new ReadValueId({
                            nodeId: nodeId,
                            attributeId: AttributeIds.Value,
                            indexRange: "4:10"
                        });

                        async.series(
                            [
                                function (callback) {
                                    createSubscription(session, callback);
                                },

                                function (callback) {
                                    createMonitoredItems(session, nodeId, parameters, itemToMonitor, callback);
                                },

                                function (callback) {
                                    sendPublishRequest(session, function (err, response) {
                                        const notification = response.notificationMessage.notificationData[0].monitoredItems[0];
                                        //xx console.log("notification", notification.toString());
                                        notification.value.value.value.should.eql("EFGHIJK");
                                        callback(err);
                                    });
                                },

                                function (callback) {
                                    const nodesToWrite = [
                                        {
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
                                        }
                                    ];

                                    session.write(nodesToWrite, function (err, statusCodes) {
                                        statusCodes.length.should.eql(1);
                                        statusCodes[0].should.eql(StatusCodes.Good);
                                        callback(err);
                                    });
                                },

                                function (callback) {
                                    sendPublishRequest(session, function (err, response) {
                                        const notification = response.notificationMessage.notificationData[0].monitoredItems[0];
                                        //xx console.log("notification", notification.toString());
                                        notification.value.value.value.should.eql("VUTSRQP");
                                        callback(err);
                                    });
                                }
                            ],
                            inner_done
                        );
                    },
                    done
                );
            });

            it("ZZE it should return a publish Response with Bad_IndexRangeNoData , when the size of the monitored item change", function (done) {
                // as per CTT test 036.js (MonitoredItem Service/Monitored Value Changed
                // Create a monitored item of an array with an IndexRange of “2:4” (the array must currently have at least five elements).
                // call Publish(). Write to the array such that the size changes to two elements (0:1). call Publish().
                // ExpectedResults:
                // All service and operation level results are Good. Second Publish response contains a DataChangeNotification
                // with a value.statusCode of Bad_IndexRangeNoData.
                perform_operation_on_client_session(
                    client,
                    endpointUrl,
                    function (session, inner_done) {
                        samplingInterval = 0; // exception based

                        const nodeId = "ns=2;s=Static_Array_Int32";

                        const parameters = {
                            samplingInterval: 0, // exception based : whenever value changes
                            discardOldest: false,
                            queueSize: 2
                        };

                        const itemToMonitor = new ReadValueId({
                            nodeId: nodeId,
                            attributeId: AttributeIds.Value,
                            indexRange: "2:4"
                        });

                        function write_node(value, callback) {
                            assert(value instanceof Array);
                            const nodeToWrite = {
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
                            };
                            session.write(nodeToWrite, function (err, statusCode) {
                                statusCode.should.eql(StatusCodes.Good);

                                session.read(
                                    {
                                        attributeId: AttributeIds.Value,
                                        nodeId: nodeId
                                    },
                                    function (err, dataValue) {
                                        should.exist(dataValue);
                                        //xxconsole.log(" written ",dataValue.value.toString());
                                        callback(err);
                                    }
                                );
                            });
                        }

                        async.series(
                            [
                                // write initial value => [1,2,3,4,5,6,7,8,9,10]
                                write_node.bind(null, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),

                                function (callback) {
                                    createSubscription(session, callback);
                                },

                                function (callback) {
                                    createMonitoredItems(session, nodeId, parameters, itemToMonitor, callback);
                                },
                                function (callback) {
                                    setTimeout(callback, 100);
                                },
                                function (callback) {
                                    sendPublishRequest(session, function (err, response) {
                                        const notification = response.notificationMessage.notificationData[0].monitoredItems[0];
                                        notification.value.statusCode.should.eql(StatusCodes.Good);
                                        notification.value.value.value.should.eql(new Int32Array([2, 3, 4]));
                                        callback(err);
                                    });
                                },

                                write_node.bind(null, [-1, -2]),

                                function (callback) {
                                    sendPublishRequest(session, function (err, response) {
                                        const notification = response.notificationMessage.notificationData[0].monitoredItems[0];
                                        notification.value.statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
                                        notification.value.value.value.should.eql(new Int32Array([]));
                                        callback(err);
                                    });
                                },

                                write_node.bind(null, [-1, -2, -3]),
                                function (callback) {
                                    setTimeout(callback, 100);
                                },

                                write_node.bind(null, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),

                                function (callback) {
                                    setTimeout(callback, 100);
                                },

                                function (callback) {
                                    sendPublishRequest(session, function (err, response) {
                                        if (!err) {
                                            response.notificationMessage.notificationData[0].monitoredItems.length.should.be.aboveOrEqual(
                                                2,
                                                "expecting two monitoredItem in  notification data"
                                            );
                                            const notification1 =
                                                response.notificationMessage.notificationData[0].monitoredItems[0];
                                            notification1.value.statusCode.should.eql(StatusCodes.Good);
                                            notification1.value.value.value.should.eql(new Int32Array([-3]));
                                            const notification2 =
                                                response.notificationMessage.notificationData[0].monitoredItems[1];
                                            notification2.value.statusCode.should.eql(StatusCodes.Good);
                                            notification2.value.value.value.should.eql(new Int32Array([2, 3, 4]));
                                        }
                                        callback(err);
                                    });
                                },

                                write_node.bind(null, [0, 1, 2, 3]),

                                function (callback) {
                                    sendPublishRequest(session, function (err, response) {
                                        const notification = response.notificationMessage.notificationData[0].monitoredItems[0];
                                        notification.value.statusCode.should.eql(StatusCodes.Good);
                                        notification.value.value.value.should.eql(new Int32Array([2, 3]));
                                        callback(err);
                                    });
                                },

                                // restore orignal value
                                write_node.bind(null, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
                            ],
                            inner_done
                        );
                    },
                    done
                );
            });
        });

        it("#ModifySubscriptionRequest: should return BadSubscriptionIdInvalid if client specifies a invalid subscriptionId", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    const modifySubscriptionRequest = {
                        subscriptionId: 999
                    };

                    session.modifySubscription(modifySubscriptionRequest, function (err) {
                        err.message.should.match(/BadSubscriptionIdInvalid/);
                        inner_done();
                    });
                },
                done
            );
        });

        it("#ModifySubscriptionRequest: should return StatusGood", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    const subscription = ClientSubscription.create(session, {
                        requestedPublishingInterval: 10,
                        requestedLifetimeCount: 60000,
                        requestedMaxKeepAliveCount: 10,
                        maxNotificationsPerPublish: 10,
                        publishingEnabled: true,
                        priority: 6
                    });

                    subscription.on("terminated", function () {
                        //xx console.log(chalk.yellow(" subscription terminated "));
                    });
                    subscription.on("started", function () {
                        async.series(
                            [
                                function (callback) {
                                    const modifySubscriptionRequest = {
                                        subscriptionId: subscription.subscriptionId,
                                        requestedPublishingInterval: 200
                                    };
                                    session.modifySubscription(modifySubscriptionRequest, function (err, response) {
                                        response.revisedPublishingInterval.should.eql(200);

                                        callback(err);
                                    });
                                },
                                function (callback) {
                                    subscription.terminate(callback);
                                }
                            ],
                            inner_done
                        );
                    });
                },
                done
            );
        });

        it("#SetMonitoringMode, should return BadSubscriptionIdInvalid when subscriptionId is invalid", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    const setMonitoringModeRequest = {
                        subscriptionId: 999
                    };
                    session.setMonitoringMode(setMonitoringModeRequest, function (err) {
                        err.message.should.match(/BadSubscriptionIdInvalid/);
                        inner_done();
                    });
                },
                done
            );
        });

        it("#SetMonitoringMode, should return BadNothingToDo if monitoredItemId is empty", function (done) {
            perform_operation_on_subscription(
                client,
                endpointUrl,
                function (session, subscription, inner_done) {
                    const setMonitoringModeRequest = {
                        subscriptionId: subscription.subscriptionId,
                        monitoredItemIds: []
                    };
                    session.setMonitoringMode(setMonitoringModeRequest, function (err) {
                        err.message.should.match(/BadNothingToDo/);
                        inner_done();
                    });
                },
                done
            );
        });

        it("#SetMonitoringMode, should return BadMonitoredItemIdInvalid is monitoringMode is invalid", function (done) {
            const itemToMonitor = "ns=0;i=2254"; // temperatureVariableId;
            perform_operation_on_monitoredItem(
                client,
                endpointUrl,
                itemToMonitor,
                function (session, subscription, monitoredItem, inner_done) {
                    const setMonitoringModeRequest = new SetMonitoringModeRequest({
                        subscriptionId: subscription.subscriptionId,
                        monitoringMode: MonitoringMode.Reporting,
                        monitoredItemIds: [monitoredItem.monitoredItemId]
                    });

                    setMonitoringModeRequest.monitoringMode = 42;

                    session.setMonitoringMode(setMonitoringModeRequest, function (err) {
                        should.exist(err);
                        err.message.should.match(/BadMonitoringModeInvalid/);
                        inner_done();
                    });
                },
                done
            );
        });

        it("#SetMonitoringMode, should return BadMonitoredItemIdInvalid when monitoredItem is invalid", function (done) {
            const itemToMonitor = "ns=0;i=2254"; // temperatureVariableId;
            perform_operation_on_monitoredItem(
                client,
                endpointUrl,
                itemToMonitor,
                function (session, subscription, monitoredItem, inner_done) {
                    const setMonitoringModeRequest = {
                        subscriptionId: subscription.subscriptionId,
                        monitoringMode: MonitoringMode.Sampling,
                        monitoredItemIds: [monitoredItem.monitoredItemId + 9999]
                    };
                    session.setMonitoringMode(setMonitoringModeRequest, function (err, response) {
                        response.results.length.should.eql(1);
                        response.results[0].should.eql(StatusCodes.BadMonitoredItemIdInvalid);
                        inner_done(err);
                    });
                },
                done
            );
        });

        it("#SetMonitoringMode, should return Good when request is valid", function (done) {
            const itemToMonitor = "ns=0;i=2254"; // temperatureVariableId;
            perform_operation_on_monitoredItem(
                client,
                endpointUrl,
                itemToMonitor,
                function (session, subscription, monitoredItem, inner_done) {
                    const setMonitoringModeRequest = {
                        subscriptionId: subscription.subscriptionId,
                        monitoringMode: MonitoringMode.Sampling,
                        monitoredItemIds: [monitoredItem.monitoredItemId]
                    };
                    session.setMonitoringMode(setMonitoringModeRequest, function (err, response) {
                        response.results.length.should.eql(1);
                        response.results[0].should.eql(StatusCodes.Good);
                        inner_done(err);
                    });
                },
                done
            );
        });

        it("#subscription operations should extend subscription lifetime", function (done) {
            this.timeout(Math.max(200000, this.timeout()));

            // see CTT test063

            let monitoredItem;

            function step1(session, subscription, callback) {
                monitoredItem = ClientMonitoredItem.create(
                    subscription,
                    {
                        nodeId: resolveNodeId("ns=0;i=2254"),
                        attributeId: AttributeIds.Value
                    },
                    {
                        samplingInterval: 100,
                        discardOldest: true,
                        queueSize: 1
                    }
                );

                monitoredItem.on("initialized", function () {
                    callback();
                });
            }

            function step2(session, subscription, callback) {
                const setMonitoringModeRequest = {
                    subscriptionId: subscription.subscriptionId,
                    monitoringMode: MonitoringMode.Sampling,
                    monitoredItemIds: [monitoredItem.monitoredItemId]
                };
                session.setMonitoringMode(setMonitoringModeRequest, function (err, response) {
                    response.results[0].should.eql(StatusCodes.Good);
                    callback(err);
                });
            }

            function step3(session, subcription, callback) {
                session.deleteSubscriptions(
                    {
                        subscriptionIds: [subcription.subscriptionId]
                    },
                    function (err, response) {
                        should.exist(response);
                        callback(err);
                    }
                );
            }

            const publishingInterval = 100;

            function my_perform_operation_on_subscription(client, endpointUrl, do_func, done_func) {
                perform_operation_on_client_session(
                    client,
                    endpointUrl,
                    function (session, done) {
                        let subscription;
                        async.series(
                            [
                                function (callback) {
                                    subscription = ClientSubscription.create(session, {
                                        requestedPublishingInterval: publishingInterval,
                                        requestedLifetimeCount: 60,
                                        requestedMaxKeepAliveCount: 10, // 10 requested here !
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
                                    subscription.terminate(callback);
                                }
                            ],
                            function (err) {
                                done(err);
                            }
                        );
                    },
                    done_func
                );
            }

            my_perform_operation_on_subscription(
                client,
                endpointUrl,
                function (session, subscription, inner_done) {
                    subscription.publishingInterval.should.eql(publishingInterval);
                    subscription.maxKeepAliveCount.should.eql(10);

                    const waitingTime = subscription.publishingInterval * (subscription.maxKeepAliveCount - 3) - 100;

                    let nb_keep_alive_received = 0;
                    subscription.on("keepalive", function () {
                        nb_keep_alive_received += 1;
                    });

                    async.series(
                        [
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
                            }
                        ],
                        inner_done
                    );
                },
                done
            );
        });

        describe("#Republish", function () {
            let VALID_SUBSCRIPTION;
            let VALID_RETRANSMIT_SEQNUM = 0;
            const INVALID_SUBSCRIPTION = 1234;
            const INVALID_RETRANSMIT_SEQNUM = 1234;

            let g_session;
            let client, fanSpeed;
            before(function (done) {
                VALID_RETRANSMIT_SEQNUM = 0;

                client = OPCUAClient.create();
                fanSpeed = server.engine.addressSpace.findNode("ns=1;s=FanSpeed");
                should.exist(fanSpeed);
                //xxx console.log(fanSpeed.toString());
                done();
            });

            function inner_test(the_test_function, done) {
                perform_operation_on_client_session(
                    client,
                    endpointUrl,
                    function (session, inner_done) {
                        g_session = session;
                        async.series(
                            [
                                function (callback) {
                                    // CreateSubscriptionRequest
                                    const request = new CreateSubscriptionRequest({
                                        requestedPublishingInterval: 100,
                                        requestedLifetimeCount: 60,
                                        requestedMaxKeepAliveCount: 10,
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
                                    const request = new CreateMonitoredItemsRequest({
                                        subscriptionId: VALID_SUBSCRIPTION,
                                        timestampsToReturn: TimestampsToReturn.Both,
                                        itemsToCreate: [
                                            {
                                                itemToMonitor: {
                                                    nodeId: fanSpeed.nodeId
                                                    // nodeId: makeNodeId(VariableIds.Server_ServerStatus_CurrentTime)
                                                },
                                                monitoringMode: MonitoringMode.Reporting,
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
                                        response.should.be.instanceof(CreateMonitoredItemsResponse);
                                        response.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                                        response.results.length.should.eql(1);
                                        response.results[0].statusCode.should.eql(StatusCodes.Good);

                                        callback(err);
                                    });
                                },

                                function (callback) {
                                    fanSpeed.setValueFromSource(new Variant({ dataType: DataType.Double, value: 1 }));
                                    setTimeout(callback, 50);
                                    fanSpeed.setValueFromSource(new Variant({ dataType: DataType.Double, value: 2 }));
                                    //console.log(fanSpeed.toString());
                                },

                                //publish_republish,

                                function (callback) {
                                    // publish request now requires a subscriptions
                                    const request = new PublishRequest({
                                        subscriptionAcknowledgements: []
                                    });
                                    g_session.publish(request, function (err, response) {
                                        assert(response instanceof PublishResponse);
                                        assert(response.availableSequenceNumbers.length > 0);
                                        VALID_RETRANSMIT_SEQNUM = response.availableSequenceNumbers[0];
                                        VALID_RETRANSMIT_SEQNUM.should.not.eql(0);

                                        callback(err);
                                    });
                                },

                                the_test_function
                            ],
                            inner_done
                        );
                    },
                    done
                );
            }

            it("server should handle Republish request (BadMessageNotAvailable) ", function (done) {
                inner_test(function (done) {
                    const request = new RepublishRequest({
                        subscriptionId: VALID_SUBSCRIPTION,
                        retransmitSequenceNumber: INVALID_RETRANSMIT_SEQNUM
                    });
                    g_session.republish(request, function (err, response) {
                        should.exist(err);
                        response.should.be.instanceof(RepublishResponse);
                        response.responseHeader.serviceResult.should.eql(StatusCodes.BadMessageNotAvailable);
                        done();
                    });
                }, done);
            });

            it("server should handle Republish request (BadSubscriptionIdInvalid) ", function (done) {
                inner_test(function (done) {
                    VALID_RETRANSMIT_SEQNUM.should.not.eql(0);

                    const request = new RepublishRequest({
                        subscriptionId: INVALID_SUBSCRIPTION,
                        retransmitSequenceNumber: VALID_RETRANSMIT_SEQNUM
                    });
                    g_session.republish(request, function (err, response) {
                        should.exist(err);
                        response.should.be.instanceof(RepublishResponse);
                        response.responseHeader.serviceResult.should.eql(StatusCodes.BadSubscriptionIdInvalid);
                        done();
                    });
                }, done);
            });

            it("server should handle Republish request (Good) ", function (done) {
                inner_test(function (done) {
                    VALID_RETRANSMIT_SEQNUM.should.not.eql(0);

                    const request = new RepublishRequest({
                        subscriptionId: VALID_SUBSCRIPTION,
                        retransmitSequenceNumber: VALID_RETRANSMIT_SEQNUM
                    });

                    g_session.republish(request, function (err, response) {
                        response.should.be.instanceof(RepublishResponse);
                        response.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                        done(err);
                    });
                }, done);
            });
        });
    });
};
