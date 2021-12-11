"use strict";
const os = require("os");

const async = require("async");
const should = require("should");

const crypto_utils = require("node-opcua-crypto");

const { MessageSecurityMode, SecurityPolicy, OPCUAClient } = require("node-opcua");

const { build_server_with_temperature_device } = require("../../test_helpers/build_server_with_temperature_device");

const userManager = {
    isValidUser: function (userName, password) {
        return userName === "username" && password === "p@ssw0rd";
    }
};

const userManagerAsync = {
    isValidUserAsync: function (userName, password, callback) {
        async.setImmediate(function () {
            const authorized = userName === "username" && password === "p@ssw0rd_@sync";
            callback(null, authorized);
        });
    }
};

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Client-Server with UserName/Password identity token", function () {
    let server, client, endpointUrl;

    const port = 2239;
    before(async () => {
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error

        const options = {
            port,
            allowAnonymous: false
        };

        server = await build_server_with_temperature_device(options);

        // replace user manager with our custom one
        server.userManager = userManager;

        endpointUrl = server.getEndpointUrl();
    });

    beforeEach(function (done) {
        client = null;
        done();
    });

    afterEach(function (done) {
        client = null;
        done();
    });

    after(async () => {
        await server.shutdown();
    });

    function perform_simple_connection(endpointUrl, connectionOption, credentials, done) {
        connectionOption.securityMode = connectionOption.securityMode || MessageSecurityMode.None;
        connectionOption.securityPolicy = connectionOption.securityPolicy || SecurityPolicy.None;
        let the_session;

        client = OPCUAClient.create(connectionOption);

        async.series(
            [
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
            ],
            function (err) {
                if (err && client) {
                    client.disconnect(function () {
                        done(err);
                    });
                } else {
                    done(err);
                }
            }
        );
    }

    it("should not anonymously connect to a server that forbids anonymous connection : anonymous connection", function (done) {
        perform_simple_connection(endpointUrl, {}, {}, function (err) {
            should(err).be.instanceOf(Error);
            err.message.should.match(/Cannot find ANONYMOUS user token policy in end point description/);
            done();
        });
    });

    it("should not connect to a server using username/password authentication and invalid credentials ", function (done) {
        const userName = "username";
        const password = "***invalid password***";
        perform_simple_connection(endpointUrl, {}, { userName: userName, password: password }, function (err) {
            should(err).be.instanceOf(Error);
            err.message.should.match(/BadUserAccessDenied/);
            done();
        });
    });

    it("should connect to a server using username/password authentication and valid credentials - anonymous connection ", function (done) {
        const userName = "username";
        const password = "p@ssw0rd";
        perform_simple_connection(endpointUrl, {}, { userName: userName, password: password }, done);
    });

    it("should fail connect to a server using username/password authentication and invalid credentials - secure connection  - 128 bits", function (done) {
        const userName = "username";
        const password = "***invalid password***";
        const options = {
            securityMode: MessageSecurityMode.Sign,
            securityPolicy: SecurityPolicy.Basic128Rsa15
        };
        perform_simple_connection(endpointUrl, options, { userName: userName, password: password }, function (err) {
            err.message.should.match(/BadUserAccessDenied/);
            done();
        });
    });

    it("should connect to a server using username/password authentication and valid credentials - secure connection  - 128 bits", function (done) {
        const userName = "username";
        const password = "p@ssw0rd";
        const options = {
            securityMode: MessageSecurityMode.Sign,
            securityPolicy: SecurityPolicy.Basic128Rsa15
        };
        perform_simple_connection(endpointUrl, options, { userName: userName, password: password }, done);
    });

    it("should connect to a server using username/password authentication and valid credentials - secure connection - 256 bits ", function (done) {
        const options = {
            securityMode: MessageSecurityMode.Sign,
            securityPolicy: SecurityPolicy.Basic256
        };
        const userIdentity = {
            userName: "username",
            password: "p@ssw0rd"
        };
        perform_simple_connection(endpointUrl, options, userIdentity, done);
    });

    it("#158 should connect to a server using LOCALHOST url & username/password authentication and valid credentials - secure connection  - 128 bits", function (done) {
        const userName = "username";
        const password = "p@ssw0rd";
        const options = {
            endpointMustExist: false,
            securityMode: MessageSecurityMode.Sign,
            securityPolicy: SecurityPolicy.Basic128Rsa15
        };
        const endpointUrl_truncated = "opc.tcp://" + os.hostname() + ":" + port.toString();

        perform_simple_connection(endpointUrl_truncated, options, { userName: userName, password: password }, done);
    });

    it("should connect to a server using asynchronous username/password authentication and valid credentials - secure connection - 256 bits ", function (done) {
        server.userManager = userManagerAsync; //use asynchronous checks

        const options = {
            securityMode: MessageSecurityMode.Sign,
            securityPolicy: SecurityPolicy.Basic256
        };
        const userIdentity = {
            userName: "username",
            password: "p@ssw0rd_@sync"
        };
        perform_simple_connection(endpointUrl, options, userIdentity, done);
    });
});
