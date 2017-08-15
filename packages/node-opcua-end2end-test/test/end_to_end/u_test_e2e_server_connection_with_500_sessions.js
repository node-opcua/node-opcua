/*global describe, it, require*/

var assert = require("better-assert");
var async = require("async");
var should = require("should");

var opcua = require("node-opcua");

var doDebug = false;

var perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;


module.exports = function (test) {


    var MAXSESSIONS = 50;

    function getTick() {
        return (new Date()).getTime()/1000.0;
    }

    var connectivity_strategy = {
        maxRetry: 100,
        initialDelay: 100,
        maxDelay: 200,
        randomisationFactor: 0.5
    };

    var client = null;

    function client_session(data,done) {

        should.exist(client);


        function r(t) {
            return Math.ceil(t*100)/100;
        }

        function perform(msg,func,callback) {
            setTimeout(function() {
                if (doDebug) { console.log(msg); }
                var t = getTick();
                func(function(err) {
                    if (doDebug) {
                        if (err) {
                            console.log("   ", msg.red, err.message, r(getTick() - t));
                        } else {
                            console.log("   ", msg.green, r(getTick() - t));
                        }
                    }
                    return callback(err);
                });

            },10);
        }
        function wait(callback) {
            setTimeout(callback,Math.ceil(Math.random()*10+10));
        }

        var the_session;


        async.series([

            //Xx wait,
            // create a session using client1
            perform.bind(null,"create session " + data.index,function(callback) {

                client.createSession(function (err, session) {
                    the_session = session;
                    if (doDebug) {
                        console.log("session.authenticationToken = ",session.authenticationToken.toString("hex"));
                    }
                    callback(err);
                });
            }),

            wait,

            perform.bind(null,"closing session " + data.index,function(callback) {
                the_session.close(function(err) {
                    callback(err);
                });
            }),
        ], done);

    }



    describe("AAAY Testing " + MAXSESSIONS + " sessions on the same  connection ", function () {

        before(function(done){
            var options = {
                connectionStrategy: connectivity_strategy,
                requestedSessionTimeout: 100000
            };
            client = new opcua.OPCUAClient(options);
            var endpointUrl = test.endpointUrl;
            //xx var endpointUrl = "opc.tcp://localhost:12111";
            //xx var endpointUrl =  "opc.tcp://KANARY:26543";
            client.on("send_request",function(req) {
                if(doDebug) { console.log(req.constructor.name); }
            });
            client.on("receive_response",function(res) {
                if(doDebug) { console.log(res.constructor.name,res.responseHeader.serviceResult.toString()); }
            });

            client.on("start_reconnection", function (err) {
                if(doDebug) { console.log("start_reconnection".bgWhite.yellow,data.index);}
            });
            client.on("backoff", function (number, delay) {
                if(doDebug) { console.log("backoff".bgWhite.yellow,number,delay);}
            });

            //xx client.knowsServerEndpoint.should.eql(true);

            client.connect(endpointUrl, function(){
                //xx console.log("AAAA!!!!");
                done();
            });

        });
        after(function(done){

            client.disconnect(function (err) {
                done(err);
            });

        }) ;
        it("QZQ should be possible to open  many sessions on a single connection", function (done) {

            if (test.server) {
                test.server.maxAllowedSessionNumber = MAXSESSIONS;
            }

            var nb = MAXSESSIONS + 10;
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


};
