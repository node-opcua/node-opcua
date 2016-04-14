/*global describe, it, require*/
require("requirish")._(module);
var assert = require("better-assert");
var async = require("async");
var should = require("should");
var sinon = require("sinon");
var opcua = require("index");

var OPCUAClient = opcua.OPCUAClient;
var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;


module.exports = function (test) {


    describe("Testing enhancement request #192 ", function () {

        // as a server,
        // I need to receive an event when a new connection is established

        it("#191 Server should receive an 'newChannel' event when a new channel is established and a 'closeChannel' when it close", function (done) {

            var server = test.server;

            var spy_new_channel = sinon.spy(function(channel) {
                //xx console.log("Client connected with address = ".bgYellow,channel.remoteAddress," port = ",channel.remotePort);
                channel.remoteAddress.should.be.instanceof(String);
                channel.remotePort.should.be.instanceof(Number);

            });
            var spy_close_channel = sinon.spy(function(channel){
                //xx console.log("Client disconnected with address = ".bgCyan,channel.remoteAddress," port = ",channel.remotePort);
                channel.remoteAddress.should.be.instanceof(String);
                channel.remotePort.should.be.instanceof(Number);

            });

            server.on("newChannel",spy_new_channel);
            server.on("closeChannel",spy_close_channel);

            if (!server) { return done(); }

            var client1 = new OPCUAClient();
            var endpointUrl = test.endpointUrl;


            async.series([

                function (callback) {
                    client1.connect(endpointUrl, callback);
                },
                function (callback) {
                    client1.disconnect(function () {
                        //xx console.log(" Client disconnected ", (err ? err.message : "null"));

                        callback();
                    });
                },function(callback) {
                    server.removeListener("newChannel",spy_new_channel);
                    server.removeListener("closeChannel",spy_close_channel);

                    spy_new_channel.callCount.should.eql(1);
                    spy_close_channel.callCount.should.eql(1);

                    callback();
                }
            ], done);

        })
        ;

    });

};





