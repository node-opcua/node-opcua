/*global describe, it, require*/
var async = require("async");
var should = require("should");
var opcua = require("node-opcua");
var OPCUAClient = opcua.OPCUAClient;


var sessionLiveTime = 3 *1000;
var doDebug = false;

/**
 * open a opcua connect, create a session , and disconnet, without closing the session
 *
 * @param endpointUrl {string}
 * @param callback {Function}
 * @param callback.err
 * @param callback.session
 */
function create_a_pending_session(endpointUrl, callback) {
    var the_session = null;
    var client1 = new OPCUAClient({
        requestedSessionTimeout: sessionLiveTime,
        keepPendingSessionsOnDisconnect: true,
    });
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
                session.timeout.should.eql(sessionLiveTime);
                if (doDebug) {
                    console.log("session  ", session.toString());
                }
                callback();
            });
        },
        function (callback) {
            client1.keepPendingSessionsOnDisconnect.should.eql(true,"we do not want client to close unclosed session on disconnect for us");
            // let not close the session here
            // the_session.close(callback);
            callback();
        },
        function (callback) {
            client1.disconnect(callback);
        }
    ], function final(err) {
        callback(err, the_session);
    });
}

function reactivate_existing_session(endpointUrl, session, callback) {
    var client1 = new OPCUAClient({});
    var the_session;
    async.series([
        function (callback) {
            client1.connect(endpointUrl, callback);
        },
        // create a session using client1
        function (callback) {
            client1.reactivateSession(session, function (err, session) {
                if (err) {
                    return callback(err);
                }
                the_session =session;
                callback();
            });
        },
        function (callback) {
            // let not close the session here
            session.close(callback);
        },
        function (callback) {
            client1.disconnect(callback);
        }
    ], function final(err) {
        callback(err, session);
    });
}

module.exports = function (test) {

    describe("Client and expired session activation", function () {

        it("XKL1 should be possible to re activate a active session not closed by a previous connection", function (done) {


            var endpointUrl = test.endpointUrl;

            var the_session;
            async.series([

                function (callback) {
                    create_a_pending_session(endpointUrl, function (err, session) {
                        the_session = session;
                        callback(err);
                    });
                },
                function reactive_session(callback) {
                    reactivate_existing_session(endpointUrl, the_session, function (err, new_session) {
                        new_session.sessionId.toString().should.eql(the_session.sessionId.toString());
                        callback(err);
                    });
                }
            ], function final(err) {
                done(err);
            });
        });
        it("XKL2 should NOT be possible to re activate a  session not closed by a previous connection that has expired", function (done) {


            var endpointUrl = test.endpointUrl;
            var the_session;
            var client1 = new OPCUAClient({});

            async.series([

                function (callback) {
                    create_a_pending_session(endpointUrl, function (err, session) {
                        the_session = session;
                        callback(err);
                    });
                },
                function (callback) {
                    if (doDebug) {
                        console.log("Waiting for session to expire on server side ....");
                    }
                    setTimeout(callback, sessionLiveTime*2);
                },

                function (callback) {
                    client1.connect(endpointUrl, callback);
                },
                // create a session using client1

                function (callback) {
                    client1.reactivateSession(the_session, function (err, session) {
                        should.exist(err,"expeciting session reactivation to fail, because it has timedout");
                        callback(err ?  null : new Error("expecting a error"));
                    });
                },
                function (callback) {
                    // let not close the session here, because it failed to reactivate
                    //xx the_session.close(callback);
                    callback();
                },
                function (callback) {
                    client1.disconnect(callback);
                },
            ], function final(err) {
                done(err);
            });
        });
    });
};

