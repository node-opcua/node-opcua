const should = require("should");
const assert = require("node-opcua-assert");
const async = require("async");
const util = require("util");
const _ = require("underscore");

const opcua = require("node-opcua");

const OPCUAClient = opcua.OPCUAClient;

module.exports = function (test) {

    describe("testing basic Client-Server communication", function () {

        let server, client, endpointUrl;
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

            let client1;
            async.series([

                function (callback) {
                    client1 = new OPCUAClient();
                    client1.connect(endpointUrl, callback);
                },

                function (callback) {
                    // todo
                    const options = {
                        userName: "",
                        password: "blah"
                    };
                    client1.createSession(options, function (err, session) {
                        console.log(err.message);
                        the_session = session;
                        err.message.should.match(/BadIdentityTokenInvalid/);
                        callback();
                    });
                },
                function (callback) {
                    the_session.close(function (err) {
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
};