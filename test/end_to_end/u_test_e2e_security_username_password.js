require("requirish")._(module);

import crypto_utils from "lib/misc/crypto_utils";
    
var should = require("should");
var assert = require("better-assert");
var async = require("async");
var util = require("util");
var _ = require("underscore");

var opcua = require("index");

var OPCUAClient = opcua.OPCUAClient;
var StatusCodes = opcua.StatusCodes;
var Variant = opcua.Variant;
var DataType = opcua.DataType;
var DataValue = opcua.DataValue;

var BrowseDirection = opcua.browse_service.BrowseDirection;
var debugLog = opcua.utils.make_debugLog(__filename);


var port = 2000;

var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;

module.exports = function (test) {

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
                var the_session;
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