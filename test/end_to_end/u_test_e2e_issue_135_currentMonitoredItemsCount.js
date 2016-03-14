/*global describe, it, require*/
require("requirish")._(module);
var assert = require("better-assert");
var async = require("async");
var should = require("should");

var opcua = require("index");

var OPCUAClient = opcua.OPCUAClient;
var AttributeIds = opcua.AttributeIds;
var ClientSubscription = opcua.ClientSubscription;

var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;


module.exports = function (test) {


    describe("Testing #135 - a server shall expose currentMonitoredItemsCount", function () {


        it("test",function(done) {

            var server = test.server;

            var refreshRate = 500;

            var counter = 1;
            var slowVar = server.engine.addressSpace.addVariable({
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

            var the_subscription;

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
                    the_subscription = subscription;

                    subscription.once("started",function() {
                        console.log("publishingInterval",subscription.publishingInterval);
                        callback();
                    });

                    var nodesToMonitor = [
                        slowVar.nodeId, "i=2254",
                    ];

                    nodesToMonitor.forEach(function(nodeId) {
                        var monitoredItem = subscription.monitor(
                            {nodeId: nodeId, attributeId: AttributeIds.Value},
                            {
                                samplingInterval: refreshRate/2, // sampling twice as fast as variable refresh rate
                                discardOldest: true,
                                queueSize: 100
                            });

                    });

                },

                // DO SOMETHING HERE TO READ THE currentMonitoredItemsCount

                function(callback) {

                    var sessionId /* NodeId */ = the_session.sessionId;
                    var browsePath = [
                        opcua.browse_service.makeBrowsePath(sessionId,".SessionDiagnostics.CurrentMonitoredItemsCount"),
                        opcua.browse_service.makeBrowsePath(sessionId,".SessionDiagnostics.CurrentSubscriptionsCount"),
                        opcua.browse_service.makeBrowsePath(sessionId,".SessionDiagnostics")
                    ];
                    the_session.translateBrowsePath(browsePath,function(err,browsePathResults){
                        if (err) { return callback(err); }
                        // console.log(" browsePathResults",browsePathResults[0].toString());
                        browsePathResults[0].statusCode.should.eql(opcua.StatusCodes.Good);
                        browsePathResults[1].statusCode.should.eql(opcua.StatusCodes.Good);
                        browsePathResults[2].statusCode.should.eql(opcua.StatusCodes.Good);

                        var nodesToRead = [];
                        nodesToRead.push({
                            nodeId: browsePathResults[0].targets[0].targetId,
                            attributeId: AttributeIds.Value
                        });

                        nodesToRead.push({
                            nodeId: browsePathResults[1].targets[0].targetId,
                            attributeId: AttributeIds.Value
                        });
                        nodesToRead.push({
                            nodeId: browsePathResults[2].targets[0].targetId,
                            attributeId: AttributeIds.Value
                        });

                        the_session.read(nodesToRead, function (err, a, results) {

                            var currentMonitoredItemsCount =  results[0].value.value;
                            var currentSubcriptionsCount   =  results[1].value.value;
                            console.log("CurrentMonitoredItemsCount = ", currentMonitoredItemsCount);
                            console.log("currentSubcriptionsCount   = ", currentSubcriptionsCount);

                            currentSubcriptionsCount.should.eql(1);
                            currentMonitoredItemsCount.should.eql(2);
                            console.log("diagnostic = ", results[2].value.toString());

                            callback(err);
                        });
                    });

                },

                function (callback) {
                    the_subscription.once("terminated", function () {
                        console.log("subscription terminated");
                        callback();
                    });
                    the_subscription.terminate();
                },

                function (callback) {
                    the_session.close(callback);
                }

            ], function final(err) {
                client1.disconnect(function () {
                    console.log(" Client disconnected ",(err ? err.message : "null"));
                    done(err);
                });
            });

        });

    });

};

