/*global describe, it, require*/
"use strict";
const async = require("async");
const should = require("should");

const opcua = require("node-opcua");

const OPCUAClient = opcua.OPCUAClient;
const AttributeIds = opcua.AttributeIds;
const ClientSubscription = opcua.ClientSubscription;


const doDebug = false;


module.exports = function (test) {


    describe("Testing bug #123 - monitoring multiple variables on same subscription", function () {


        it("test",function(done) {

            const server = test.server;

            const refreshRate = 100;

            let counter = 1;
            const namespace = server.engine.addressSpace.getOwnNamespace();

            const variableToMonitor = namespace.addVariable({
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

            const client1 = new OPCUAClient();
            const endpointUrl = test.endpointUrl;

            let the_session;

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

                    const subscription = new ClientSubscription(the_session, {
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
                    });
                    subscription.once("started",function() {
                        if (doDebug) {
                            console.log("publishingInterval",subscription.publishingInterval);
                        }

                    });


                    // monitor 1

                    const monitoredItem1 = subscription.monitor(
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

                    const monitoredItem2 = subscription.monitor(
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
                        subscription.terminate(callback);
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

