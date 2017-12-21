/*global describe, it, require*/
"use strict";
var async = require("async");
var should = require("should");

var opcua = require("node-opcua");

var OPCUAClient = opcua.OPCUAClient;
var AttributeIds = opcua.AttributeIds;
var ClientSubscription = opcua.ClientSubscription;


function debugLog() {}


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
                        debugLog("publishingInterval",subscription.publishingInterval);
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
                        opcua.makeBrowsePath(sessionId,".SessionDiagnostics.CurrentMonitoredItemsCount"),
                        opcua.makeBrowsePath(sessionId,".SessionDiagnostics.CurrentSubscriptionsCount"),
                        opcua.makeBrowsePath(sessionId,".SessionDiagnostics")
                    ];
                    the_session.translateBrowsePath(browsePath,function(err,browsePathResults){
                        if (err) { return callback(err); }
                        // debugLog(" browsePathResults",browsePathResults[0].toString());
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

                            if (err) {
                                return callback(err);
                            }

                            //xx console.log("-----------------------------------------------".bgWhite.red,err);
                            //xx console.log("results = ",results);

                            results.length.should.eql(3);
                            var currentMonitoredItemsCount =  results[0].value.value;
                            var currentSubcriptionsCount   =  results[1].value.value;

                            debugLog("CurrentMonitoredItemsCount = ", currentMonitoredItemsCount);
                            debugLog("currentSubcriptionsCount   = ", currentSubcriptionsCount);

                            currentSubcriptionsCount.should.eql(1, "expecting one subscription ");
                            currentMonitoredItemsCount.should.eql(2);

                            results[2].value.value.constructor.name.should.eql("SessionDiagnostics");
                            results[2].value.value.sessionName.toString().should.eql("Session1");

                            debugLog("diagnostic = ", results[2].value.toString());

                            callback(err);
                        });
                    });

                },

                function (callback) {
                    the_subscription.once("terminated", function () {
                        debugLog("subscription terminated");
                        callback();
                    });
                    the_subscription.terminate();
                },

                function (callback) {
                    the_session.close(callback);
                }

            ], function final(err) {
                client1.disconnect(function () {
                    debugLog(" Client disconnected ",(err ? err.message : "null"));
                    done(err);
                });
            });

        });

    });

};

