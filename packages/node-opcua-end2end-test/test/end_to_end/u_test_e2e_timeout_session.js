/*global describe, it, require*/

const async = require("async");
const should = require("should");

const opcua = require("node-opcua");
const OPCUAClient = opcua.OPCUAClient;

const sinon = require("sinon");

module.exports = function (test) {


    describe("ZZZA Testing timeout on session ", function () {

        it("An opened session will eventually time out on server side if the client doesn't make transactions", function (done) {

            const endpointUrl = test.endpointUrl;
            // Given  client connect to a server a
            // Given that the client open a session.
            // Given that the client does nothing

            const client1 = OPCUAClient.create({
                keepSessionAlive: false,
            });

            let the_session;

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
                        should.not.exist(err);
                        // xx // session must have timed out on server side
                        // xx err.message.should.match(/BadSessionIdInvalid/);
                        callback(null);
                    });
                }

            ], function final(err) {
                client1.disconnect(function () {

                    if (test.server) {
                        test.server.engine.currentSessionCount.should.eql(0);
                    }
                    done(err);
                });
            });

        });

        it("An opened session will not time out on server side if the client has keepSessionAlive = true 1/2", function (done) {

            const client1 = OPCUAClient.create({
                keepSessionAlive: true
            });
            const connection_lost_spy = sinon.spy();
            client1.on("connection_lost", connection_lost_spy);

            const endpointUrl = test.endpointUrl;

            let the_session;

            const keepalive_spy = sinon.spy();

            async.series([
                function (callback) {
                    client1.connect(endpointUrl, callback);
                },
                // create a session using client1
                function (callback) {

                    // set a very short sessionTimeout ( > 500 though)
                    client1.requestedSessionTimeout = 1000;

                    //xx console.log("requestedSessionTimeout = ", client1.requestedSessionTimeout);

                    client1.createSession(function (err, session) {
                        //console.log("adjusted session timeout =", session.timeout);
                        session.timeout.should.eql(1000);
                        if (err) {
                            return callback(err);
                        }
                        the_session = session;
                        the_session.on("keepalive", keepalive_spy);

                        // let check that keep alive manager is active and as a checkInterval
                        // which is belw session Tyimeout
                        session._keepAliveManager.checkInterval.should.eql(500);

                        callback();
                    });
                },

                function (callback) {
                    setTimeout(callback, 5000);
                },

                function (callback) {
                    the_session.close(function (err) {
                        keepalive_spy.callCount.should.be.greaterThan(2);
                        callback(err);
                    });
                }

            ], function final(err) {
                client1.disconnect(function () {
                    connection_lost_spy.callCount.should.eql(0);
                    done(err);
                });
            });
        });
        it("An opened session will not time-out on server side if the client has keepSessionAlive = true 2/2", function (done) {


            let timerId;

            const client1 = OPCUAClient.create({
                keepSessionAlive: true
            });

            const connection_lost_spy = sinon.spy();
            client1.on("connection_lost", connection_lost_spy);

            const endpointUrl = test.endpointUrl;

            let the_session;

            const keepalive_spy = sinon.spy();

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
                        if (err) {
                            console.log("cannot create session  err= ", err.message);
                            return callback(err);
                        }
                        console.log("adjusted session timeout =", session.timeout);
                        session.timeout.should.eql(client1.requestedSessionTimeout);

                        // let check that keep alive manager is active and as a checkInterval
                        // which is belw session Tyimeout
                        session._keepAliveManager.checkInterval.should.eql(500);

                        the_session = session;
                        the_session.on("keepalive", keepalive_spy);
                        the_session.on("keepalive", () => {
                            console.log("What's going here ? We should not receive KEEPALIVE " +
                              " as client is regularly communicating with server");
                        });
                        callback();
                    });
                },

                function (callback) {
                    the_session.read({ nodeId: "ns=1;i=54" }, function (err, dataValue) {
                        callback();
                    });
                },

                // periodically send a request to the server , for a duration of 2000 ms
                function (callback) {

                    timerId = setInterval(function () {
                        the_session.read({ nodeId: "ns=1;i=54" }, function (err, dataValue) {
                        });
                    }, 500);

                    setTimeout(function () {
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
                    connection_lost_spy.callCount.should.eql(0);
                    done(err);
                });
            });
        });
    });
};




