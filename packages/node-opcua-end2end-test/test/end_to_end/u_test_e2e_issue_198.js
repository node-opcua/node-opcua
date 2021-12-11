"use strict";

"use strict";
const async = require("async");
const should = require("should");
const { OPCUAClient } = require("node-opcua");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function(test) {


    describe("Testing server when client sessionName  is not defined   #198", function() {

        // as a server,
        // I need to receive an event when a new connection is established

        it("#198 Server should handle client createSession without complaining if client's provided sessionName is null or undefined", function(done) {

            const server = test.server;
            let the_session;
            if (!server) { return done(); }


            const client1 = OPCUAClient.create();
            const endpointUrl = test.endpointUrl;

            // Hijack internal method _nextSessionName to return null !
            client1._nextSessionName = function() {
                return null;
            };

            async.series([

                function(callback) {
                    client1.connect(endpointUrl, callback);
                },

                // create a session using client1
                function(callback) {
                    client1.createSession(function(err, session) {
                        if (err) {
                            return callback(err);
                        }
                        the_session = session;
                        callback();
                    });
                },
                function(callback) {
                    the_session.close(callback);
                },

                function(callback) {
                    client1.disconnect(function() {
                        //xx console.log(" Client disconnected ", (err ? err.message : "null"));

                        callback();
                    });
                }, function(callback) {

                    callback();
                }
            ], done);

        })
            ;

    });

};
