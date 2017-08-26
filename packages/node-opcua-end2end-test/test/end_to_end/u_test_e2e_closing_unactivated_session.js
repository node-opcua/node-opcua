/*global xit,it,describe,before,after,beforeEach,afterEach,require*/
"use strict";

var assert = require("better-assert");
var should = require("should");
var async = require("async");
var _ = require("underscore");

var opcua = require("node-opcua");
var OPCUAClient = opcua.OPCUAClient;

// bug : server reported to many datavalue changed when client monitored a UAVariable consructed with variation 1");
module.exports = function (test) {

    describe("Closing an unactivated session ", function () {

        it("AKQ server shall return BadSessionNotActivated if client attempts to close an unactivated session",function(done){

            var endpointUrl = test.endpointUrl;

            var client1 = new OPCUAClient({
                connectionStrategy: {
                    maxRetry:1
                }
            });

            var session =null;
            async.series([
                function (callback) {
                    //xx console.log("xxxxx connecting to server ...");
                    client1.connect(endpointUrl, function (err) {
                        callback(err);
                    });
                },

                function(callback) {
                    client1._createSession(function (err, l_session) {
                      session = l_session;
                        callback(err);
                    });
                },
                function(callback) {

                    session.close(function(err){
                        err.message.should.match(/BadSessionNotActivated/);

                        assert(client1._sessions.length === 0, "");

                        callback();
                    });

                },
                function(callback) {
                    client1.disconnect(function (err) {
                        callback(err);
                    });
                }
            ],done);
        });
    });

    it("QQQQ a server shall close any unactivated sessions before reaching the maximum number of session",function(done) {

        var MAX_SESSIONS = 3;
        var oldMaxAllowedSessionNumber;
        if (test.server) {
            oldMaxAllowedSessionNumber = test.server.maxAllowedSessionNumber;
            test.server.maxAllowedSessionNumber = MAX_SESSIONS;
        }

        var OPCUAClient = opcua.OPCUAClient;

        // From OPCUA V1.03 Part 4 5.6.2 CreateSession
        // A Server application should limit the number of Sessions. To protect against misbehaving Clients and denial
        // of service attacks, the Server shall close the oldest Session that is not activated before reaching the
        // maximum number of supported Sessions

        var fail_fast_connectionStrategy = {
            maxRetry: 0  // << NO RETRY !!
        };
        var clients = [];

        var sessions =[];
        function create_unactivated_session(callback) {

            var endpointUrl = test.endpointUrl;
            var client1 = new OPCUAClient( {
                connectionStrategy:fail_fast_connectionStrategy
            });
            var session ;
            //xx console.log("xxxxx connecting to server ...");
            async.series([
                function(callback) {
                    client1.connect(endpointUrl, function (err) {
                        clients.push(client1);
                        callback(err);
                    });
                },

                function(callback) {
                    // create a session without activating it...
                    client1._createSession(function (err, l_session) {
                        session = l_session;
                        sessions.push(session);
                        callback(err);
                    });
                }

            ],callback);
        }

        test.server.engine.currentSessionCount.should.eql(0,"expecting server to have no session left opened ...");

        async.series([
            function(callback) { setTimeout(callback,1000);},
            function(callback) { test.server.engine.currentSessionCount.should.eql(0);callback(); },
            function(callback) { create_unactivated_session(callback);},
            function(callback) { test.server.engine.currentSessionCount.should.eql(1);callback(); },
            function(callback) { create_unactivated_session(callback);},
            function(callback) { test.server.engine.currentSessionCount.should.eql(2);callback(); },
            function(callback) { create_unactivated_session(callback);},
            function(callback) { test.server.engine.currentSessionCount.should.eql(3);callback(); },

            function(callback) { create_unactivated_session(callback);},
            function(callback) { test.server.engine.currentSessionCount.should.eql(MAX_SESSIONS);callback(); },
            function(callback) { create_unactivated_session(callback);},
            function(callback) { test.server.engine.currentSessionCount.should.eql(MAX_SESSIONS);callback(); },
            function(callback) { create_unactivated_session(callback);},
            function(callback) { test.server.engine.currentSessionCount.should.eql(MAX_SESSIONS);callback(); },
            function(callback) { create_unactivated_session(callback);},
            function(callback) { test.server.engine.currentSessionCount.should.eql(MAX_SESSIONS);callback(); },
            function(callback) { create_unactivated_session(callback);},
            function(callback) { test.server.engine.currentSessionCount.should.eql(MAX_SESSIONS);callback(); },
            function(callback) { create_unactivated_session(callback);},
            function(callback) { test.server.engine.currentSessionCount.should.eql(MAX_SESSIONS);callback(); },
            function(callback) { create_unactivated_session(callback);},
            function(callback) { test.server.engine.currentSessionCount.should.eql(MAX_SESSIONS);callback(); },
            function(callback) { create_unactivated_session(callback);},
            function(callback) { test.server.engine.currentSessionCount.should.eql(MAX_SESSIONS);callback(); },
            function(callback) { create_unactivated_session(callback);},
            function(callback) { test.server.engine.currentSessionCount.should.eql(MAX_SESSIONS);callback(); },

            function (callback) {
                // close all sessions
                async.eachLimit(sessions, 1, function (session, inner_callback) {
                    session.close(function(err){
                        // ignore errors here
                        inner_callback()
                    });
                },callback);
            },


            function (callback) {
                // close all connections
                async.eachLimit(clients,1,function(client,inner_callback){

                    client.disconnect(function(err){
                        assert(client._sessions.length === 0, "");
                        inner_callback(err);
                    });

                },callback)
            },
            function(callback){
                test.server.maxAllowedSessionNumber = oldMaxAllowedSessionNumber;
                test.server.engine.currentSessionCount.should.eql(0);
                callback();
            }
        ],done);

    });

};