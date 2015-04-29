require("requirish")._(module);
var assert = require("better-assert");
var async = require("async");
var should = require("should");

var opcua = require("index");

var OPCUAClient = opcua.OPCUAClient;
var SecurityPolicy = opcua.SecurityPolicy;
var MessageSecurityMode = opcua.MessageSecurityMode;

var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;


var session_service = require("lib/services/session_service");
var UserNameIdentityToken = session_service.UserNameIdentityToken;

var userManager = {

        isValidUser: function(userName,password) {
            return  ( userName === "username" && password === "p@ssw0rd" );
        }
    };

var crypto_utils = require("lib/misc/crypto_utils");
if (!crypto_utils.isFullySupported()) {
    console.log(" SKIPPING TESTS ON SECURE CONNECTION because crypto, please check your installation".red.bold);
} else {

    describe("testing Client-Server with UserName/Password identity token", function () {
        var server, client, temperatureVariableId, endpointUrl;

        var port = 2001;
        before(function (done) {
            // we use a different port for each tests to make sure that there is
            // no left over in the tcp pipe that could generate an error
            port += 1;

            var options = {
                port: port,
                allowAnonymous: false,
                userManager: userManager
            }
            server = build_server_with_temperature_device(options, function (err) {
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
            client = null;
            done();
        });

        after(function (done) {
            server.shutdown(done);
        });

        function perform_simple_connection(credentials, done) {

            var the_session;

            async.series([

                // connect
                function (callback) {
                    client.connect(endpointUrl, callback);
                },

                // create session
                function (callback) {

                    client.createSession(credentials, function (err, session) {
                        if (!err) {
                            the_session = session;
                        }
                        callback(err);
                    });
                },

                // closing session
                function (callback) {
                    the_session.close(function (err) {
                        callback(err);
                    });
                },

                // disconnect
                function (callback) {
                    client.disconnect(function () {
                        callback();
                    });
                }

            ], done);
        }

        it("should not anonymously connect to a server that forbids anonymous connection", function (done) {

            perform_simple_connection({}, function (err) {
                should(err).be.instanceOf(Error);
                done();
            });
        });

        it("should not connect to a server using username/password authentication and invalid credentials ", function (done) {

            var userName = "username";
            var password = "***invalid password***";
            perform_simple_connection({userName: userName, password: password}, function (err) {
                should(err).be.instanceOf(Error);
                done();
            });


        });

        it("should connect to a server using username/password authentication and valid credentials ", function (done) {

            var userName = "username";
            var password = "p@ssw0rd";

            perform_simple_connection({userName: userName, password: password}, done);


        });

    });
}
