"use strict";
var createHVACSystem = require("../helpers/hvac_system").createHVACSystem;
require("requirish")._(module);

var should = require("should");
var assert = require("better-assert");
var async = require("async");
var util = require("util");
var _ = require("underscore");

var utils = require("lib/misc/utils");

var opcua = require("index");

var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;

var DataType = opcua.DataType;

var UAProxyManager = require("lib/client/proxy").UAProxyManager;

describe("testing client Proxy", function () {

    this.timeout(Math.max(600000,this._timeout));

    var server, client, temperatureVariableId, endpointUrl;

    var HVAC_on_server = null;

    var port = 2000;
    before(function (done) {
        port += 1;
        server = build_server_with_temperature_device({port: port}, function (err) {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;

            HVAC_on_server = createHVACSystem(server.engine.addressSpace);

            done(err);
        });
    });

    beforeEach(function (done) {
        client = new opcua.OPCUAClient();
        done();
    });

    afterEach(function (done) {
        client = null;
        done();
    });

    after(function (done) {
        server.shutdown(done);
    });


    it("client should expose a nice little handy javascript object that proxies the HVAC UAObject", function (done) {

        var proxyManager;

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            proxyManager= new UAProxyManager(session);
            var hvacNodeId = HVAC_on_server;


            var hvac;
            async.series([
                function (callback) {
                    proxyManager.start(callback);
                },
                function (callback) {

                    proxyManager.getObject(hvacNodeId,function(err,data){
                        if(!err){

                            hvac = data;
                            //xx console.log("xXXXXX",hvac);

                            console.log("Interior temperature",hvac.interiorTemperature.value);

                            hvac.interiorTemperature.readValue(function(err,value){
                                console.log(" Interior temperature updated ...",value.toString());
				                callback(err);
                            });

                            return;
                        }
                        callback(err);
                    })
                },
                function (callback) {
                    proxyManager.stop(callback);
                }

            ], inner_done);

        },done);
    });


    it("client should expose a nice little handy javascript object that proxies the server UAObject", function (done) {


        var proxyManager ;

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            proxyManager= new UAProxyManager(session);

            var serverNodeId = opcua.coerceNodeId("i=2253");

            var serverObject = null;
            var subscriptionId =-1;

            async.series([

                // create subscription
                function (callback) {

                    session.createSubscription({
                        requestedPublishingInterval: 100, // Duration
                        requestedLifetimeCount: 10,    // Counter
                        requestedMaxKeepAliveCount: 10, // Counter
                        maxNotificationsPerPublish: 10, // Counter
                        publishingEnabled: true, // Boolean
                        priority: 14 // Byte
                    }, function (err, response) {

                        if (!err) {
                            subscriptionId =response.subscriptionId;
                        }
                        callback(err);
                    });

                },

                function (callback) {
                    proxyManager.start(callback);
                },

                function (callback) {

                    proxyManager.getObject(serverNodeId, function (err, object) {
                        //xx console.log(object);
                        serverObject = object;
                        _.isFunction(serverObject.getMonitoredItems).should.eql(true);
                        callback(err);
                    });
                },

                function (callback) {

                    serverObject.serverStatus.currentTime.readValue(function(err,dataValue){
                        console.log("currentTime = ",dataValue.toString());
                        callback();
                    });
                },
                function (callback) {

                    serverObject.serverArray.readValue(function(err,dataValue){
                        console.log("ServerArray = ",dataValue.toString());
                        callback();
                    });
                },
                function (callback) {

                    serverObject.serverStatus.readValue(function(err,dataValue){
                        console.log("serverStatus = ",dataValue.toString());
                        callback();
                    });
                },
                function (callback) {

                    serverObject.serverStatus.buildInfo.readValue(function(err,dataValue){
                        console.log("serverStatus = ",dataValue.toString());
                        callback();
                    });
                },

                function (callback) {
                    setTimeout(callback,1000);
                },

                function (callback) {

                    serverObject.serverStatus.currentTime.readValue(function(err,dataValue){
                        console.log("currentTime = ",dataValue.toString());
                        callback();
                    });
                },

                function (callback) {

                    // now call getMonitoredItems
                    console.log(" SubscriptionID= ", subscriptionId);

                    serverObject.getMonitoredItems({subscriptionId: subscriptionId }, function (err, outputArgs) {
                        console.log("err = ", err);
                        if (!err && outputArgs){
                            console.log("outputArgs.clientHandles = ", outputArgs.clientHandles);
                            console.log("outputArgs.serverHandles = ", outputArgs.serverHandles);
                        }
                        callback(err);
                    });

                }
            ], inner_done);

        }, done);
    });

    it("AA one can subscribe to proxy object property change", function (done) {

        this.timeout(Math.max(20000,this._timeout));

        var proxyManager;

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            proxyManager= new UAProxyManager(session);
            var hvacNodeId = HVAC_on_server;


            var hvac;
            async.series([
                function (callback) {
                    proxyManager.start(callback);
                },
                function (callback) {

                    proxyManager.getObject(hvacNodeId,function(err,data){

                        if(!err){

                            hvac = data;

                            console.log("Target temperature nodeId =",hvac.targetTemperature.nodeId.toString());
                            console.log("Inside temperature nodeId =",hvac.interiorTemperature.nodeId.toString());
                            //xx console.log("hvac.setTargetTemperature = ",hvac.setTargetTemperature);
                            hvac.setTargetTemperature.inputArguments[0].name.should.eql("targetTemperature");
                            hvac.setTargetTemperature.inputArguments[0].dataType.value.should.eql(DataType.Double.value);
                            hvac.setTargetTemperature.inputArguments[0].valueRank.should.eql(-1);
                            hvac.setTargetTemperature.outputArguments.length.should.eql(0);



//                          console.log("Interior temperature",hvac.interiorTemperature.dataValue);

                            hvac.interiorTemperature.on("value_changed",function(value){
                              //  console.log("  EVENT: interiorTemperature has changed to ".yellow,value.value.toString());
                            });
                            hvac.targetTemperature.on("value_changed",function(value){
                                console.log("  EVENT: targetTemperature has changed to ".cyan,value.value.toString());
                            });


                        }
                        callback(err);
                    })
                },

                function (callback) {

                    hvac.interiorTemperature.readValue(function (err, value) {
                        console.log(" reading Interior temperature, got = ...", value.toString());
                        callback();
                    });
                },

                function (callback) {

                    console.log(" Access Level = ",hvac.interiorTemperature.accessLevel);

                    // it should not be possible to set the interiorTemperature => ReadOnly from the outside
                    hvac.interiorTemperature.writeValue({
                        value: new opcua.Variant({ dataType: opcua.DataType.Double, value: 100.00})
                    },function(err) {
                        should(err).not.eql(null," it should not be possible to set readonly interiorTemperature");
                        err.message.should.match(/BadNotWritable/);
                        callback();
                    });

                },

                // it should  be possible to set the targetTemperature
                function(callback) {
                    // it should not be possible to set the interiorTemperature => ReadOnly from the outside
                    hvac.interiorTemperature.writeValue({
                        value: new opcua.Variant({ dataType: opcua.DataType.Double, value: 100.00})
                    },function(err) {
                        should.exist(err);
                        err.message.should.match(/BadNotWritable/);
                        callback();
                    });

                },

                // setting the TargetTemperature outside instrumentRange shall return an error
                function(callback) {


                    hvac.setTargetTemperature({targetTemperature: 10000 },function(err,results){
                        should.exist(err);
                        //xx console.log("result",err,results);
                        callback();
                    });

                },
                function(callback) {
                    hvac.setTargetTemperature({targetTemperature: 37},function(err,results){
                        console.log("result",results);
                        callback();
                    });

                },
                function(callback) {
                    // wait for temperature to settle down
                    setTimeout(callback,2000);
                },
                function(callback) {

                    hvac.setTargetTemperature({targetTemperature: 18},function(err,results){
                        callback();
                    });

                },
                function(callback) {
                    // wait for temperature to settle down
                    setTimeout(callback,2000);
                },
                function (callback) {
                    console.log("stopping proxy")
                    proxyManager.stop(callback);
                }

            ], inner_done);

        },done);
    });


    it("ZZ1 should expose a SubscriptionDiagnostics in Server.ServerDiagnostics.SubscriptionDiagnosticsArray", function(done) {

        var proxyManager;

        //xx endpointUrl = "opc.tcp://localhost:48010";

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            proxyManager = new UAProxyManager(session);

            var makeNodeId = opcua.makeNodeId;

            var subscriptionDiagnosticsArray =null;

            var subscriptionId =null;

            async.series([
                function (callback) {
                    proxyManager.start(callback);
                },
                function (callback) {

                    proxyManager.getObject(makeNodeId(opcua.VariableIds.Server_ServerDiagnostics_SubscriptionDiagnosticsArray), function (err, data) {

                        if (!err) {
                            subscriptionDiagnosticsArray = data;
                        }
                        callback(err);
                    });
                },
                function (callback) {

                    // subscriptionDiagnosticsArray should have no elements this time
                    //xx console.log(subscriptionDiagnosticsArray.$components[0].toString());
                    subscriptionDiagnosticsArray.$components.length.should.be.greaterThan(5);
                    //xx subscriptionDiagnosticsArray.dataValue.value.dataType.should.eql(opcua.DataType.Null);

                    callback();
                },

                // now create a subscription
                function (callback) {

                    session.createSubscription({
                        requestedPublishingInterval: 100, // Duration
                        requestedLifetimeCount: 10,    // Counter
                        requestedMaxKeepAliveCount: 10, // Counter
                        maxNotificationsPerPublish: 10, // Counter
                        publishingEnabled: true, // Boolean
                        priority: 14 // Byte
                    }, function (err, response) {

                        if (!err) {
                            subscriptionId =response.subscriptionId;
                        }
                        callback(err);
                    });
                },

                // verify that we have a subscription diagnostics array now
                function (callback) {

                    // subscriptionDiagnosticsArray should have no elements this time
                    //xx console.log(subscriptionDiagnosticsArray.$components[0].toString());
                    //xx subscriptionDiagnosticsArray.$components.length.should.eql(0);
                    //xx subscriptionDiagnosticsArray.dataValue.value.dataType.should.eql(opcua.DataType.Null);

                    callback();
                },

            ], inner_done);

        },done);

    });
});

