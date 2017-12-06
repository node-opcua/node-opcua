/*global describe, it, require*/

var async = require("async");
var should = require("should");

var opcua = require("node-opcua");
var OPCUAClient = opcua.OPCUAClient;

var sinon = require("sinon");

module.exports = function (test) {


    describe("ZZZA Testing timeout on session ", function () {

        it("An opened session will eventually time out on server side if the client doesn't make transactions", function (done) {

            var endpointUrl = test.endpointUrl;
            // Given  client connect to a server a
            // Given that the client open a session.
            // Given that the client does nothing

            var client1 = new OPCUAClient({
                keepSessionAlive: false
            });

            var the_session;

            async.series([
                function (callback) {
                    client1.connect(endpointUrl, callback);
                },
                // create a session using client1
                function (callback) {

                    // set a very short sessionTimeout
                    client1.requestedSessionTimeout = 1000;

                    //xx console.log("requestedSessionTimeout = ", client1.requestedSessionTimeout);

                    client1.createSession(function (err, session) {

                        //xx console.log("adjusted session timeout =", session.timeout);
                        if (err) {
                            return callback(err);
                        }
                        the_session = session;
                        callback();
                    });
                },

                function (callback) {
                    setTimeout(callback, client1.requestedSessionTimeout * 2.00);
                },

                function (callback) {
                    the_session.close(function (err) {
                        // session must have timed out on server side
                        err.message.should.match(/BadSessionIdInvalid/);
                        callback(null);
                    });
                }

            ], function final(err) {
                client1.disconnect(function () {

                    if(test.server) {
                        test.server.engine.currentSessionCount.should.eql(0);
                    }
                    done(err);
                });
            });

        });

        it("A open session will not time out on server side if the client has keepSessionAlive = true", function (done) {

            var client1 = new OPCUAClient({
                keepSessionAlive: true
            });

            var endpointUrl = test.endpointUrl;

            var the_session;

            var keepalive_spy = sinon.spy();

            async.series([
                function (callback) {
                    client1.connect(endpointUrl, callback);
                },
                // create a session using client1
                function (callback) {

                    // set a very short sessionTimeout
                    client1.requestedSessionTimeout = 500;

                    //xx console.log("requestedSessionTimeout = ", client1.requestedSessionTimeout);

                    client1.createSession(function (err, session) {
                        //console.log("adjusted session timeout =", session.timeout);
                        session.timeout.should.eql(500);
                        if (err) {
                            return callback(err);
                        }
                        the_session = session;
                        the_session.on("keepalive", keepalive_spy);
                        callback();
                    });
                },

                function (callback) {
                    setTimeout(callback, 2000);
                },

                function (callback) {
                    the_session.close(function (err) {
                        keepalive_spy.callCount.should.be.greaterThan(2);
                        callback(err);
                    });
                }

            ], function final(err) {
                client1.disconnect(function () {
                    done(err);
                });
            });
        });
        it("An opened session will not time-out on server side if the client has keepSessionAlive = true", function (done) {


            var timerId;

            var client1 = new OPCUAClient({
                keepSessionAlive: true
            });

            var endpointUrl = test.endpointUrl;

            var the_session;

            var keepalive_spy = sinon.spy();

            async.series([
                function (callback) {
                    client1.connect(endpointUrl, callback);
                },
                // create a session using client1
                function (callback) {

                    // set a very short sessionTimeout
                    client1.requestedSessionTimeout = 2000;

                    //xx console.log("requestedSessionTimeout = ", client1.requestedSessionTimeout);

                    client1.createSession(function (err, session) {
                        //console.log("adjusted session timeout =", session.timeout);
                        session.timeout.should.eql(client1.requestedSessionTimeout);
                        if (err) {
                            return callback(err);
                        }
                        the_session = session;
                        the_session.on("keepalive", keepalive_spy);
                        callback();
                    });
                },

                // periodically send a request to the server , for a duration of 2000 ms
                function (callback) {

                    timerId = setInterval(function(){
                        the_session.read([{nodeId: "ns=1;i=54"}],function(err){
                        });

                    },500);
                    setTimeout(function() {
                        clearInterval(timerId);
                        callback();
                    }, 6000);
                },

                function (callback) {
                    the_session.close(function (err) {
                        // client should not have send keepalive, as  normal transactions happens between
                        // client and server
                        keepalive_spy.callCount.should.be.eql(0);
                        callback(err);
                    });
                }

            ], function final(err) {
                client1.disconnect(function () {
                    done(err);
                });
            });
        });
    });
};




