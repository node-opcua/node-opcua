require("requirish")._(module);

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

var crypto_utils = require("lib/misc/crypto_utils");
if (!crypto_utils.isFullySupported()) {
    console.log(" SKIPPING TESTS ON SECURE CONNECTION because crypto, please check your installation".red.bold);
} else {

    describe("testing basic Client-Server communication", function () {

        var server, client, temperatureVariableId, endpointUrl;

        before(function (done) {
            resourceLeakDetector.start();
            server = build_server_with_temperature_device({port: port}, function (err) {
                endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
                temperatureVariableId = server.temperatureVariableId;
                done(err);
            });
        });

        beforeEach(function (done) {
            client = new OPCUAClient();
            done();
        });

        afterEach(function (done) {

            done();
        });

        after(function (done) {
            server.shutdown(function (err) {
                resourceLeakDetector.stop();
                done(err);
            });
        });


        it("C1 - testing with username ==null ", function (done) {

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
                    client1.createSession(options, function (err) {
                        console.log(err.message);
                        err.message.should.match(/BadIdentityTokenInvalid/);
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
