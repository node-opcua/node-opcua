/*global describe, it, require*/
require("requirish")._(module);
var assert = require("better-assert");
var async = require("async");
var should = require("should");

var opcua = require("index");

var OPCUAClient = opcua.OPCUAClient;



module.exports = function (test) {

    describe("Testing issue  #231 -  Server should accept client with protocolVersion greater than the protocolVersion it supports", function () {


        it("#231-A ", function (done) {

            var client1 = new OPCUAClient();

            client1.protocolVersion.should.eql(0);
            client1.protocolVersion = 0x1000;

            var endpointUrl = test.endpointUrl;

            async.series([

                function (callback) {
                    client1.connect(endpointUrl, callback);
                },

                function (callback) {
                    client1.disconnect(function () {
                        callback();
                    });
                }
            ], done);

        });
        it("#231-B BadProtocolVersionUnsupported", function (done) {

            var client1 = new OPCUAClient();

            client1.protocolVersion.should.eql(0);


            // special version number that causes our server to simulate BadProtocolVersionUnsupported
            client1.protocolVersion = 0xDEADBEEF;

            var endpointUrl = test.endpointUrl;

            async.series([

                function (callback) {
                    client1.connect(endpointUrl, function(err){

                        err.message.should.match(/BadProtocolVersionUnsupported/);
                        callback();
                    });
                },

                function (callback) {
                    client1.disconnect(function () {
                        callback();
                    });
                }
            ], done);

        });
    });
};
