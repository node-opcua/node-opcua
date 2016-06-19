"use strict";

require("requirish")._(module);


var should = require("should");
var path = require("path");
var assert = require("better-assert");
var async = require("async");
var util = require("util");
var _ = require("underscore");

var utils = require("lib/misc/utils");

var opcua = require("index");

var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var build_client_server_session = require("test/helpers/build_client_server_session").build_client_server_session;

var DataType = opcua.DataType;

var UAProxyManager = require("lib/client/proxy").UAProxyManager;

var UAProxyManager = require("lib/client/state_machine_proxy").UAProxyManager;


describe("testing client Proxy", function () {

    this.timeout(Math.max(200000, this._timeout));


    var server_options = {
        port: 2000,
        nodeset_filename: [
            path.join(__dirname,"../fixtures/fixture_simple_statemachine_nodeset2.xml"),
        ]
    };

    var g_session;
    var client_server;

    before(function (done) {

        client_server = build_client_server_session(server_options,function (err) {
            if (!err) {
                g_session = client_server.g_session;

            }
            done(err);
        });

    });

    function dumpStats() {
        var client = client_server.g_session._client;
        console.log("            bytesRead  ", client.bytesRead, " bytes");
        console.log("            bytesRead  ", client.bytesRead, " bytes");
        console.log("transactionsPerformed  ", client.transactionsPerformed, " ");

    }
    after(function (done) {
        dumpStats();
        client_server.shutdown(done);
    });

    var async = require("async");

    /*
     @startuml exclusiveLimitStateMachineType

     9329: HighHigh
     9331: High
     9333: Low
     9335: LowLow
     9335 --> 9333 :   "9337\nLowLowToLow"
     9333 --> 9335 :   "9338\nLowToLowLow"
     9329 --> 9331 :   "9339\nHighHighToHigh"
     9331 --> 9329 :   "9340\nHighToHighHigh"

     @enduml
     */
    it("Z1 should read a state machine", function (done) {

        dumpStats();

        var proxyManager = new UAProxyManager(g_session);

        async.series([
            function (callback) {
                proxyManager.start(callback);
            },
            function (callback) {
                var exclusiveLimitStateMachineType = "ExclusiveLimitStateMachineType";

                proxyManager.getStateMachineType(exclusiveLimitStateMachineType, function (err, obj) {

                    dumpStats();

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
                proxyManager.stop(callback);
            }
        ], done);
    });
    it("Z1 should read a state machine", function (done) {

        var UAProxyManager = require("lib/client/state_machine_proxy").UAProxyManager;

        var proxyManager = new UAProxyManager(g_session);

        async.series([
            function (callback) {
                proxyManager.start(callback);
            },
            function (callback) {
                var ShelvedStateMachineType = "ShelvedStateMachineType";

                proxyManager.getStateMachineType(ShelvedStateMachineType, function (err, obj) {

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
                proxyManager.stop(callback);
            }
        ], done);
    });
});
