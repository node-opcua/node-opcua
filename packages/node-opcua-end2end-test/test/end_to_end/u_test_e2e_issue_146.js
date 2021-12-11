"use strict";

const async = require("async");
const should = require("should");

const {OPCUAClient} = require("node-opcua");

const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");


module.exports = function(test) {


    describe("Testing bug #146 - reopenning Anonymous Session with Username password", function() {

        it("should reopen a Anonymous Session with UserName password ", function(done) {

            const client1 = OPCUAClient.create();
            const endpointUrl = test.endpointUrl;

            let the_session;
            async.series([

                function(callback) {
                    client1.connect(endpointUrl, callback);
                },

                // create a session using client1
                function(callback) {
                    console.log("    create a session as a anonymous use");
                    client1.createSession(function(err, session) {
                        if (err) {
                            return callback(err);
                        }
                        the_session = session;
                        callback();
                    });
                },

                // change user
                function(callback) {

                    console.log("    impersonate user user2 on existing session");
                    const userIdentity = { userName: "user2", password: "password2" };

                    client1.changeSessionIdentity(the_session, userIdentity, function(err) {
                        if (err) {
                            return callback(err);
                        }
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