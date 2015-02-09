require("requirish")._(module);
var assert = require("better-assert");
var async = require("async");
var should = require("should");
var sinon = require("sinon");

var opcua = require(".");

var OPCUAClient = opcua.OPCUAClient;
var ClientSession = opcua.ClientSession;
var ClientSubscription = opcua.ClientSubscription;
var AttributeIds = opcua.AttributeIds;
var resolveNodeId = opcua.resolveNodeId;
var StatusCodes = opcua.StatusCodes;

var build_server_with_temperature_device = require("./helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var perform_operation_on_client_session = require("./helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var perform_operation_on_subscription = require("./helpers/perform_operation_on_client_session").perform_operation_on_subscription;

describe("testing Client-Server subscription use case, on a fake server exposing the temperature device", function () {

    var server , client, temperatureVariableId, endpointUrl;

    var port = 2001;
    before(function (done) {
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error
        port += 1;
        server = build_server_with_temperature_device({ port: port}, function () {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done();
        });
    });

    beforeEach(function (done) {
        client = new OPCUAClient();
        done();
    });

    afterEach(function (done) {
        client = null;
        done();
    });

    after(function (done) {
        server.shutdown(done);
    });

    it("should create a ClientSubscription to manage a subscription", function (done) {

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

    it("should dump statistics ", function (done) {

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

    it("a ClientSubscription should receive keep-alive events from the server", function (done) {

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
                console.log(" subscription has received ", nb_keep_alive_received, " keep-alive event(s)");
                nb_keep_alive_received.should.be.greaterThan(0);
                done();
            });
        }, done);
    });

    xit("a ClientSubscription should survive longer than the life time", function (done) {
        // todo
        done();
    });

    it("should be possible to monitor an nodeId value with a ClientSubscription", function (done) {

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

            var monitoredItem = subscription.monitor(
                {nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value},
                {samplingInterval: 10, discardOldest: true, queueSize: 1 });

            // subscription.on("item_added",function(monitoredItem){
            monitoredItem.on("initialized", function () {
                monitoredItem.terminate(function () {
                    subscription.terminate();
                });
            });

        }, done);
    });

    it("should be possible to monitor several nodeId value with a single client subscription",function(done){

        perform_operation_on_client_session(client, endpointUrl, function (session, done) {

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
            var monitoredItemCurrentTime = subscription.monitor(
                {nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value},
                {samplingInterval: 10, discardOldest: true, queueSize: 1 });

            // subscription.on("item_added",function(monitoredItem){
            monitoredItemCurrentTime.on("changed", function (dataValue) {

                console.log(" current time",dataValue.value.value);
                currentTime_changes++;
            });

            var pumpSpeedId = "ns=4;b=0102030405060708090a0b0c0d0e0f10";
            var monitoredItemPumpSpeed = subscription.monitor(
                {nodeId: resolveNodeId(pumpSpeedId), attributeId: AttributeIds.Value},
                {samplingInterval: 10, discardOldest: true, queueSize: 1 });

            var pumpSpeed_changes = 0;
            monitoredItemPumpSpeed.on("changed", function (dataValue) {
                console.log(" pump speed ",dataValue.value.value);
                pumpSpeed_changes++;

            });

            setTimeout(function(){

                pumpSpeed_changes.should.be.greaterThan(1);
                currentTime_changes.should.be.greaterThan(1);
                done();
            },200);

        }, done);
    });

    it("should terminate any pending subscription when the client is disconnected",function(done){


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

                var monitoredItem = subscription.monitor(
                    {
                        nodeId: resolveNodeId("ns=0;i=2258"),
                        attributeId: 13
                    },
                    {samplingInterval: 100, discardOldest: true, queueSize: 1 });

                callback();

            });

        },
        // wait a little bit
        function (callback) {
            setTimeout(function() {
                // client.disconnect(done);
                callback();
            },100);
        },

        // now disconnect the client , without closing the subscription first
        function (callback) {
            client.disconnect(callback);
        }

        ] , function(err) {
            done(err);
        });

    });

});

describe("testing server and subscription", function () {
    var server, client, temperatureVariableId, endpointUrl;
    var port = 2001;
    before(function (done) {
        console.log(" Creating Server");
        server = build_server_with_temperature_device({port: port}, function () {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done();
        });
    });

    beforeEach(function (done) {
        //xx console.log(" creating new client");
        client = new OPCUAClient();
        done();
    });

    afterEach(function (done) {
        //xx console.log(" shutting down client");
        client.disconnect(function (err) {
            client = null;
            done();
        });
    });

    after(function (done) {
        //xx console.log(" shutting down Server");
        server.shutdown(done);
    });

    it(" a server should accept several Publish Requests from the client without sending notification immediately," +
    " and should still be able to reply to other requests", function (done) {

        var subscriptionId;
        perform_operation_on_client_session(client, endpointUrl, function (session, done) {

            async.series([

                function (callback) {
                    session.createSubscription({
                        requestedPublishingInterval: 100,  // Duration
                        requestedLifetimeCount: 10,         // Counter
                        requestedMaxKeepAliveCount: 10,     // Counter
                        maxNotificationsPerPublish: 10,     // Counter
                        publishingEnabled: true,            // Boolean
                        priority: 14                        // Byte
                    }, function (err, response) {
                        subscriptionId = response.subscriptionId;
                        callback(err);
                    });
                },
                function (callback) {
                    session.readVariableValue("RootFolder", function (err, dataValues, diagnosticInfos) {
                        callback(err);
                    });
                },
                function (callback) {

                    // send many publish requests, in one go
                    session.publish({}, function (err, response) {
                    });
                    session.publish({}, function (err, response) {
                    });
                    session.publish({}, function (err, response) {
                    });
                    session.publish({}, function (err, response) {
                    });
                    session.publish({}, function (err, response) {
                    });
                    session.publish({}, function (err, response) {
                    });
                    callback();
                },
                function (callback) {
                    session.readVariableValue("RootFolder", function (err, dataValues, diagnosticInfos) {
                        callback();
                    });
                },
                function (callback) {
                    session.deleteSubscriptions({
                        subscriptionIds: [subscriptionId]
                    }, function (err, response) {
                        callback();
                    });
                }
            ], function (err) {
                done(err);
            });

        }, done);
    });

    it("A Subscription can be added and then deleted", function (done) {
        var subscriptionId;
        perform_operation_on_client_session(client, endpointUrl, function (session, done) {

            async.series([

                function (callback) {
                    session.createSubscription({
                        requestedPublishingInterval: 100,  // Duration
                        requestedLifetimeCount: 10,         // Counter
                        requestedMaxKeepAliveCount: 10,     // Counter
                        maxNotificationsPerPublish: 10,     // Counter
                        publishingEnabled: true,            // Boolean
                        priority: 14                        // Byte
                    }, function (err, response) {
                        subscriptionId = response.subscriptionId;
                        callback(err);
                    });
                },


                function (callback) {
                    session.deleteSubscriptions({
                        subscriptionIds: [subscriptionId]
                    }, function (err, response) {
                        callback();
                    });
                }
            ], function (err) {
                done(err);
            });

        }, done)

    });

    it("A MonitoredItem can be added to a subscription and then deleted", function (done) {

        perform_operation_on_subscription(client, endpointUrl, function (session, subscription, callback) {

            var monitoredItem = subscription.monitor(
                {nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value},
                {samplingInterval: 10, discardOldest: true, queueSize: 1});

            // subscription.on("item_added",function(monitoredItem){
            monitoredItem.on("initialized", function () {
                monitoredItem.terminate(function () {
                    callback();
                });
            });
        }, done);

    });

    it("A MonitoredItem should received changed event", function (done) {

        perform_operation_on_subscription(client, endpointUrl, function (session, subscription, callback) {

            var monitoredItem = subscription.monitor(
                {
                    nodeId: resolveNodeId("ns=0;i=2258"),
                    attributeId: AttributeIds.Value
                },
                {samplingInterval: 100, discardOldest: true, queueSize: 1});

            monitoredItem.on("initialized", function () {
            });

            monitoredItem.on("changed", function (value) {

                // the changed event has been received !

                // lets stop monitoring this item
                monitoredItem.terminate(function () {
                });
            });
            monitoredItem.on("terminated", function (value) {
                callback();
            });

        }, done);

    });

    it("A Server should reject a CreateMonitoredItemRequest if timestamp is invalid ( catching error on monitored item )", function (done) {


        var TimestampsToReturn = require("lib/services/read_service").TimestampsToReturn;

        perform_operation_on_subscription(client, endpointUrl, function (session, subscription, callback) {

            var monitoredItem = subscription.monitor(
                {
                    nodeId: resolveNodeId("ns=0;i=2258"),
                    attributeId: AttributeIds.Value
                },
                {samplingInterval: 100, discardOldest: true, queueSize: 1},

                TimestampsToReturn.Invalid
            );

            var err_counter = 0;
            // subscription.on("item_added",function(monitoredItem){
            monitoredItem.on("initialized", function () {
            });

            monitoredItem.on("changed", function (value) {

            });
            monitoredItem.on("err", function (value) {
                err_counter++;
            });
            monitoredItem.on("terminated", function () {
                err_counter.should.eql(1);
                callback();
            });

        }, done);
    });

    it("A Server should reject a CreateMonitoredItemRequest if timestamp is invalid ( catching error on callback)", function (done) {

        var TimestampsToReturn = require("lib/services/read_service").TimestampsToReturn;

        perform_operation_on_subscription(client, endpointUrl, function (session, subscription, callback) {

            var monitoredItem = subscription.monitor(
                {
                    nodeId: resolveNodeId("ns=0;i=2258"),
                    attributeId: 13
                },
                {samplingInterval: 100, discardOldest: true, queueSize: 1},


                TimestampsToReturn.Invalid, // <= A invalid  TimestampsToReturn

                function (err) {

                    should(err).be.instanceOf(Error);
                    callback(!err);
                }
            );


        }, done);
    });

    it("A Server should be able to revise publish interval to avoid trashing if client specify a very small or zero requestedPublishingInterval", function (done) {

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

});

describe("testing Client-Server subscription use case 2/2, on a fake server exposing the temperature device", function () {

    var server , client, temperatureVariableId, endpointUrl;

    var port = 2001;
    before(function (done) {
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error
        port += 1;
        server = build_server_with_temperature_device({ port: port}, function () {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done();
        });
    });

    beforeEach(function (done) {
        client = new OPCUAClient();
        done();
    });

    afterEach(function (done) {
        client = null;
        done();
    });

    after(function (done) {
        server.shutdown(done);
    });

    this.timeout(10000);

    it("XXX A server should send a StatusChangeNotification if the client doesn't send PublishRequest within the expected interval",function(done){


        endpointUrl = "opc.tcp://localhost:2200/OPCUA/SimulationServer";

        var nb_keep_alive_received= 0;
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
        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {


            var subscription = new ClientSubscription(session, {

                requestedPublishingInterval: 10,
                requestedLifetimeCount:     6,
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
            },1000);

            subscription.on("keepalive", function () {
                nb_keep_alive_received += 1;
                console.log("timeout");
            });
            subscription.on("started", function () {

                console.log("subscriptionId     :",subscription.subscriptionId);
                console.log("publishingInterval :",subscription.publishingInterval);
                console.log("lifetimeCount      :",subscription.lifetimeCount);
                console.log("maxKeepAliveCount  :",subscription.maxKeepAliveCount);

            }).on("status_changed",function(statusCode){

                statusCode.should.eql(StatusCodes.BadTimeout);
                setTimeout(function () {
                    subscription.terminate();
                }, 200);
            }).on("terminated", function () {

                nb_keep_alive_received.should.be.equal(0);
                inner_done();
            });

        },done);


    })
});




