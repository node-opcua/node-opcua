

var should = require("should");
var assert = require("node-opcua-assert");
var async = require("async");
var util = require("util");
var _ = require("underscore");

var opcua = require("node-opcua");

var OPCUAClient = opcua.OPCUAClient;

module.exports = function (test) {

    var crypto_utils = require("node-opcua-crypto").crypto_utils;
    if (!crypto_utils.isFullySupported()) {
        console.log(" SKIPPING TESTS ON SECURE CONNECTION because crypto, please check your installation".red.bold);
    } else {


        describe("testing basic Client-Server communication", function () {

            var server, client, endpointUrl;
            beforeEach(function (done) {
                client = new OPCUAClient();
                server = test.server;
                endpointUrl = test.endpointUrl;
                done();
            });

            afterEach(function (done) {
                done();
            });

            it("C1 - testing with username === null ", function (done) {

                var client1;
                async.series([

                    function (callback) {
                        client1 = new OPCUAClient();
                        client1.connect(endpointUrl, callback);
                    },

                    function (callback) {
                        // todo
                        var options = {
                            userName: "",
                            password: "blah"
                        };
                        client1.createSession(options, function (err,session) {
                            console.log(err.message);
                            the_session = session;
                            err.message.should.match(/BadIdentityTokenInvalid/);
                            callback();
                        });
                    },
                    function (callback) {
                        the_session.close(function(err){
                            err.message.should.match(/BadSessionNotActivated/);
                            callback();
                        });
                    },
                    function (callback) {
                        client1.disconnect(callback);
                    }
                ], done);
            });

        });
    }
};