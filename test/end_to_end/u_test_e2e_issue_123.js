/*global describe, it, require*/
require("requirish")._(module);
var assert = require("better-assert");
var async = require("async");
var should = require("should");

var opcua = require("index");

var OPCUAClient = opcua.OPCUAClient;
var AttributeIds = opcua.AttributeIds;
var resolveNodeId = opcua.resolveNodeId;
var StatusCodes = opcua.StatusCodes;
var DataType = opcua.DataType;
var ClientSubscription = opcua.ClientSubscription;

var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;

var doDebug = false;


module.exports = function (test) {


    describe("Testing bug #123 - monitoring multiple variables on same subscription", function () {


        it("test",function(done) {

            var server = test.server;

            var refreshRate = 100;

            var counter = 1;
            var variableToMonitor = server.engine.addressSpace.addVariable({
                organizedBy: server.engine.addressSpace.rootFolder.objects,
                browseName: "SlowVariable",
                dataType: "UInt32",
                value: {
                    refreshFunc: function (callback) {
                        // simulate a asynchronous behaviour
                        setTimeout(function () {
                            counter += 1;
                            callback(null, new opcua.DataValue({value: { dataType: "UInt32", value: counter } }));
                        }, refreshRate);
                    }
                }
            });

            var client1 = new OPCUAClient();
            var endpointUrl = test.endpointUrl;

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


                function (callback) {

                    var subscription = new ClientSubscription(the_session, {
                        requestedPublishingInterval:  150,
                        requestedLifetimeCount:       10 * 60 * 10,
                        requestedMaxKeepAliveCount:   10,
                        maxNotificationsPerPublish:   2,
                        publishingEnabled: true,
                        priority: 6
                    });

                    subscription.once("terminated", function () {
                        if (doDebug) {
                            console.log("subscription terminated");
                        }
                        callback();
                    });
                    subscription.once("started",function() {
                        if (doDebug) {
                            console.log("publishingInterval",subscription.publishingInterval);
                        }

                    });


                    // monitor 1

                    var monitoredItem1 = subscription.monitor(
                        {nodeId: variableToMonitor.nodeId, attributeId: AttributeIds.Value},
                        {
                            samplingInterval: refreshRate, // sampling twice as fast as variable refresh rate
                            discardOldest: true,
                            queueSize: 100
                        });

                    monitoredItem1.on("changed",function(dataValue){
                        if (doDebug) {
                            console.log("DataValue1 = ",dataValue.value.toString());
                        }
                    });


                    // monitor 2

                    var monitoredItem2 = subscription.monitor(
                        {nodeId: variableToMonitor.nodeId, attributeId: AttributeIds.Value},
                        {
                            samplingInterval: refreshRate, // sampling twice as fast as variable refresh rate
                            discardOldest: true,
                            queueSize: 100
                        });

                    monitoredItem2.on("changed",function(dataValue){
                        if(doDebug) {
                            console.log("DataValue2 = ",dataValue.value.toString());
                        }
                    });


                    setTimeout(function(){
                        subscription.terminate();
                    },1000);
                },

                function (callback) {
                    the_session.close(callback);
                }

            ], function final(err) {
                client1.disconnect(function () {

                    if (doDebug) {
                        console.log(" Client disconnected ",(err ? err.message : "null"));
                    }
                    done(err);
                });
            });

        });

    });

};

