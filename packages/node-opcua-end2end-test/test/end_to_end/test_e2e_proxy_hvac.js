"use strict";
const createHVACSystem = require("../../test_helpers/hvac_system").createHVACSystem;


const should = require("should");
const async = require("async");
const _ = require("underscore");


const opcua = require("node-opcua");
const OPCUAClient = opcua.OPCUAClient;

const build_server_with_temperature_device = require("../../test_helpers/build_server_with_temperature_device").build_server_with_temperature_device;
const perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

const DataType = opcua.DataType;

const UAProxyManager = require("node-opcua-client-proxy").UAProxyManager;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing client Proxy", function() {

    this.timeout(Math.max(600000, this.timeout()));

    let server, client, temperatureVariableId, endpointUrl;

    let HVAC_on_server = null;

    let port = 2000;
    before(function(done) {
        port += 1;

        server = build_server_with_temperature_device({ port: port }, function(err) {

            if (err) {
                return done(err);
            }
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;

            HVAC_on_server = createHVACSystem(server.engine.addressSpace);

            done(err);
        });
    });

    beforeEach(function(done) {
        client = OPCUAClient.create();
        done();
    });

    afterEach(function(done) {
        client = null;
        done();
    });

    after(function(done) {
        server.shutdown(done);
    });


    it("client should expose a nice little handy javascript object that proxies the HVAC UAObject", function(done) {

        let proxyManager;
        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

            proxyManager = new UAProxyManager(session);
            const hvacNodeId = HVAC_on_server;


            let hvac;
            async.series([
                function(callback) {
                    proxyManager.start(callback);
                },
                function(callback) {

                    proxyManager.getObject(hvacNodeId, function(err, data) {
                        if (!err) {

                            hvac = data;
                            //xx console.log("xXXXXX",hvac);

                            console.log("Interior temperature", hvac.interiorTemperature.value);

                            hvac.interiorTemperature.readValue(function(err, value) {
                                console.log(" Interior temperature updated ...", value.toString());
                                callback(err);
                            });

                            return;
                        }
                        callback(err);
                    });
                },
                function(callback) {
                    proxyManager.stop(callback);
                }

            ], inner_done);

        }, done);
    });


    it("client should expose a nice little handy javascript object that proxies the server UAObject", function(done) {

        let proxyManager;
        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

            proxyManager = new UAProxyManager(session);

            const serverNodeId = opcua.coerceNodeId("i=2253");

            let serverObject = null;
            let subscriptionId = -1;

            async.series([

                // create subscription
                function(callback) {

                    session.createSubscription({
                        requestedPublishingInterval: 100, // Duration
                        requestedLifetimeCount: 1000, // Counter
                        requestedMaxKeepAliveCount: 10, // Counter
                        maxNotificationsPerPublish: 10, // Counter
                        publishingEnabled: true, // Boolean
                        priority: 14 // Byte
                    }, function(err, response) {

                        if (!err) {
                            subscriptionId = response.subscriptionId;
                        }
                        callback(err);
                    });

                },

                function(callback) {
                    proxyManager.start(callback);
                },

                function(callback) {

                    proxyManager.getObject(serverNodeId, function(err, object) {
                        //xx console.log(object);
                        serverObject = object;
                        (typeof serverObject.getMonitoredItems === "function").should.eql(true);
                        callback(err);
                    });
                },

                function(callback) {

                    serverObject.serverStatus.currentTime.readValue(function(err, dataValue) {
                        //xx console.log("currentTime = ",dataValue.toString());
                        callback(err);
                    });
                },
                function(callback) {

                    serverObject.serverArray.readValue(function(err, dataValue) {
                        //xx console.log("ServerArray = ",dataValue.toString());
                        callback(err);
                    });
                },
                function(callback) {

                    serverObject.serverStatus.readValue(function(err, dataValue) {
                        //xx console.log("serverStatus = ",dataValue.toString());
                        callback(err);
                    });
                },
                function(callback) {

                    serverObject.serverStatus.buildInfo.readValue(function(err, dataValue) {
                        //xx console.log("serverStatus = ",dataValue.toString());
                        callback(err);
                    });
                },

                function(callback) {
                    setTimeout(callback, 1000);
                },

                function(callback) {

                    serverObject.serverStatus.currentTime.readValue(function(err, dataValue) {
                        //xx console.log("currentTime = ",dataValue.toString());
                        callback(err);
                    });
                },

                function(callback) {

                    // now call getMonitoredItems
                    //xx console.log(" SubscriptionID= ", subscriptionId);

                    serverObject.getMonitoredItems({ subscriptionId: subscriptionId }, function(err, outputArgs) {
                        //xx console.log("err = ", err);
                        if (!err && outputArgs) {
                            //xx console.log("outputArgs.clientHandles = ", outputArgs.clientHandles);
                            //xx console.log("outputArgs.serverHandles = ", outputArgs.serverHandles);
                        }
                        callback(err);
                    });
                }
            ], inner_done);
        }, done);
    });

    it("AA one can subscribe to proxy object property change", function(done) {

        this.timeout(Math.max(20000, this.timeout()));
        let proxyManager;
        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

            proxyManager = new UAProxyManager(session);
            const hvacNodeId = HVAC_on_server;


            let hvac;
            async.series([
                function(callback) {
                    proxyManager.start(callback);
                },
                function(callback) {

                    proxyManager.getObject(hvacNodeId, function(err, data) {

                        if (!err) {

                            hvac = data;

                            hvac.setTargetTemperature.inputArguments[0].name.should.eql("targetTemperature");
                            hvac.setTargetTemperature.inputArguments[0].dataType.value.should.eql(DataType.Double);
                            hvac.setTargetTemperature.inputArguments[0].valueRank.should.eql(-1);
                            hvac.setTargetTemperature.outputArguments.length.should.eql(0);


                            //                          console.log("Interior temperature",hvac.interiorTemperature.dataValue);

                            hvac.interiorTemperature.on("value_changed", function(value) {
                                console.log(chalk.yellow("  EVENT: interiorTemperature has changed to "), value.value.toString());
                            });
                            hvac.targetTemperature.on("value_changed", function(value) {
                                console.log(chalk.cyan("  EVENT: targetTemperature has changed to "), value.value.toString());
                            });


                        }
                        callback(err);
                    });
                },

                function(callback) {

                    hvac.interiorTemperature.readValue(function(err, value) {
                        console.log(" reading Interior temperature, got = ...", value.toString());
                        callback(err);
                    });
                },

                function(callback) {

                    //xx console.log(" Access Level = ",hvac.interiorTemperature.accessLevel);

                    // it should not be possible to set the interiorTemperature => ReadOnly from the outside
                    hvac.interiorTemperature.writeValue({
                        value: new opcua.Variant({ dataType: opcua.DataType.Double, value: 100.00 })
                    }, function(err) {
                        should(err).not.eql(null, " it should not be possible to set readonly interiorTemperature");
                        err.message.should.match(/BadNotWritable/);
                        callback();
                    });

                },

                // it should  be possible to set the targetTemperature
                function(callback) {
                    // it should not be possible to set the interiorTemperature => ReadOnly from the outside
                    hvac.interiorTemperature.writeValue({
                        value: new opcua.Variant({ dataType: opcua.DataType.Double, value: 100.00 })
                    }, function(err) {
                        should.exist(err);
                        err.message.should.match(/BadNotWritable/);
                        callback();
                    });

                },

                // setting the TargetTemperature outside instrumentRange shall return an error
                function(callback) {


                    hvac.setTargetTemperature({ targetTemperature: 10000 }, function(err, results) {
                        should.exist(err);
                        //xx console.log("result",err,results);
                        callback();
                    });

                },
                function(callback) {
                    hvac.setTargetTemperature({ targetTemperature: 37 }, function(err, results) {
                        //xx console.log("result",results);
                        callback();
                    });

                },
                function(callback) {
                    // wait for temperature to settle down
                    setTimeout(callback, 2000);
                },
                function(callback) {

                    hvac.setTargetTemperature({ targetTemperature: 18 }, function(err, results) {
                        callback();
                    });

                },
                function(callback) {
                    // wait for temperature to settle down
                    setTimeout(callback, 2000);
                },
                function(callback) {
                    //xx console.log("stopping proxy");
                    proxyManager.stop(callback);
                }

            ], inner_done);

        }, done);
    });


    it("ZZ1 should expose a SubscriptionDiagnostics in Server.ServerDiagnostics.SubscriptionDiagnosticsArray", function(done) {

        let proxyManager;

        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

            proxyManager = new UAProxyManager(session);

            const makeNodeId = opcua.makeNodeId;

            let subscriptionDiagnosticsArray = null;

            let subscriptionId = null;

            async.series([
                function(callback) {
                    proxyManager.start(callback);
                },
                function(callback) {

                    proxyManager.getObject(makeNodeId(opcua.VariableIds.Server_ServerDiagnostics_SubscriptionDiagnosticsArray), function(err, data) {

                        if (!err) {
                            subscriptionDiagnosticsArray = data;
                        }
                        callback(err);
                    });
                },
                function(callback) {

                    // subscriptionDiagnosticsArray should have no elements this time
                    //xx console.log(subscriptionDiagnosticsArray.$components[0].toString());
                    subscriptionDiagnosticsArray.$components.length.should.be.greaterThan(1);
                    //xx subscriptionDiagnosticsArray.dataValue.value.dataType.should.eql(opcua.DataType.Null);

                    callback();
                },

                // now create a subscription
                function(callback) {

                    session.createSubscription({
                        requestedPublishingInterval: 100, // Duration
                        requestedLifetimeCount: 6000, // Counter
                        requestedMaxKeepAliveCount: 1000, // Counter
                        maxNotificationsPerPublish: 10, // Counter
                        publishingEnabled: true, // Boolean
                        priority: 14 // Byte
                    }, function(err, response) {

                        if (!err) {
                            subscriptionId = response.subscriptionId;
                        }
                        callback(err);
                    });
                },

                // verify that we have a subscription diagnostics array now
                function(callback) {

                    // subscriptionDiagnosticsArray should have no elements this time
                    //xx console.log(subscriptionDiagnosticsArray.$components[0].toString());
                    //xx subscriptionDiagnosticsArray.$components.length.should.eql(0);
                    //xx subscriptionDiagnosticsArray.dataValue.value.dataType.should.eql(opcua.DataType.Null);

                    callback();
                },

            ], inner_done);

        }, done);
    });
});

