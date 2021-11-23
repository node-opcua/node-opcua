"use strict";

const should = require("should");
const async = require("async");
const chalk = require("chalk");
const opcua = require("node-opcua");
const { UAProxyManager } = require("node-opcua-client-proxy");

const OPCUAClient = opcua.OPCUAClient;

const { build_server_with_temperature_device } = require("../../test_helpers/build_server_with_temperature_device");
const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");
const createHVACSystem = require("../../test_helpers/hvac_system").createHVACSystem;

const DataType = opcua.DataType;

const port = 2229;

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing client Proxy", function () {
    this.timeout(Math.max(600000, this.timeout()));

    let server, client, temperatureVariableId, endpointUrl;

    let hvacNodeId = null;

    before(function (done) {
        global.gc && global.gc();

        server = build_server_with_temperature_device({ port }, function (err) {
            if (err) {
                return done(err);
            }
            endpointUrl = server.getEndpointUrl();
            temperatureVariableId = server.temperatureVariableId;

            hvacNodeId = createHVACSystem(server.engine.addressSpace);

            const shutdownReason = server.engine.addressSpace.rootFolder.objects.server.serverStatus.shutdownReason;

            console.log("shutdownReason", shutdownReason.readValue().toString());

            done(err);
        });
    });

    beforeEach(function (done) {
        client = OPCUAClient.create();
        done();
    });

    afterEach(function (done) {
        client = null;
        done();
    });

    after(function (done) {
        server.shutdown(done);
    });

    it("Proxy1 - client should expose a nice little handy javascript object that proxies the HVAC UAObject", function (done) {
        let proxyManager;
        perform_operation_on_client_session(
            client,
            endpointUrl,
            function (session, inner_done) {
                proxyManager = new UAProxyManager(session);

                let hvac;
                async.series(
                    [
                        function (callback) {
                            proxyManager.start(callback);
                        },
                        function (callback) {
                            proxyManager.getObject(hvacNodeId, function (err, data) {
                                if (!err) {
                                    hvac = data;

                                    // console.log("Interior temperature", hvac.interiorTemperature.value);
                                    hvac.interiorTemperature.readValue(function (err, value) {
                                        // console.log(" Interior temperature updated ...", value.toString());
                                        callback(err);
                                    });

                                    return;
                                }
                                callback(err);
                            });
                        },
                        function (callback) {
                            proxyManager.stop(callback);
                        }
                    ],
                    inner_done
                );
            },
            done
        );
    });

    it("Proxy2 - client should expose a nice little handy javascript object that proxies the server UAObject", function (done) {
        let proxyManager;
        perform_operation_on_client_session(
            client,
            endpointUrl,
            function (session, inner_done) {
                proxyManager = new UAProxyManager(session);

                const serverNodeId = opcua.coerceNodeId("i=2253");

                let serverObject = null;

           
                async.series(
                    [
                        function (callback) {
                            proxyManager.start(callback);
                        },

                        function (callback) {
                            console.log("serverNodeId", serverNodeId);

                            proxyManager.getObject(serverNodeId, (err, object) => {
                                if (err) {
                                    console.log(err);
                                } else {
                                    //xx console.log(object);
                                    serverObject = object;
                                    if (!(typeof serverObject.getMonitoredItems === "function")) {
                                        return callback(new Error("Cannot find serverObject.getMonitoredItems"));
                                    }
                                }
                                callback(err);
                            });
                        },

                        function (callback) {
                            serverObject.serverStatus.currentTime.readValue((err, dataValue) => {
                                console.log("currentTime = ",dataValue.toString());
                                callback(err);
                            });
                        },
                        function (callback) {
                            serverObject.serverArray.readValue((err, dataValue) => {
                                 console.log("ServerArray = ",dataValue.toString());
                                callback(err);
                            });
                        },
                        function (callback) {
                            serverObject.serverStatus.readValue((err, dataValue) => {
                                console.log("serverStatus = ",dataValue.toString());
                                callback(err);
                            });
                        },
                        function (callback) {
                            serverObject.serverStatus.buildInfo.readValue((err, dataValue) => {
                                console.log("serverStatus = ",dataValue.toString());
                                callback(err);
                            });
                        },

                        function (callback) {
                            setTimeout(callback, 500);
                        },

                        function (callback) {
                            serverObject.serverStatus.currentTime.readValue((err, dataValue) => {
                                //xx console.log("currentTime = ",dataValue.toString());
                                callback(err);
                            });
                        },

                        function (callback) {
                            // now call getMonitoredItems
                            const subscriptionId = proxyManager.subscription?.subscriptionId || 1;
                            console.log(" SubscriptionID= ", subscriptionId);
                            serverObject.getMonitoredItems({ subscriptionId }, (err, outputArgs) => {
                                console.log("err = ", err);
                                if (!err && outputArgs) {
                                    //xx console.log("outputArgs.clientHandles = ", outputArgs.clientHandles);
                                    //xx console.log("outputArgs.serverHandles = ", outputArgs.serverHandles);
                                }
                                callback();
                            });
                        }
                    ],
                    inner_done
                );
            },
            done
        );
    });

    it("Proxy3 - one can subscribe to proxy object property change", function (done) {
        this.timeout(Math.max(20000, this.timeout()));
        let proxyManager;
        perform_operation_on_client_session(
            client,
            endpointUrl,
            function (session, inner_done) {
                proxyManager = new UAProxyManager(session);

                let hvac;
                async.series(
                    [
                        function (callback) {
                            proxyManager.start(callback);
                        },
                        function (callback) {
                            proxyManager.getObject(hvacNodeId, function (err, data) {
                                if (!err) {
                                    hvac = data;

                                    hvac.setTargetTemperature.inputArguments[0].name.should.eql("targetTemperature");
                                    hvac.setTargetTemperature.inputArguments[0].dataType.value.should.eql(DataType.Double);
                                    hvac.setTargetTemperature.inputArguments[0].valueRank.should.eql(-1);
                                    hvac.setTargetTemperature.outputArguments.length.should.eql(0);

                                    //  console.log("Interior temperature",hvac.interiorTemperature.dataValue);

                                    hvac.interiorTemperature.on("value_changed", function (value) {
                                        console.log(
                                            chalk.yellow("  EVENT: interiorTemperature has changed to "),
                                            value.value.toString()
                                        );
                                    });
                                    hvac.targetTemperature.on("value_changed", function (value) {
                                        console.log(
                                            chalk.cyan("  EVENT: targetTemperature has changed to "),
                                            value.value.toString()
                                        );
                                    });
                                }
                                callback(err);
                            });
                        },

                        function (callback) {
                            hvac.interiorTemperature.readValue(function (err, value) {
                                // console.log"(" reading Interior temperature, got = ...", value.toString());
                                callback(err);
                            });
                        },

                        function (callback) {
                            //xx console.log(" Access Level = ",hvac.interiorTemperature.accessLevel);

                            // it should not be possible to set the interiorTemperature => ReadOnly from the outside
                            hvac.interiorTemperature.writeValue(
                                {
                                    value: new opcua.Variant({ dataType: opcua.DataType.Double, value: 100.0 })
                                },
                                function (err) {
                                    should(err).not.eql(null, " it should not be possible to set readonly interiorTemperature");
                                    err.message.should.match(/BadNotWritable/);
                                    callback();
                                }
                            );
                        },

                        // it should  be possible to set the targetTemperature
                        function (callback) {
                            // it should not be possible to set the interiorTemperature => ReadOnly from the outside
                            hvac.interiorTemperature.writeValue(
                                {
                                    value: new opcua.Variant({ dataType: opcua.DataType.Double, value: 100.0 })
                                },
                                function (err) {
                                    should.exist(err);
                                    err.message.should.match(/BadNotWritable/);
                                    callback();
                                }
                            );
                        },

                        // setting the TargetTemperature outside instrumentRange shall return an error
                        function (callback) {
                            hvac.setTargetTemperature({ targetTemperature: 10000 }, (err, results) => {
                                should.exist(err);
                                //xx console.log("result",err,results);
                                callback();
                            });
                        },
                        function (callback) {
                            hvac.setTargetTemperature({ targetTemperature: 37 }, (err, results) => {
                                //xx console.log("result",results);
                                callback();
                            });
                        },
                        function (callback) {
                            // wait for temperature to settle down
                            setTimeout(callback, 2000);
                        },
                        function (callback) {
                            hvac.setTargetTemperature({ targetTemperature: 18 }, (err, results) => {
                                callback();
                            });
                        },
                        function (callback) {
                            // wait for temperature to settle down
                            setTimeout(callback, 2000);
                        },
                        function (callback) {
                            //xx console.log("stopping proxy");
                            proxyManager.stop(callback);
                        }
                    ],
                    inner_done
                );
            },
            done
        );
    });

    it("Proxy4 - should expose a SubscriptionDiagnostics in Server.ServerDiagnostics.SubscriptionDiagnosticsArray", function (done) {
        let proxyManager;

        perform_operation_on_client_session(
            client,
            endpointUrl,
            function (session, inner_done) {
                proxyManager = new UAProxyManager(session);

                const makeNodeId = opcua.makeNodeId;

                let subscriptionDiagnosticsArray = null;

                let subscriptionId = null;

                async.series(
                    [
                        function (callback) {
                            proxyManager.start(callback);
                        },
                        function (callback) {
                            proxyManager.getObject(
                                makeNodeId(opcua.VariableIds.Server_ServerDiagnostics_SubscriptionDiagnosticsArray),
                                (err, data) => {
                                    if (!err) {
                                        subscriptionDiagnosticsArray = data;
                                    }
                                    callback(err);
                                }
                            );
                        },
                        function (callback) {
                            // subscriptionDiagnosticsArray should have no elements this time
                            //xx console.log(subscriptionDiagnosticsArray.$components[0].toString());
                            subscriptionDiagnosticsArray.$components.length.should.be.greaterThan(1);
                            //xx subscriptionDiagnosticsArray.dataValue.value.dataType.should.eql(opcua.DataType.Null);

                            callback();
                        },

                        // now create a subscription
                        function (callback) {
                            session.createSubscription(
                                {
                                    requestedPublishingInterval: 100, // Duration
                                    requestedLifetimeCount: 6000, // Counter
                                    requestedMaxKeepAliveCount: 10, // Counter
                                    maxNotificationsPerPublish: 100, // Counter
                                    publishingEnabled: true, // Boolean
                                    priority: 14 // Byte
                                },
                                function (err, response) {
                                    if (!err) {
                                        subscriptionId = response.subscriptionId;
                                    }
                                    callback(err);
                                }
                            );
                        },

                        // verify that we have a subscription diagnostics array now
                        function (callback) {
                            // subscriptionDiagnosticsArray should have no elements this time
                            //xx console.log(subscriptionDiagnosticsArray.$components[0].toString());
                            //xx subscriptionDiagnosticsArray.$components.length.should.eql(0);
                            //xx subscriptionDiagnosticsArray.dataValue.value.dataType.should.eql(opcua.DataType.Null);

                            callback();
                        }
                    ],
                    inner_done
                );
            },
            done
        );
    });

    it("Proxy5", async () =>{
        await client.withSessionAsync(endpointUrl, async (session) => {
            const dataValue = await session.read({
                nodeId: opcua.VariableIds.Server_ServerStatus_ShutdownReason
            });
            console.log(dataValue.toString());
        });
    });
});
