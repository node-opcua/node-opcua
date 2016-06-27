"use strict";



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

var createBoilerType = require("test/helpers/boiler_system").createBoilerType;
var makeBoiler       = require("test/helpers/boiler_system").makeBoiler;


var UAProxyManager = require("lib/client/proxy").UAProxyManager;
require("lib/client/state_machine_proxy");


describe("testing monitoring Executable flags on methods", function () {

    this.timeout(Math.max(600000, this._timeout));

    var server, client, endpointUrl;

    var boiler_on_server ;
    var port = 2000;
    before(function (done) {
        port += 1;

        var options = {port: port};
        server = new opcua.OPCUAServer(options);

        server.on("post_initialize",function() {
            boiler_on_server= makeBoiler(server.engine.addressSpace,{ browseName: "Boiler#1" });

            var haltMethod  = boiler_on_server.simulation.getMethodByName("Halt");
            var resetMethod = boiler_on_server.simulation.getMethodByName("Reset");
            var startMethod   = boiler_on_server.simulation.getMethodByName("Start");
            var suspendMethod   = boiler_on_server.simulation.getMethodByName("Suspend");
            haltMethod.getExecutableFlag().should.eql(true);
            resetMethod.getExecutableFlag().should.eql(false);
            startMethod.getExecutableFlag().should.eql(true);
            suspendMethod.getExecutableFlag().should.eql(false);


            boiler_on_server = boiler_on_server.nodeId;
            console.log("2");
        });
        server.start(function (err) {

            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;

            if (err) {
                return done(err);
            }
            assert(server.engine.status === "initialized");
            console.log("1");
            done();
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


    it("#187 ...... ", function (done) {

        var proxyManager;

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            proxyManager = new UAProxyManager(session);
            var nodeId = boiler_on_server;


            var boiler;
            async.series([

                function (callback) {
                    proxyManager.start(callback);
                },

                function (callback) {
                    //xx var smType = "BoilerStateMachineType";
                    var smType = "ProgramStateMachineType";
                    proxyManager.getStateMachineType(smType, function (err, obj) {

                        if (!err) {

                            console.log("InitialState = ", obj.initialState ? obj.initialState.toString() : "<null>");

                            console.log("States       = ", obj.states.map(function (state) {
                                return state.browseName.toString();
                            }));
                            console.log("Transitions  = ", obj.transitions.map(function (transition) {
                                return transition.browseName.toString();
                            }));

                        }
                        callback(err);
                    });
                },
                function (callback) {

                    console.log(" NodeId = ",nodeId.toString());

                    proxyManager.getObject(nodeId, function (err, data) {
                        if (!err) {

                            boiler = data;
                            //xx console.log("xXXXXX",hvac);

                            console.log("Current State", boiler.simulation.currentState.toString());

                            boiler.simulation.currentState.readValue(function (err, value) {
                                console.log(" Interior temperature updated ...", value.toString());
                                callback(err);
                            });

                            return;
                        }
                        callback(err);
                    })
                },
                function (callback) {
                    boiler.simulation.halt([],function(err) {
                        console.log(" HALT => ",err);
                        callback();
                    });
                },
                function (callback) {
                    boiler.simulation.reset([],function(err) {
                        console.log(" Reset => ",err);
                        callback();
                    });
                },
                
                function (callback) { setTimeout(callback,500); },

                function (callback) {
                    boiler.simulation.$methods["start"].executableFlag.should.eql(true);
                    boiler.simulation.$methods["suspend"].executableFlag.should.eql(false);
                    boiler.simulation.$methods["resume"].executableFlag.should.eql(true);
                    boiler.simulation.start([],function(err) {
                        console.log(" start => ",err);
                        callback();
                    });
                },

                function (callback) { setTimeout(callback,200); },

                function (callback) {

                    boiler.simulation.$methods["start"].executableFlag.should.eql(false);
                    boiler.simulation.$methods["suspend"].executableFlag.should.eql(true);
                    boiler.simulation.$methods["resume"].executableFlag.should.eql(false);

                    boiler.simulation.suspend([],function(err) {
                        console.log(" start => ",err);
                        callback();
                    });
                },

                function (callback) {
                    proxyManager.stop(callback);
                }

            ], inner_done);

        }, done);
    });
});
