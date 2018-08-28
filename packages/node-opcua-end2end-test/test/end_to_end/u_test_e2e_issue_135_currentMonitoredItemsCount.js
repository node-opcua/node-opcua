/*global describe, it, require*/
"use strict";
const async = require("async");
const should = require("should");

const opcua = require("node-opcua");

const OPCUAClient = opcua.OPCUAClient;
const AttributeIds = opcua.AttributeIds;
const ClientSubscription = opcua.ClientSubscription;


function debugLog() {}


module.exports = function (test) {


    describe("Testing #135 - a server shall expose currentMonitoredItemsCount", function () {


        it("test",function(done) {

            const server = test.server;

            const refreshRate = 500;

            let counter = 1;
            const slowVar = server.engine.addressSpace.getOwnNamespace().addVariable({
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

            let the_subscription;

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
                    the_subscription = subscription;

                    subscription.once("started",function() {
                        debugLog("publishingInterval",subscription.publishingInterval);
                        callback();
                    });

                    const nodesToMonitor = [
                        slowVar.nodeId, "i=2254",
                    ];

                    nodesToMonitor.forEach(function(nodeId) {
                        const monitoredItem = subscription.monitor(
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

                    const sessionId /* NodeId */ = the_session.sessionId;
                    console.log("session nodeId = ",sessionId.toString());
                    const browsePath = [
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

                        const nodesToRead = [];
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

                        the_session.read(nodesToRead, function (err, dataValues) {

                            if (err) {
                                return callback(err);
                            }

                            //xx console.log("-----------------------------------------------".bgWhite.red,err);
                            //xx console.log("results = ",results);

                            dataValues.length.should.eql(3);
                            const currentMonitoredItemsCount =  dataValues[0].value.value;
                            const currentSubcriptionsCount   =  dataValues[1].value.value;

                            debugLog("CurrentMonitoredItemsCount = ", currentMonitoredItemsCount);
                            debugLog("currentSubcriptionsCount   = ", currentSubcriptionsCount);

                            currentSubcriptionsCount.should.eql(1, "expecting one subscription ");
                            currentMonitoredItemsCount.should.eql(2);

                            dataValues[2].value.value.constructor.name.should.eql("SessionDiagnosticsDataType");
                            dataValues[2].value.value.sessionName.toString().should.eql("Session1");

                            debugLog("diagnostic = ", dataValues[2].value.toString());

                            callback(err);
                        });
                    });

                },

                function (callback) {
                    the_subscription.terminate(callback);
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

