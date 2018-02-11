/*global describe, it, require*/
var async = require("async");
var should = require("should");
var opcua = require("node-opcua");
var OPCUAClient = opcua.OPCUAClient;

module.exports = function (test) {

    describe("Testing bug #433 - Server should accept ActivateSessionRequest with userIdentityToken set to null ", function () {

        it("test",function(done) {


            var client1 = new OPCUAClient({});
            var endpointUrl = test.endpointUrl;

            var the_session;

            async.series([

                function (callback) {
                    client1.connect(endpointUrl, callback);
                },

                // create a session using client1
                function (callback) {
                    var userIdentityInfo = null;
                    client1.createSession(userIdentityInfo,function (err, session) {
                        if (err) {
                            return callback(err);
                        }
                        the_session = session;
                        callback();
                    });
                },

                function (callback) {
                    the_session.close(callback);
                }

            ], function final(err) {
                client1.disconnect(function () {
                    done(err);
                });
            });

        });

    });

};

