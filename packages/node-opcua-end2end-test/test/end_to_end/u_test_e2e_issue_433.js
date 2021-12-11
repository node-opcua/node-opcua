"use strict";

const async = require("async");
const should = require("should");
const opcua = require("node-opcua");
const OPCUAClient = opcua.OPCUAClient;

module.exports = function(test) {

    describe("Testing bug #433 - Server should accept ActivateSessionRequest with userIdentityToken set to null ", function() {

        it("test", function(done) {


            const client1 = OPCUAClient.create({});
            const endpointUrl = test.endpointUrl;

            let the_session;

            async.series([

                function(callback) {
                    client1.connect(endpointUrl, callback);
                },

                // create a session using client1
                function(callback) {
                    const userIdentityInfo = null;
                    client1.createSession(userIdentityInfo, function(err, session) {
                        if (err) {
                            return callback(err);
                        }
                        the_session = session;
                        callback();
                    });
                },

                function(callback) {
                    the_session.close(callback);
                }

            ], function final(err) {
                client1.disconnect(function() {
                    done(err);
                });
            });

        });

    });

};

