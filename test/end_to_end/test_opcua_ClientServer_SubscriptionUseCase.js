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

var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var perform_operation_on_subscription = require("test/helpers/perform_operation_on_client_session").perform_operation_on_subscription;

var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;

var _port = 2000;
describe("testing Client-Server subscription use case, on a fake server exposing the temperature device", function() {

    var server, client, temperatureVariableId, endpointUrl;


    var port = _port + 1;
    before(function(done) {

        resourceLeakDetector.start();
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error
        port += 1;
        server = build_server_with_temperature_device({
            port: port
        }, function(err) {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done(err);
        });
    });

    beforeEach(function(done) {
        client = new OPCUAClient();
        done();
    });

    afterEach(function(done) {
        client = null;
        done();
    });

    after(function(done) {
        server.shutdown(function(err) {
            resourceLeakDetector.stop();
            done(err);
        });
    });

    it("should create a ClientSubscription to manage a subscription", function(done) {

        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

            assert(session instanceof ClientSession);

            var subscription = new ClientSubscription(session, {
                requestedPublishingInterval: 100,
                requestedLifetimeCount: 100 * 60 * 10,
                requestedMaxKeepAliveCount: 5,
                maxNotificationsPerPublish: 5,
                publishingEnabled: true,
                priority: 6
            });
            subscription.on("started", function() {
                setTimeout(function() {
                    subscription.terminate();
                }, 200);
            });
            subscription.on("terminated", function() {
                setTimeout(function() {
                    inner_done();
                }, 200);
            });
        }, done);
    });

    it("should dump statistics ", function(done) {

        perform_operation_on_client_session(client, endpointUrl, function(session, done) {

            assert(session instanceof ClientSession);

            var subscription = new ClientSubscription(session, {
                requestedPublishingInterval: 100,
                requestedLifetimeCount: 100 * 60 * 10,
                requestedMaxKeepAliveCount: 5,
                maxNotificationsPerPublish: 5,
                publishingEnabled: true,
                priority: 6
            });
            subscription.on("started", function() {
                setTimeout(function() {
                    subscription.terminate();
                }, 200);
            });
            subscription.on("terminated", function() {
                done();
            });
        }, done);
    });

    it("a ClientSubscription should receive keep-alive events from the server", function(done) {

        perform_operation_on_client_session(client, endpointUrl, function(session, done) {

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
            subscription.on("started", function() {
                setTimeout(function() {
                    subscription.terminate();
                }, 1000);
            });
            subscription.on("keepalive", function() {
                nb_keep_alive_received += 1;
            });
            subscription.on("terminated", function() {
                console.log(" subscription has received ", nb_keep_alive_received, " keep-alive event(s)");
                nb_keep_alive_received.should.be.greaterThan(0);
                done();
            });
        }, done);
    });

    xit("a ClientSubscription should survive longer than the life time", function(done) {
        // todo
        done();
    });

    it("should be possible to monitor an nodeId value with a ClientSubscription", function(done) {

        perform_operation_on_client_session(client, endpointUrl, function(session, done) {

            assert(session instanceof ClientSession);

            var subscription = new ClientSubscription(session, {
                requestedPublishingInterval: 150,
                requestedLifetimeCount: 10 * 60 * 10,
                requestedMaxKeepAliveCount: 10,
                maxNotificationsPerPublish: 2,
                publishingEnabled: true,
                priority: 6
            });


            subscription.on("started", function() {

            });
            subscription.on("terminated", function() {
                done();
            });

            var monitoredItem = subscription.monitor({
                nodeId: resolveNodeId("ns=0;i=2258"),
                attributeId: AttributeIds.Value
            }, {
                samplingInterval: 10,
                discardOldest: true,
                queueSize: 1
            });

            // subscription.on("item_added",function(monitoredItem){
            monitoredItem.on("initialized", function() {
                monitoredItem.terminate(function() {
                    subscription.terminate();
                });
            });

        }, done);
    });

    it("should be possible to monitor several nodeId value with a single client subscription", function(done) {

        perform_operation_on_client_session(client, endpointUrl, function(session, done) {

            assert(session instanceof ClientSession);

            var subscription = new ClientSubscription(session, {
                requestedPublishingInterval: 10,
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
                samplingInterval: 10,
                discardOldest: true,
                queueSize: 1
            });

            // subscription.on("item_added",function(monitoredItem){
            monitoredItemCurrentTime.on("changed", function(dataValue) {
                //xx console.log("xxxx current time", dataValue.value.value);
                currentTime_changes++;
            });

            var pumpSpeedId = "ns=4;b=0102030405060708090a0b0c0d0e0f10";
            var monitoredItemPumpSpeed = subscription.monitor({
                nodeId: resolveNodeId(pumpSpeedId),
                attributeId: AttributeIds.Value
            }, {
                samplingInterval: 10,
                discardOldest: true,
                queueSize: 1
            });

            var pumpSpeed_changes = 0;
            monitoredItemPumpSpeed.on("changed", function(dataValue) {
                //xx console.log(" pump speed ", dataValue.value.value);
                pumpSpeed_changes++;

            });

            setTimeout(function() {

                pumpSpeed_changes.should.be.greaterThan(1);
                currentTime_changes.should.be.greaterThan(1);
                done();
            }, 1000);

        }, done);
    });

    it("should terminate any pending subscription when the client is disconnected", function(done) {


        var the_session;

        async.series([

            // connect
            function(callback) {
                client.connect(endpointUrl, callback);
            },

            // create session
            function(callback) {
                client.createSession(function(err, session) {
                    assert(session instanceof ClientSession);
                    if (!err) {
                        the_session = session;
                    }
                    callback(err);
                });
            },

            // create subscription
            function(callback) {

                var subscription = new ClientSubscription(the_session, {
                    requestedPublishingInterval: 100,
                    requestedLifetimeCount: 100 * 60 * 10,
                    requestedMaxKeepAliveCount: 5,
                    maxNotificationsPerPublish: 5,
                    publishingEnabled: true,
                    priority: 6
                });
                subscription.on("started", function() {

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
            function(callback) {
                setTimeout(function() {
                    // client.disconnect(done);
                    callback();
                }, 100);
            },

            // now disconnect the client , without closing the subscription first
            function(callback) {
                client.disconnect(callback);
            }

        ], function(err) {
            done(err);
        });

    });

});

describe("testing server and subscription", function() {

    var server, client, temperatureVariableId, endpointUrl;
    var port = _port + 1;
    before(function(done) {
        console.log(" Creating Server");
        server = build_server_with_temperature_device({
            port: port
        }, function(err) {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done(err);
        });
    });

    beforeEach(function(done) {
        //xx console.log(" creating new client");
        client = new OPCUAClient();
        done();
    });

    afterEach(function(done) {
        //xx console.log(" shutting down client");
        client.disconnect(function(err) {
            client = null;
            done(err);
        });
    });

    after(function(done) {
        //xx console.log(" shutting down Server");
        server.shutdown(done);
    });

    it(" a server should accept several Publish Requests from the client without sending notification immediately," +
        " and should still be able to reply to other requests",
        function(done) {

            var subscriptionId;
            perform_operation_on_client_session(client, endpointUrl, function(session, done) {

                async.series([

                    function(callback) {
                        session.createSubscription({
                            requestedPublishingInterval: 100, // Duration
                            requestedLifetimeCount: 10, // Counter
                            requestedMaxKeepAliveCount: 10, // Counter
                            maxNotificationsPerPublish: 10, // Counter
                            publishingEnabled: true, // Boolean
                            priority: 14 // Byte
                        }, function(err, response) {
                            subscriptionId = response.subscriptionId;
                            callback(err);
                        });
                    },
                    function(callback) {
                        session.readVariableValue("RootFolder", function(err, dataValues, diagnosticInfos) {
                            callback(err);
                        });
                    },
                    function(callback) {

                        // send many publish requests, in one go
                        session.publish({}, function(err, response) {});
                        session.publish({}, function(err, response) {});
                        session.publish({}, function(err, response) {});
                        session.publish({}, function(err, response) {});
                        session.publish({}, function(err, response) {});
                        session.publish({}, function(err, response) {});
                        callback();
                    },
                    function(callback) {
                        session.readVariableValue("RootFolder", function(err, dataValues, diagnosticInfos) {
                            callback();
                        });
                    },
                    function(callback) {
                        session.deleteSubscriptions({
                            subscriptionIds: [subscriptionId]
                        }, function(err, response) {
                            callback();
                        });
                    }
                ], function(err) {
                    done(err);
                });

            }, done);
        });

    it("A Subscription can be added and then deleted", function(done) {
        var subscriptionId;
        perform_operation_on_client_session(client, endpointUrl, function(session, done) {

            async.series([

                function(callback) {
                    session.createSubscription({
                        requestedPublishingInterval: 100, // Duration
                        requestedLifetimeCount: 10, // Counter
                        requestedMaxKeepAliveCount: 10, // Counter
                        maxNotificationsPerPublish: 10, // Counter
                        publishingEnabled: true, // Boolean
                        priority: 14 // Byte
                    }, function(err, response) {
                        subscriptionId = response.subscriptionId;
                        callback(err);
                    });
                },


                function(callback) {
                    session.deleteSubscriptions({
                        subscriptionIds: [subscriptionId]
                    }, function(err, response) {
                        callback();
                    });
                }
            ], function(err) {
                done(err);
            });

        }, done);

    });

    it("A MonitoredItem can be added to a subscription and then deleted", function(done) {

        perform_operation_on_subscription(client, endpointUrl, function(session, subscription, callback) {

            var monitoredItem = subscription.monitor({
                nodeId: resolveNodeId("ns=0;i=2258"),
                attributeId: AttributeIds.Value
            }, {
                samplingInterval: 10,
                discardOldest: true,
                queueSize: 1
            });

            // subscription.on("item_added",function(monitoredItem){
            monitoredItem.on("initialized", function() {
                monitoredItem.terminate(function() {
                    callback();
                });
            });
        }, done);

    });

    it("should return BadAttributeIdInvalid if the client tries to monitored an invalid attribute", function(done) {

        this.timeout(5000);
        perform_operation_on_subscription(client, endpointUrl, function(session, subscription, callback) {

            var monitoredItem = subscription.monitor({
                nodeId: resolveNodeId("ns=0;i=2258"),
                attributeId: AttributeIds.INVALID
            }, {
                samplingInterval: 10,
                discardOldest: true,
                queueSize: 1
            });

            monitoredItem.on("err", function(statusCode) {

                statusCode.should.eql(StatusCodes.BadAttributeIdInvalid);
                callback();
            });


            // subscription.on("item_added",function(monitoredItem){
            monitoredItem.on("initialized", function() {
                monitoredItem.terminate(function() {
                    callback(new Error("Should not have been initialized"));
                });
            });
        }, done);
    });

    it("should return BadIndexRangeInvalid if the client tries to monitored with an invalid index range", function(done) {

        this.timeout(5000);
        perform_operation_on_subscription(client, endpointUrl, function(session, subscription, callback) {

            var monitoredItem = subscription.monitor({
                nodeId: resolveNodeId("ns=0;i=2258"),
                attributeId: AttributeIds.Value,
                indexRange: "5:3" // << INTENTIONAL : Invalid Range
            }, {
                samplingInterval: 10,
                discardOldest: true,
                queueSize: 1
            });

            monitoredItem.on("err", function(statusCode) {
                statusCode.should.eql(StatusCodes.BadIndexRangeInvalid);
                callback();
            });

            // subscription.on("item_added",function(monitoredItem){
            monitoredItem.on("initialized", function() {
                monitoredItem.terminate(function() {
                    callback(new Error("monitoredItem.on('initialized') should not be called"));
                });
            });
        }, done);
    });

    it("should return BadNothingToDo if CreateMonitoredItemRequest has no nodes to monitored", function(done) {

        perform_operation_on_subscription(client, endpointUrl, function(session, subscription, callback) {

            var createMonitoredItemsRequest = new opcua.subscription_service.CreateMonitoredItemsRequest({
                subscriptionId: subscription.subscriptionId,
                timestampsToReturn: opcua.read_service.TimestampsToReturn.Neither,
                itemsToCreate: []
            });
            session.createMonitoredItems(createMonitoredItemsRequest, function(err, createMonitoredItemsResponse) {
                createMonitoredItemsResponse.responseHeader.serviceResult.should.eql(StatusCodes.BadNothingToDo);
                callback();
            });

        }, done);
    });

    it("should return BadNothingToDo if ModifyMonitoredItemRequest has no nodes to monitored", function(done) {

        perform_operation_on_subscription(client, endpointUrl, function(session, subscription, callback) {

            var modifyMonitoredItemsRequest = new opcua.subscription_service.ModifyMonitoredItemsRequest({
                subscriptionId: subscription.subscriptionId,
                timestampsToReturn: opcua.read_service.TimestampsToReturn.Neither,
                itemsToModify: []
            });
            session.modifyMonitoredItems(modifyMonitoredItemsRequest, function(err, modifyMonitoredItemsResponse) {
                modifyMonitoredItemsResponse.responseHeader.serviceResult.should.eql(StatusCodes.BadNothingToDo);
                callback();
            });

        }, done);
    });
    it("should return BadNothingToDo if DeleteMonitoredItemsResponse has no nodes to delete", function(done) {

        perform_operation_on_subscription(client, endpointUrl, function(session, subscription, callback) {

            var deleteMonitoredItemsRequest = new opcua.subscription_service.DeleteMonitoredItemsRequest({
                subscriptionId: subscription.subscriptionId,
                monitoredItemIds: []
            });
            session.deleteMonitoredItems(deleteMonitoredItemsRequest, function(err, deleteMonitoredItemsResponse) {
                deleteMonitoredItemsResponse.responseHeader.serviceResult.should.eql(StatusCodes.BadNothingToDo);
                callback();
            });

        }, done);
    });




    it("A MonitoredItem should received changed event", function(done) {

        perform_operation_on_subscription(client, endpointUrl, function(session, subscription, inner_callback) {

            var monitoredItem = subscription.monitor({
                nodeId: resolveNodeId("ns=0;i=2258"),
                attributeId: AttributeIds.Value
            }, {
                samplingInterval: 100,
                discardOldest: true,
                queueSize: 1
            });

            monitoredItem.on("initialized", function() {
                //xx console.log("Initialized");
            });

            monitoredItem.on("changed", function(dataValue) {

                // the changed event has been received !
                // lets stop monitoring this item
                setImmediate(function() {
                    monitoredItem.terminate();
                });
            });
            monitoredItem.on("terminated", function(err) {
                inner_callback();
            });

        }, done);

    });

    it("A Server should reject a CreateMonitoredItemRequest if timestamp is invalid ( catching error on monitored item )", function(done) {


        var TimestampsToReturn = require("lib/services/read_service").TimestampsToReturn;

        perform_operation_on_subscription(client, endpointUrl, function(session, subscription, callback) {

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
            monitoredItem.on("initialized", function() {});

            monitoredItem.on("changed", function(value) {

            });
            monitoredItem.on("err", function(value) {
                err_counter++;
            });
            monitoredItem.on("terminated", function() {
                err_counter.should.eql(1);
                callback();
            });

        }, done);
    });

    it("A Server should reject a CreateMonitoredItemRequest if timestamp is invalid ( catching error on callback)", function(done) {

        var TimestampsToReturn = require("lib/services/read_service").TimestampsToReturn;

        perform_operation_on_subscription(client, endpointUrl, function(session, subscription, callback) {

            var monitoredItem = subscription.monitor({
                    nodeId: resolveNodeId("ns=0;i=2258"),
                    attributeId: 13
                }, {
                    samplingInterval: 100,
                    discardOldest: true,
                    queueSize: 1
                },


                TimestampsToReturn.Invalid, // <= A invalid  TimestampsToReturn

                function(err) {

                    should(err).be.instanceOf(Error);
                    callback(!err);
                }
            );


        }, done);
    });

    it("A Server should be able to revise publish interval to avoid trashing if client specify a very small or zero requestedPublishingInterval", function(done) {

        // from spec OPCUA Version 1.02  Part 4 $5.13.2.2 : requestedPublishingInterval:
        // The negotiated value for this parameter returned in the response is used as the
        // default sampling interval for MonitoredItems assigned to this Subscription.
        // If the requested value is 0 or negative, the server shall revise with the fastest
        // supported publishing interval.
        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

            session.createSubscription({
                requestedPublishingInterval: -1
            }, function(err, createSubscriptionResponse) {

                createSubscriptionResponse.revisedPublishingInterval.should.be.greaterThan(10);

                inner_done(err);
            });
        }, done);


    });

});

describe("testing Client-Server subscription use case 2/2, on a fake server exposing the temperature device", function() {

    var server, client, temperatureVariableId, endpointUrl;

    var nodeIdVariant = "ns=1234;s=SomeDouble";

    var port = _port + 1;
    before(function(done) {
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error
        port += 1;
        server = build_server_with_temperature_device({
            port: port
        }, function(err) {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;


            server.engine.addVariableInFolder("RootFolder", {
                browseName: "SomeDouble",
                nodeId: nodeIdVariant,
                dataType: "Double",
                value: {
                    dataType: DataType.Double,
                    value: 0.0
                }
            });


            done(err);
        });
    });

    beforeEach(function(done) {
        client = new OPCUAClient();
        done();
    });

    afterEach(function(done) {
        client = null;
        done();
    });

    after(function(done) {
        server.shutdown(done);
    });

    this.timeout(10000);

    it("A server should send a StatusChangeNotification if the client doesn't send PublishRequest within the expected interval", function(done) {

        //xx endpointUrl = "opc.tcp://localhost:2200/OPCUA/SimulationServer";

        var nb_keep_alive_received = 0;
        // from Spec OPCUA Version 1.02 Part 4 - 5.13.1.1 Description : Page 76
        // h. Subscriptions have a lifetime counter that counts the number of consecutive publishing cycles in
        //    which there have been no Publish requests available to send a Publish response for the
        //    Subscription. Any Service call that uses the SubscriptionId or the processing of a Publish
        //    response resets the lifetime counter of this Subscription. When this counter reaches the value
        //    calculated for the lifetime of a Subscription based on the MaxKeepAliveCount parameter in the
        //    CreateSubscription Service (5.13.2), the Subscription is closed. Closing the Subscription causes
        //    its MonitoredItems to be deleted. In addition the Server shall issue a StatusChangeNotification
        //    notificationMessage with the status code Bad_Timeout. The StatusChangeNotification
        //    notificationMessage type is defined in 7.19.4.
        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {


            var subscription = new ClientSubscription(session, {

                requestedPublishingInterval: 10,
                requestedLifetimeCount: 6,
                requestedMaxKeepAliveCount: 2,
                maxNotificationsPerPublish: 10,
                publishingEnabled: true,
                priority: 6
            });


            sinon.stub(subscription.publish_engine, "_send_publish_request", function() {});

            setTimeout(function() {
                subscription.publish_engine._send_publish_request.restore();
                subscription.publish_engine._send_publish_request();
                console.log(" --------------------------- ");
            }, 1000);

            subscription.on("keepalive", function() {
                nb_keep_alive_received += 1;
                console.log("timeout");
            });
            subscription.on("started", function() {

                console.log("subscriptionId     :", subscription.subscriptionId);
                console.log("publishingInterval :", subscription.publishingInterval);
                console.log("lifetimeCount      :", subscription.lifetimeCount);
                console.log("maxKeepAliveCount  :", subscription.maxKeepAliveCount);

            }).on("status_changed", function(statusCode) {

                statusCode.should.eql(StatusCodes.BadTimeout);
                setTimeout(function() {
                    subscription.terminate();
                }, 200);
            }).on("terminated", function() {

                nb_keep_alive_received.should.be.equal(0);
                inner_done();
            });

        }, done);


    });

    it("A subscription without a monitored item should not dropped too early ( see #59)", function(done) {

        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

            var subscription = new ClientSubscription(session, {
                requestedPublishingInterval: 10,
                requestedLifetimeCount: 6,
                requestedMaxKeepAliveCount: 2,
                maxNotificationsPerPublish: 10,
                publishingEnabled: true,
                priority: 6
            });

            function termination_is_a_failure() {
                //xx console.log(" subscription terminated ".yellow);
                inner_done(new Error("subscription has been terminated !!!!"));
            }

            subscription.on("terminated", termination_is_a_failure);

            setTimeout(function() {
                subscription.removeListener("terminated", termination_is_a_failure);
                inner_done();
            }, 1000);

        }, done);
    });

    it("#rejectedSessionCount", function() {
        server.rejectedSessionCount.should.eql(server.engine.rejectedSessionCount);
    });

    it("#rejectedRequestsCount", function() {
        server.rejectedRequestsCount.should.eql(server.engine.rejectedRequestsCount);
    });

    it("#sessionAbortCount", function() {
        server.sessionAbortCount.should.eql(server.engine.sessionAbortCount);
    });

    it("#publishingIntervalCount", function() {
        server.publishingIntervalCount.should.eql(server.engine.publishingIntervalCount);
    });

    it("#buildInfo", function() {
        server.buildInfo.should.eql(server.engine.buildInfo);
    });

    it("#bytesRead #transactionsCount #bytesWritten", function(done) {
        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {
            server.bytesRead.should.be.greaterThan(10);
            server.transactionsCount.should.be.greaterThan(3);
            server.bytesWritten.should.be.greaterThan(10);
            inner_done();
        }, done);
    });

    it("#CreateMonitoredItemsRequest : A server should return statusCode === BadSubscriptionIdInvalid when appropriate  ", function(done) {
        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {
            var options = {
                subscriptionId: 999, // << invalide subscription id
            };
            session.createMonitoredItems(options, function(err, results) {
                err.message.should.match(/BadSubscriptionIdInvalid/);
                inner_done();
            });
        }, done);
    });

    it("#SetPublishingModeRequest: A server should set status codes to BadSubscriptionIdInvalid when appropriate  ", function(done) {

        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

            var publishingEnabled = true;
            var subscriptionIds = [999]; //<< invalid subscription ID
            session.setPublishingMode(publishingEnabled, subscriptionIds, function(err, results) {
                results.should.be.instanceOf(Array);
                results[0].should.eql(StatusCodes.BadSubscriptionIdInvalid);
                inner_done();
            });
        }, done);
    });

    it("A server should suspend/resume publishing when client send a setPublishingMode Request ", function(done) {

        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

            var subscription = new ClientSubscription(session, {
                requestedPublishingInterval: 10,
                requestedLifetimeCount: 6,
                requestedMaxKeepAliveCount: 2,
                maxNotificationsPerPublish: 10,
                publishingEnabled: true,
                priority: 6
            });


            subscription.on("terminated", function() {
                console.log(" subscription terminated ".yellow);
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
            monitoredItem.on("changed", function(dataValue) {
                change_count += 1;
                //xx console.log(" dataValue = ".cyan,dataValue.value.toString());
            });

            async.series([
                function(callback) {
                    // wait 400 milliseconds and verify that the subscription is sending some notification
                    setTimeout(function() {
                        change_count.should.be.greaterThan(2);
                        callback();
                    }, 400);

                },
                function(callback) {
                    // suspend subscription
                    subscription.setPublishingMode(false, function(err) {
                        change_count = 0;
                        callback(err);
                    });

                },
                function(callback) {
                    // wait  400 milliseconds and verify that the subscription is  NOT sending any notification
                    setTimeout(function() {
                        change_count.should.equal(0);
                        callback();
                    }, 400);

                },

                function(callback) {
                    // resume subscription
                    subscription.setPublishingMode(true, function(err) {
                        change_count = 0;
                        callback(err);
                    });
                },

                function(callback) {
                    // wait 600 milliseconds and verify that the subscription is sending some notification again
                    setTimeout(function() {
                        change_count.should.be.greaterThan(2);
                        callback();
                    }, 600);
                },

                function(callback) {
                    subscription.terminate();
                    subscription.on("terminated", function() {
                        callback();
                    });
                }
            ], inner_done);


        }, done);
    });

    it("A client should be able to create a subscription that have  publishingEnable=false", function(done) {
        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

            var subscription = new ClientSubscription(session, {
                requestedPublishingInterval: 10,
                requestedLifetimeCount: 6,
                requestedMaxKeepAliveCount: 2,
                maxNotificationsPerPublish: 10,
                publishingEnabled: false,
                priority: 6
            });


            subscription.on("terminated", function() {
                console.log(" subscription terminated ".yellow);
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
            monitoredItem.on("changed", function(dataValue) {
                change_count += 1;
                //xx console.log(" dataValue = ",dataValue.toString());
            });
            async.series([
                function(callback) {
                    // wait 400 ms and verify that the subscription is not sending notification.
                    setTimeout(function() {
                        change_count.should.equal(0);
                        callback();
                    }, 400);

                }
            ], inner_done);

        }, done);
    });

    it("#ModifyMonitoredItemRequest : server should send BadSubscriptionIdInvalid if client send a wrong subscription id", function(done) {

        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

            var modifyMonitoredItemsRequest = {
                subscriptionId: 999,
                timestampsToReturn: opcua.read_service.TimestampsToReturn.Neither
            };

            session.modifyMonitoredItems(modifyMonitoredItemsRequest, function(err) {
                err.message.should.match(/BadSubscriptionIdInvalid/);
                inner_done();
            });
        }, done);
    });

    it("#ModifyMonitoredItemRequest : server should send BadSubscriptionIdInvalid if client send a wrong subscription id", function(done) {

        var TimestampsToReturn = opcua.read_service.TimestampsToReturn;

        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

            var subscription = new ClientSubscription(session, {
                requestedPublishingInterval: 10,
                requestedLifetimeCount: 600,
                requestedMaxKeepAliveCount: 20,
                maxNotificationsPerPublish: 10,
                publishingEnabled: true,
                priority: 6
            });
            console.log("subscription = ", subscription.subscriptionId);
            subscription.on("started", function() {
                var modifyMonitoredItemsRequest = {
                    subscriptionId: subscription.subscriptionId,
                    timestampsToReturn: TimestampsToReturn.Invalid
                };

                session.modifyMonitoredItems(modifyMonitoredItemsRequest, function(err, modifyMonitoredItemsResponse) {
                    err.message.should.match(/BadTimestampsToReturnInvalid/);
                    inner_done();
                });
            });
        }, done);
    });

    it("#ModifyMonitoredItemRequest : server should send BadMonitoredItemIdInvalid  if client send a wrong monitored item id", function(done) {

        var TimestampsToReturn = opcua.read_service.TimestampsToReturn;
        var MonitoredItemModifyRequest = opcua.subscription_service.MonitoredItemModifyRequest;

        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

            var subscription = new ClientSubscription(session, {
                requestedPublishingInterval: 10,
                requestedLifetimeCount: 600,
                requestedMaxKeepAliveCount: 20,
                maxNotificationsPerPublish: 10,
                publishingEnabled: true,
                priority: 6
            });
            console.log("subscription = ", subscription.subscriptionId);
            subscription.on("started", function() {
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

                session.modifyMonitoredItems(modifyMonitoredItemsRequest, function(err, modifyMonitoredItemsResponse) {
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

    it("#ModifyMonitoredItemsRequest : a client should be able to modify a monitored item", function(done) {

        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

            var subscription = new ClientSubscription(session, {
                requestedPublishingInterval: 10,
                requestedLifetimeCount: 600,
                requestedMaxKeepAliveCount: 20,
                maxNotificationsPerPublish: 10,
                publishingEnabled: true,
                priority: 6
            });

            //xx console.log("xxx subscription = ",subscription.publishingInterval);

            subscription.on("terminated", function() {
                console.log(" subscription terminated ".yellow);
            });
            var monitoredItem = subscription.monitor({
                nodeId: resolveNodeId("ns=0;i=2258"),
                attributeId: AttributeIds.Value
            }, {
                samplingInterval: 1000,
                discardOldest: true,
                queueSize: 1
            });


            var change_count = 0;
            monitoredItem.on("changed", function(dataValue) {
                //xx console.log("xx changed",dataValue.value.toString());
                change_count += 1;
            });

            async.series([

                function(callback) {
                    // wait 400 ms and verify that the subscription is not sending notification.
                    setTimeout(function() {
                        change_count.should.equal(0);
                        callback();
                    }, 400);
                },
                function(callback) {
                    monitoredItem.modify({
                        samplingInterval: 20,
                        discardOldest: false,
                        queueSize: 1
                    }, function(err, result) {
                        callback(err);
                        if (!err) {
                            result.revisedSamplingInterval.should.be.greaterThan(19)
                        }
                    });
                },
                function(callback) {
                    // wait 400 ms and verify that the subscription is not sending notification.
                    setTimeout(function() {
                        change_count.should.be.greaterThan(1);
                        callback();
                    }, 3000); // wait at least 3 second as date resolution is 1 sec.
                }
            ], inner_done);

        }, done); //
    });


    /**
     * see CTT createMonitoredItems591064
     * Description:
     * Create a monitored item with the nodeId set to that of a non-Variable node and
     * the attributeId set to a non-Value attribute. call Publish().
     * Expected Results: All service and operation level results are Good. Publish response contains a DataChangeNotification.
     */
    it("a monitored item with the nodeId set to that of a non-Variable node an  and the attributeId set to a non-Value attribute should send a DataChangeNotification", function(done) {

        // Attributes, other than the  Value  Attribute, are only monitored for a change in value.
        // The filter is not used for these  Attributes. Any change in value for these  Attributes
        // causes a  Notification  to be  generated.

        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

            var subscription = new ClientSubscription(session, {
                requestedPublishingInterval: 10,
                requestedLifetimeCount: 600,
                requestedMaxKeepAliveCount: 20,
                maxNotificationsPerPublish: 10,
                publishingEnabled: true,
                priority: 6
            });

            subscription.on("terminated", function() {
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

            monitoredItem.on("err", function(err) {
                should(err).eql(null);
            });
            var change_count = 0;
            monitoredItem.on("changed", function(dataValue) {
                console.log("dataValue = ", dataValue.toString());
                change_count += 1;
            });

            setTimeout(function() {
                change_count.should.equal(1);
                subscription.terminate();
            }, 300);

        }, done);


    });

    xit("When a user adds a monitored item that the user is denied read access to, the add operation for the" +
        " item shall succeed and the bad status  Bad_NotReadable  or  Bad_UserAccessDenied  shall be" +
        " returned in the Publish response",
        function(done) {
            done();
        });
    /**
     * see CTT createMonitoredItems591014 ( -009.js)
     */


    xit("XX should make sure that only the latest value is returned when queue size is one", function(done) {

        var nodeId = nodeIdVariant;

        var MonitoringMode = opcua.subscription_service.MonitoringMode;

        function writeValue(session, value, callback) {
            var nodesToWrite = [{
                nodeId: nodeId,
                attributeId: AttributeIds.Value,
                value: /*new DataValue(*/ {
                    value: { /* Variant */
                        dataType: DataType.Double,
                        value: value
                    }
                }
            }];

            setTimeout(function() {
                session.write(nodesToWrite, function(err, statusCodes) {
                    statusCodes.length.should.eql(1);
                    statusCodes[0].should.eql(StatusCodes.Good);
                    callback(err);
                });
            }, 100);
        }


        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

            var publishingInterval = 300;
            var samplingInterval = 50;

            var createSubscriptionRequest = {
                requestedPublishingInterval: publishingInterval,
                requestedLifetimeCount: 600,
                requestedMaxKeepAliveCount: 20,
                maxNotificationsPerPublish: 10,
                publishingEnabled: true,
                priority: 6
            };


            var TimestampsToReturn = opcua.read_service.TimestampsToReturn;
            // var subscription = new ClientSubscription(session,createSubscriptionRequest);
            // subscription.on("terminated", function () { console.log(" subscription terminated ".yellow); });

            var itemToMonitor = new opcua.read_service.ReadValueId({
                nodeId: nodeId,
                attributeId: AttributeIds.Value
            });

            var parameters = {
                samplingInterval: samplingInterval,
                discardOldest: false,
                queueSize: 1
            };

            var createMonitoredItemsRequest = {

                subscriptionId: 1,
                timestampsToReturn: TimestampsToReturn.Both,
                itemsToCreate: [{
                    itemToMonitor: itemToMonitor,
                    requestedParameters: parameters,
                    monitoringMode: MonitoringMode.Reporting
                }]
            };

            function sendPublishRequest(session, callback) {


                var publishEngine = session.getPublishEngine();
                publishEngine.send_publish_request();

            }

            var last_dataValue = null;
            async.series([

                function(callback) {
                    session.createSubscription(createSubscriptionRequest, function(err, createSubscriptionResponse) {
                        //xx console.log("createSubscriptionResponse= ",createSubscriptionResponse.toString());
                        createMonitoredItemsRequest.subscriptionId = createSubscriptionResponse.subscriptionId;
                        callback(err);
                    });
                },
                function(callback) {

                    session.createMonitoredItems(createMonitoredItemsRequest, function(err, createMonitoredItemsResponse) {
                        callback(err);
                    });
                },

                function(callback) {


                    sendPublishRequest(session, function(err, response) {
                        var notification = response.notificationMessage.notificationData[0].monitoredItems[0];
                        console.log("notification= ", notification.toString().green);
                        last_dataValue = notification.value;
                        callback(err);
                    });
                },
                function(callback) {
                    writeValue(session, 1, callback);
                },
                function(callback) {
                    writeValue(session, 2, callback);
                },
                function(callback) {
                    writeValue(session, 3, callback);
                },
                function(callback) {
                    writeValue(session, 4, callback);
                },
                function(callback) {
                    writeValue(session, 5, callback);
                },
                function(callback) {
                    writeValue(session, 6, callback);
                },
                function(callback) {
                    writeValue(session, 7, callback);
                },

                function(callback) {
                    callback();
                },

                function(callback) {
                    sendPublishRequest(session, function(err, response) {
                        var notification = response.notificationMessage.notificationData[0].monitoredItems[0];
                        console.log("notification= ", notification.toString().red);
                        last_dataValue = notification.value;
                        callback(err);
                    });
                },

                function(callback) {
                    setTimeout(callback, publishingInterval * 2);
                },

                function(callback) {
                    //xx should(change_count - cur_change_count ).be.eql(1);
                    last_dataValue.value.value.should.eql(7);
                    callback();
                }
            ], inner_done);

        }, done);
    });

    it("#ModifySubscriptionRequest: should return BadSubscriptionIdInvalid if client specifies a invalid subscriptionId", function(done) {

        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

            var modifySubscriptionRequest = {
                subscriptionId: 999,
            };

            session.modifySubscription(modifySubscriptionRequest, function(err) {
                err.message.should.match(/BadSubscriptionIdInvalid/);
                inner_done();
            });
        }, done);
    });
    it("#ModifySubscriptionRequest: should return StatusGood", function(done) {

        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {


            var subscription = new ClientSubscription(session, {
                requestedPublishingInterval: 10,
                requestedLifetimeCount: 600,
                requestedMaxKeepAliveCount: 20,
                maxNotificationsPerPublish: 10,
                publishingEnabled: true,
                priority: 6
            });

            subscription.on("terminated", function() {
                //xx console.log(" subscription terminated ".yellow);
                inner_done();
            });
            subscription.on("started", function() {

                async.series([
                    function(callback) {
                        callback();
                    },

                    function(callback) {
                        var modifySubscriptionRequest = {
                            subscriptionId: subscription.subscriptionId,
                            requestedPublishingInterval: 200
                        };
                        session.modifySubscription(modifySubscriptionRequest, function(err, response) {

                            response.revisedPublishingInterval.should.eql(200);

                            callback(err);
                        });
                    }
                ], function(err) {
                    done(err);
                });

            });

        }, done);
    });

    it("#SetMonitoringMode, should return BadSubscriptionIdInvalid when subscriptionId is invalid", function(done) {

        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {
            var setMonitoringModeRequest = {
                subscriptionId: 999,
            };
            session.setMonitoringMode(setMonitoringModeRequest, function(err) {
                err.message.should.match(/BadSubscriptionIdInvalid/);
                inner_done();
            });
        }, done);
    });

    it("#SetMonitoringMode, should return BadNothingToDo if monitoredItemId is empty", function(done) {

        perform_operation_on_subscription(client, endpointUrl, function(session, subscription, inner_done) {
            var setMonitoringModeRequest = {
                subscriptionId: subscription.subscriptionId,
                monitoredItemId: []
            };
            session.setMonitoringMode(setMonitoringModeRequest, function(err) {
                err.message.should.match(/BadNothingToDo/);
                inner_done();
            });

        }, done);
    });

    function perform_operation_on_monitoredItem(client, endpointUrl, monitoredItemId, func, done_func) {

        perform_operation_on_subscription(client, endpointUrl, function(session, subscription, inner_done) {

            var monitoredItem;
            async.series([
                function(callback) {
                    monitoredItem = subscription.monitor({
                        nodeId: resolveNodeId(monitoredItemId),
                        attributeId: AttributeIds.Value
                    }, {
                        samplingInterval: 10,
                        discardOldest: true,
                        queueSize: 1
                    });

                    monitoredItem.on("initialized", function() {
                        callback();
                    });
                },
                function(callback) {
                    func(session, subscription, monitoredItem, callback);
                },
                function(callback) {
                    monitoredItem.terminate(function() {
                        callback();
                    });
                }
            ], inner_done);

        }, done_func);
    }

    it("#SetMonitoringMode, should return BadMonitoredItemIdInvalid is monitoringMode is invalid", function(done) {

        var itemToMonitor = "ns=0;i=2254"; // temperatureVariableId;
        perform_operation_on_monitoredItem(client, endpointUrl, itemToMonitor, function(session, subscription, monitoredItem, inner_done) {
            var setMonitoringModeRequest = {
                subscriptionId: subscription.subscriptionId,
                monitoringMode: opcua.subscription_service.MonitoringMode.Invalid,
                monitoredItemIds: [
                    monitoredItem.monitoredItemId
                ]
            };
            session.setMonitoringMode(setMonitoringModeRequest, function(err) {
                err.message.should.match(/BadMonitoringModeInvalid/);
                inner_done();
            });
        }, done);

    });
    
    it("#SetMonitoringMode, should return BadMonitoredItemIdInvalid when monitoredItem is invalid",function(done){
        var itemToMonitor = "ns=0;i=2254"; // temperatureVariableId;
        perform_operation_on_monitoredItem(client, endpointUrl, itemToMonitor, function(session, subscription, monitoredItem, inner_done) {
            var setMonitoringModeRequest = {
                subscriptionId: subscription.subscriptionId,
                monitoringMode: opcua.subscription_service.MonitoringMode.Sampling,
                monitoredItemIds: [
                    monitoredItem.monitoredItemId + 9999
                ]
            };
            session.setMonitoringMode(setMonitoringModeRequest, function(err,response) {
                
                response.results.length.should.eql(1);
                response.results[0].should.eql(StatusCodes.BadMonitoredItemIdInvalid);
                inner_done(err);
            });
        }, done);         
    }) ;
    
    it("#SetMonitoringMode, should return Good when request is valid",function(done) {
        var itemToMonitor = "ns=0;i=2254"; // temperatureVariableId;
        perform_operation_on_monitoredItem(client, endpointUrl, itemToMonitor, function(session, subscription, monitoredItem, inner_done) {
            
            var setMonitoringModeRequest = {
                subscriptionId: subscription.subscriptionId,
                monitoringMode: opcua.subscription_service.MonitoringMode.Sampling,
                monitoredItemIds: [
                    monitoredItem.monitoredItemId
                ]
            };
            session.setMonitoringMode(setMonitoringModeRequest, function(err,response) {
                response.results.length.should.eql(1);
                response.results[0].should.eql(StatusCodes.Good);
                inner_done(err);
            });
        }, done);        
    });
    
    

});
