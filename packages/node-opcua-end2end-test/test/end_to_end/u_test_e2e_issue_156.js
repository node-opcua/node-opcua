"use strict";
const async = require("async");
const should = require("should");

const { DataValue, ClientMonitoredItem, OPCUAClient, AttributeIds, ClientSubscription } = require("node-opcua");

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function (test) {
    describe("Testing bug #156 - monitoring a variable with a sampling rate which is faster that the time taken to acquire the variable value", function () {
        it("test", function (done) {
            const server = test.server;

            const refreshRate = 500;

            const namespace = server.engine.addressSpace.getOwnNamespace();

            let counter = 1;
            const slowVar = namespace.addVariable({
                organizedBy: server.engine.addressSpace.rootFolder.objects,
                browseName: "SlowVariable",
                dataType: "UInt32",
                value: {
                    refreshFunc: function (callback) {
                        // simulate a asynchronous behaviour
                        setTimeout(function () {
                            counter += 1;
                            callback(null, new DataValue({ value: { dataType: "UInt32", value: counter } }));
                        }, refreshRate);
                    }
                }
            });

            const client1 = OPCUAClient.create();
            const endpointUrl = test.endpointUrl;

            let the_session;

            async.series(
                [
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
                        const subscription = ClientSubscription.create(the_session, {
                            requestedPublishingInterval: 150,
                            requestedLifetimeCount: 10 * 60 * 10,
                            requestedMaxKeepAliveCount: 10,
                            maxNotificationsPerPublish: 2,
                            publishingEnabled: true,
                            priority: 6
                        });

                        subscription.once("terminated", function () {
                            //xx console.log("subscription terminated");
                        });
                        subscription.once("started", function () {
                            //xx console.log("publishingInterval",subscription.publishingInterval);
                        });

                        const monitoredItem = ClientMonitoredItem.create(
                            subscription,
                            { nodeId: slowVar.nodeId, attributeId: AttributeIds.Value },
                            {
                                samplingInterval: refreshRate / 2, // sampling twice as fast as variable refresh rate
                                discardOldest: true,
                                queueSize: 100
                            }
                        );

                        monitoredItem.on("changed", function (dataValue) {
                            //xx console.log("DataValue = ",dataValue.value.toString());
                        });

                        setTimeout(function () {
                            subscription.terminate(callback);
                        }, 3000);
                    },

                    function (callback) {
                        the_session.close(callback);
                    }
                ],
                function final(err) {
                    client1.disconnect(function () {
                        //xx console.log(" Client disconnected ",(err ? err.message : "null"));
                        done(err);
                    });
                }
            );
        });
    });
};
