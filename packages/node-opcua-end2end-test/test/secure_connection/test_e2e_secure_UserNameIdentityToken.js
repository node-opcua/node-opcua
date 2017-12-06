"use strict";
var async = require("async");
var should = require("should");
var opcua = require("node-opcua");

var OPCUAClient = opcua.OPCUAClient;

var build_server_with_temperature_device = require("../../test_helpers/build_server_with_temperature_device").build_server_with_temperature_device;


var userManager = {

    isValidUser: function (userName, password) {
        return ( userName === "username" && password === "p@ssw0rd" );
    }
};

var userManagerAsync = {

    isValidUserAsync: function (userName, password, callback) {
        async.setImmediate(function () {
            var authorized = ( userName === "username" && password === "p@ssw0rd_@sync" );
            callback(null, authorized);
        });
    }
};


var crypto_utils = require("node-opcua-crypto").crypto_utils;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Client-Server with UserName/Password identity token", function () {

    var server, client, endpointUrl;

    var port = 2002;
    before(function (done) {
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error
        port += 1;

        var options = {
            port: port,
            allowAnonymous: false
        };

        server = build_server_with_temperature_device(options, function (err) {

            // replace user manager with our custom one
            server.userManager = userManager;

            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;

            done(err);
        });
    });

    beforeEach(function (done) {
        client = null;
        done();
    });

    afterEach(function (done) {
        client = null;
        done();
    });

    after(function (done) {
        server.shutdown(done);
    });

    function perform_simple_connection(endpointUrl, connectionOption, credentials, done) {

        connectionOption.securityMode = connectionOption.securityMode || opcua.MessageSecurityMode.NONE;
        connectionOption.securityPolicy = connectionOption.securityPolicy || opcua.SecurityPolicy.None;
        var the_session;

        client = new OPCUAClient(connectionOption);

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
                    client = null;
                    callback();
                });
            }

        ], function (err) {
            if (err && client) {
                client.disconnect(function() {
                    done(err);
                });
            } else {
                done(err);
            }
        });
    }

    it("should not anonymously connect to a server that forbids anonymous connection : anonymous connection", function (done) {

        perform_simple_connection(endpointUrl, {}, {}, function (err) {
            should(err).be.instanceOf(Error);
            err.message.should.match(/Cannot find ANONYMOUS user token policy in end point description/);
            done();
        });

    });

    it("should not connect to a server using username/password authentication and invalid credentials ", function (done) {

        var userName = "username";
        var password = "***invalid password***";
        perform_simple_connection(endpointUrl, {}, {userName: userName, password: password}, function (err) {
            should(err).be.instanceOf(Error);
            err.message.should.match(/BadUserAccessDenied/);
            done();
        });


    });

    it("should connect to a server using username/password authentication and valid credentials - anonymous connection ", function (done) {

        var userName = "username";
        var password = "p@ssw0rd";
        perform_simple_connection(endpointUrl, {}, {userName: userName, password: password}, done);

    });


    it("should fail connect to a server using username/password authentication and invalid credentials - secure connection  - 128 bits", function (done) {

        var userName = "username";
        var password = "***invalid password***";
        var options = {
            securityMode: opcua.MessageSecurityMode.SIGN,
            securityPolicy: opcua.SecurityPolicy.Basic128Rsa15,
        };
        perform_simple_connection(endpointUrl, options, {userName: userName, password: password}, function (err) {
            err.message.should.match(/BadUserAccessDenied/);
            done();
        });

    });

    it("should connect to a server using username/password authentication and valid credentials - secure connection  - 128 bits", function (done) {

        var userName = "username";
        var password = "p@ssw0rd";
        var options = {
            securityMode: opcua.MessageSecurityMode.SIGN,
            securityPolicy: opcua.SecurityPolicy.Basic128Rsa15
        };
        perform_simple_connection(endpointUrl, options, {userName: userName, password: password}, done);

    });


    it("should connect to a server using username/password authentication and valid credentials - secure connection - 256 bits ", function (done) {

        var options = {
            securityMode: opcua.MessageSecurityMode.SIGN,
            securityPolicy: opcua.SecurityPolicy.Basic256,
        };
        var userIdentity = {
            userName: "username",
            password: "p@ssw0rd"
        };
        perform_simple_connection(endpointUrl, options, userIdentity, done);

    });

    it("#158 should connect to a server using LOCALHOST url & username/password authentication and valid credentials - secure connection  - 128 bits", function (done) {

        var userName = "username";
        var password = "p@ssw0rd";
        var options = {
            securityMode: opcua.MessageSecurityMode.SIGN,
            securityPolicy: opcua.SecurityPolicy.Basic128Rsa15
        };
        var endpointUrl_truncated = "opc.tcp://localhost:" + port.toString();

        perform_simple_connection(endpointUrl_truncated, options, {userName: userName, password: password}, done);

    });

    it("should connect to a server using asynchronous username/password authentication and valid credentials - secure connection - 256 bits ", function (done) {

        server.userManager = userManagerAsync;  //use asynchronous checks

        var options = {
            securityMode: opcua.MessageSecurityMode.SIGN,
            securityPolicy: opcua.SecurityPolicy.Basic256
        };
        var userIdentity = {
            userName: "username",
            password: "p@ssw0rd_@sync"
        };
        perform_simple_connection(endpointUrl, options, userIdentity, done);

    });

});
