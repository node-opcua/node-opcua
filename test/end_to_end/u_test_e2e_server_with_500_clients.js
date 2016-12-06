/*global describe, it, require*/
require("requirish")._(module);
var assert = require("better-assert");
var async = require("async");
var should = require("should");

var opcua = require("index");

var OPCUAClient = opcua.OPCUAClient;

var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;

var doDebug = false;

module.exports = function (test) {


    var MAXCONNECTIONS = 50;

    var max_reached = false;
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
        return (new Date()).getTime()/1000.0;
    }

    var connectivity_strategy = {
        maxRetry: 10,
        initialDelay: 100,
        maxDelay: 200,
        randomisationFactor: 0
    };

    var first_client = null;
    function client_session(data,done) {

        var options = {
            connectionStrategy: connectivity_strategy,
            requestedSessionTimeout: 100000
        };


        var client1 = new OPCUAClient(options);
        var endpointUrl = test.endpointUrl;

        client1.on("send_request",function(req) {
            if(doDebug) { console.log(data.index," >> ",req.constructor.name); }
        });
        client1.on("receive_response",function(res) {
            if(doDebug) { console.log(data.index," << ",res.constructor.name,res.responseHeader.serviceResult.toString()); }
        });
        client1.on("start_reconnection", function (err) {
            if(doDebug) { console.log("start_reconnection".bgWhite.yellow,data.index); }
        });
        client1.on("backoff", function (number, delay) {
            if(doDebug) { console.log("backoff".bgWhite.yellow,data.index,number,delay);}
        });

        should.exist(first_client);

        client1._server_endpoints = first_client._server_endpoints;
        client1.knowsServerEndpoint.should.eql(true);


        function r(t) {
            return Math.ceil(t*100)/100;
        }

        function perform(msg,func,callback) {
            setTimeout(function() {
                if(doDebug) { console.log(msg);}
                var t = getTick();
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
        var the_session;


        //var endpointUrl = "opc.tcp://localhost:12111";
        async.series([

            perform.bind(null,"connecting client " + data.index,function(callback) {
                client1.connect(endpointUrl, callback);
            }),

            function (callback) {

                var timerId = setInterval(function() {
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
            first_client= new opcua.OPCUAClient();
            var endpointUrl = test.endpointUrl;
            first_client.connect(endpointUrl, done);

        });

        it("should accept many clients", function (done) {

            //xx test.server.maxConnectionsPerEndpoint.should.eql(MAXCONNECTIONS);
            test.server.maxAllowedSessionNumber = MAXCONNECTIONS;
            test.server.maxAllowedSessionNumber.should.eql(MAXCONNECTIONS);

            var nb = MAXCONNECTIONS;
            var q = async.queue(client_session, nb);

            for (var i = 0; i < nb; i++) {
                q.push({index: i});
            }

            q.drain = function () {
                //xx console.log("done");
                done();
            }
        });

    });

}
