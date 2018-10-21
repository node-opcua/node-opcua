"use strict";
/*global describe, it, require*/

const async = require("async");
const should = require("should");

const opcua = require("node-opcua");

const OPCUAClient = opcua.OPCUAClient;

const doDebug = false;

module.exports = function (test) {


    const MAXCONNECTIONS = 50;

    let max_reached = false;
    function all_connections() {
        if (max_reached) {
            return true;
        }
        if (test.server.currentChannelCount >= MAXCONNECTIONS) {
            max_reached = true;
            return true;
        }
        return false;
    }

    function getTick() {
        return Date.now()/1000.0;
    }

    const connectivity_strategy = {
        maxRetry: 10,
        initialDelay: 100,
        maxDelay: 200,
        randomisationFactor: 0
    };

    let first_client = null;
    function client_session(data,done) {

        const options = {
            connectionStrategy: connectivity_strategy,
            requestedSessionTimeout: 100000
        };


        const client1 = OPCUAClient.create(options);
        const endpointUrl = test.endpointUrl;

        client1.on("send_request",function(req) {
            if(doDebug) { console.log(data.index," >> ",req.constructor.name); }
        });
        client1.on("receive_response",function(res) {
            if(doDebug) { console.log(data.index," << ",res.constructor.name,res.responseHeader.serviceResult.toString()); }
        });
        client1.on("start_reconnection", function () {
            if(doDebug) { console.log("start_reconnection".bgWhite.yellow,data.index); }
        });
        client1.on("backoff", function (number, delay) {
            if(doDebug) { console.log("backoff".bgWhite.yellow,data.index,number,delay);}
        });

        should.exist(first_client);

        client1._serverEndpoints = first_client._serverEndpoints;
        client1.knowsServerEndpoint.should.eql(true);


        function r(t) {
            return Math.ceil(t*100)/100;
        }

        function perform(msg,func,callback) {
            setTimeout(function() {
                if(doDebug) { console.log(msg);}
                const t = getTick();
                func(function(err) {
                    if (err) {
                        if(doDebug) { console.log("   ",msg.red, err.message,r(getTick()-t));}
                    } else {
                        if(doDebug) { console.log("   ",msg.green, r(getTick()-t));}

                    }
                    return callback(err);
                });

            },10);
        }
        let the_session;


        async.series([

            perform.bind(null,"connecting client " + data.index,function(callback) {
                client1.connect(endpointUrl, callback);
            }),

            function (callback) {

                const timerId = setInterval(function() {
                    if (all_connections()) {
                        clearInterval(timerId);
                        callback();
                    }
                },200);
            },


            // create a session using client1
            perform.bind(null,"create session " + data.index,function(callback) {

                client1.createSession(function (err, session) {
                    the_session = session;
                    callback(err);
                });
            }),
            function (callback) {
                setTimeout(callback,1000);
            },
            perform.bind(null,"closing session " + data.index,function(callback) {
                the_session.close(function(err) {
                    callback(err);
                });
            }),
            perform.bind(null,"disconnecting client " + data.index,function(callback) {
                client1.disconnect(function (err) {
                    callback(err);
                });
            })
        ], done);

    }

    describe("AZAZ Testing " + MAXCONNECTIONS + " clients", function () {

        before(function(done){
            first_client= opcua.OPCUAClient.create();
            const endpointUrl = test.endpointUrl;
            first_client.connect(endpointUrl, done);

        });
        after(function(done){
            first_client.disconnect(done);
        });

        it("AZAZ-A should accept many clients", function (done) {

            //xx test.server.maxConnectionsPerEndpoint.should.eql(MAXCONNECTIONS);
            test.server.maxAllowedSessionNumber = MAXCONNECTIONS;
            test.server.maxAllowedSessionNumber.should.eql(MAXCONNECTIONS);

            const nb = MAXCONNECTIONS;
            const q = async.queue(client_session, nb);

            for (let i = 0; i < nb; i++) {
                q.push({index: i});
            }

            q.drain = function () {
                //xx console.log("done");
                done();
            };
        });

    });
};
