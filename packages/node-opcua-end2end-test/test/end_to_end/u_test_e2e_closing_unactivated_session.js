"use strict";

const { promisify } = require("util");
const should = require("should");
const async = require("async");

const { assert } = require("node-opcua-assert");
const { OPCUAClient } = require("node-opcua");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
// bug : server reported to many datavalue changed when client monitored a UAVariable consructed with variation 1");
module.exports = function (test) {
    describe("Closing an unactivated session ", function () {
        it("AKQ server shall return BadSessionNotActivated if client attempts to close an unactivated session", async () => {
            const endpointUrl = test.endpointUrl;

            const client1 = OPCUAClient.create({
                connectionStrategy: {
                    maxRetry: 1
                }
            });
            await client1.connect(endpointUrl);

            const session = await new Promise((resolve) => {
                client1._createSession(function (err, session) {
                    resolve(session);
                });
            });

            await session.close();

            await client1.disconnect();
        });
    });

    it("QQQQ a server shall close any unactivated sessions before reaching the maximum number of session", function (done) {
        const maxSessionsForTest = 3;
        const maxSessionsBackup = test.server.engine.serverCapabilities.maxSessions;
        test.server.engine.serverCapabilities.maxSessions = maxSessionsForTest;

        // From OPCUA V1.03 Part 4 5.6.2 CreateSession
        // A Server application should limit the number of Sessions. To protect against misbehaving Clients and denial
        // of service attacks, the Server shall close the oldest Session that is not activated before reaching the
        // maximum number of supported Sessions

        const fail_fast_connectionStrategy = {
            maxRetry: 0 // << NO RETRY !!
        };
        const clients = [];

        const sessions = [];
        function create_unactivated_session(callback) {
            const endpointUrl = test.endpointUrl;
            const client1 = OPCUAClient.create({
                connectionStrategy: fail_fast_connectionStrategy
            });
            let session;
            //xx console.log("xxxxx connecting to server ...");
            async.series(
                [
                    function (callback) {
                        client1.connect(endpointUrl, function (err) {
                            clients.push(client1);
                            callback(err);
                        });
                    },

                    function (callback) {
                        // create a session without activating it...
                        client1._createSession(function (err, l_session) {
                            session = l_session;
                            sessions.push(session);
                            callback(err);
                        });
                    }
                ],
                callback
            );
        }

        test.server.engine.currentSessionCount.should.eql(0, "expecting server to have no session left opened ...");

        async.series(
            [
                function (callback) {
                    setTimeout(callback, 1000);
                },
                function (callback) {
                    test.server.engine.currentSessionCount.should.eql(0);
                    callback();
                },
                function (callback) {
                    create_unactivated_session(callback);
                },
                function (callback) {
                    test.server.engine.currentSessionCount.should.eql(1);
                    callback();
                },
                function (callback) {
                    create_unactivated_session(callback);
                },
                function (callback) {
                    test.server.engine.currentSessionCount.should.eql(2);
                    callback();
                },
                function (callback) {
                    create_unactivated_session(callback);
                },
                function (callback) {
                    test.server.engine.currentSessionCount.should.eql(3);
                    callback();
                },

                function (callback) {
                    create_unactivated_session(callback);
                },
                function (callback) {
                    test.server.engine.currentSessionCount.should.eql(maxSessionsForTest);
                    callback();
                },
                function (callback) {
                    create_unactivated_session(callback);
                },
                function (callback) {
                    test.server.engine.currentSessionCount.should.eql(maxSessionsForTest);
                    callback();
                },
                function (callback) {
                    create_unactivated_session(callback);
                },
                function (callback) {
                    test.server.engine.currentSessionCount.should.eql(maxSessionsForTest);
                    callback();
                },
                function (callback) {
                    create_unactivated_session(callback);
                },
                function (callback) {
                    test.server.engine.currentSessionCount.should.eql(maxSessionsForTest);
                    callback();
                },
                function (callback) {
                    create_unactivated_session(callback);
                },
                function (callback) {
                    test.server.engine.currentSessionCount.should.eql(maxSessionsForTest);
                    callback();
                },
                function (callback) {
                    create_unactivated_session(callback);
                },
                function (callback) {
                    test.server.engine.currentSessionCount.should.eql(maxSessionsForTest);
                    callback();
                },
                function (callback) {
                    create_unactivated_session(callback);
                },
                function (callback) {
                    test.server.engine.currentSessionCount.should.eql(maxSessionsForTest);
                    callback();
                },
                function (callback) {
                    create_unactivated_session(callback);
                },
                function (callback) {
                    test.server.engine.currentSessionCount.should.eql(maxSessionsForTest);
                    callback();
                },
                function (callback) {
                    create_unactivated_session(callback);
                },
                function (callback) {
                    test.server.engine.currentSessionCount.should.eql(maxSessionsForTest);
                    callback();
                },

                function (callback) {
                    // close all sessions
                    async.eachLimit(
                        sessions,
                        1,
                        function (session, inner_callback) {
                            session.close(function (err) {
                                // ignore errors here
                                inner_callback();
                            });
                        },
                        callback
                    );
                },

                function (callback) {
                    // close all connections
                    async.eachLimit(
                        clients,
                        1,
                        function (client, inner_callback) {
                            client.disconnect(function (err) {
                                assert(client._sessions.length === 0, "");
                                inner_callback(err);
                            });
                        },
                        callback
                    );
                },
                function (callback) {
                    setTimeout(callback, 1000);
                },
                function (callback) {
                    test.server.engine.serverCapabilities.maxSessions = maxSessionsBackup;
                    test.server.engine.currentSessionCount.should.eql(0);
                    callback();
                }
            ],
            done
        );
    });
};
