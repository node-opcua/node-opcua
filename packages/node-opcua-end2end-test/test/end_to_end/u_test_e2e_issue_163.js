/*global describe, it, require*/

var assert = require("node-opcua-assert");
var async = require("async");
var should = require("should");

var opcua = require("node-opcua");

var OPCUAClient = opcua.OPCUAClient;
var AttributeIds = opcua.AttributeIds;
var ClientSubscription = opcua.ClientSubscription;



module.exports = function (test) {


    describe("Testing bug #163 ", function () {

        // Bug Report:
        // My data provider is setting opcua.StatusCodes.Bad when there is some problem getting a valid value for a
        // variable. When the status returns to Good State for the dataprovider the opcua server answers get
        // requests with an internal server error.
        // i did some debugging and found out that this error comes from an assert in module ua_variable.js at
        // function isSameVariant called in _Variable_bind_with_simple_get.
        // i was using 0.0.49 0.0.51 and it persists in 0.0.52

        it("test", function (done) {

            var server = test.server;

            var refreshRate = 500;

            var variable2 = 16.0;
            var addressSpace = server.engine.addressSpace;

            var the_Variable = addressSpace.addVariable({
                organizes: addressSpace.rootFolder.objects,
                nodeId: "ns=1;b=1020FFAA",
                browseName: "MyVariable2",
                dataType: "Double",
                value: {
                    get: function () {
                        if (variable2 >= 20.0) {
                            variable2 = 10.0;
                            //xx  console.log("return bad");
                            return opcua.StatusCodes.Bad;
                        }
                        //xx console.log("return normal");
                        variable2++;
                        return new opcua.Variant({dataType: opcua.DataType.Double, value: variable2});
                    },
                    set: function (variant) {
                        variable2 = parseFloat(variant.value);
                        return opcua.StatusCodes.Good;
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
                        requestedPublishingInterval: 150,
                        requestedLifetimeCount: 10 * 60 * 10,
                        requestedMaxKeepAliveCount: 10,
                        maxNotificationsPerPublish: 2,
                        publishingEnabled: true,
                        priority: 6
                    });

                    subscription.once("terminated", function () {
                        //xx console.log("subscription terminated");
                        callback();
                    });
                    subscription.once("started", function () {
                        //xx console.log("publishingInterval", subscription.publishingInterval);

                    });

                    var monitoredItem = subscription.monitor(
                        {nodeId: the_Variable.nodeId, attributeId: AttributeIds.Value},
                        {
                            samplingInterval: refreshRate / 2, // sampling twice as fast as variable refresh rate
                            discardOldest: true,
                            queueSize: 100
                        });

                    monitoredItem.on("changed", function (dataValue) {7
                        //xx console.log("DataValue = ", dataValue.toString());
                    });


                    setTimeout(function () {
                        subscription.terminate();
                    }, 3000);
                },

                function (callback) {
                    the_session.close(callback);
                }

            ], function final(err) {
                client1.disconnect(function () {
                    //xx console.log(" Client disconnected ", (err ? err.message : "null"));
                    done(err);
                });
            });
        });
    });
};





