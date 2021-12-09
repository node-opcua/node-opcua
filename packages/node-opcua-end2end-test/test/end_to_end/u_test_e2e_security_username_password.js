const should = require("should");
const async = require("async");
const opcua = require("node-opcua");

const OPCUAClient = opcua.OPCUAClient;

module.exports = function(test) {

    describe("testing basic Client-Server communication", function() {
        let server, client, endpointUrl;
        beforeEach(function(done) {
            client = OPCUAClient.create();
            server = test.server;
            endpointUrl = test.endpointUrl;
            done();
        });

        afterEach(function(done) {
            done();
        });

        it("C1 - testing with username === null ", function(done) {
            let client1;
            let the_session;
            async.series(
                [
                    function(callback) {
                        client1 = OPCUAClient.create();
                        client1.connect(endpointUrl, callback);
                    },

                    function(callback) {
                        // todo
                        const options = {
                            userName: "",
                            password: "blah"
                        };
                        client1.createSession(options, function(err, session) {
                            should.exist(err);
                            console.log(err.message);
                            the_session = session;
                            err.message.should.match(/BadIdentityTokenInvalid/);
                            callback();
                        });
                    },
                    function(callback) {
                        if (the_session) {
                            the_session.close(function(err) {
                                err.message.should.match(/BadSessionNotActivated/);
                                callback();
                            });
                        } else {
                            callback();
                        }
                    },
                    function(callback) {
                        client1.disconnect(callback);
                    }
                ],
                done
            );
        });
    });
};
