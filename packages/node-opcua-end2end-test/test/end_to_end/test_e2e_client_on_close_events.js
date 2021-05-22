"use strict";

const should = require("should");
const async = require("async");
const sinon = require("sinon");

const { OPCUAClient, OPCUAServer, get_empty_nodeset_filename} = require("node-opcua");

const empty_nodeset_filename = get_empty_nodeset_filename();

const { make_debugLog, checkDebugFlag } = require("node-opcua-debug");
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Client-Server - Event", function() {

    this.timeout(Math.max(600000, this.timeout()));

    const port = 2013;
    let server;
    let endpointUrl;

    function start_server(done) {
        server = new OPCUAServer({
            port,
            nodeset_filename: empty_nodeset_filename,
            maxAllowedSessionNumber: 10
        });

        server.start(function() {
            endpointUrl = server.getEndpointUrl();
            done();
        });
    }

    function end_server(done) {
        if (server) {
            server.shutdown(function() {
                server = null;
                done();
            });
        } else {
            done();
        }
    }


    it("TSC-1 should raise a close event once on normal disconnection", function(done) {

        let close_counter = 0;

        const client = OPCUAClient.create();
        client.on("close", function(err) {
            /*
                        console.log(err);
                        console.log(new Error("Here I am"));
            */
            should.not.exist(err, "No error shall be transmitted when client initiates the disconnection");
            close_counter++;
        });

        async.series([

            function(callback) {
                debugLog(" --> Starting server");
                start_server(callback);
            },
            function(callback) {
                debugLog(" --> Connecting Client");
                client.connect(endpointUrl, callback);
            },
            function(callback) {
                close_counter.should.eql(0);
                debugLog(" --> Disconnecting Client");
                client.disconnect(callback);
            },
            function(callback) {
                close_counter.should.eql(1);
                callback(null);
            },
            function(callback) {
                debugLog(" --> Stopping server");
                end_server(callback);
            }
        ], done);


    });
    it("TSC-2 client (not reconnecting) should raise a close event with an error when server initiates disconnection", function(done) {

        // note : client is not trying to reconnect
        const options = {
            connectionStrategy: {
                maxRetry: 0,  // <= no retry
                initialDelay: 10,
                maxDelay: 20,
                randomisationFactor: 0
            }
        };
        const client = OPCUAClient.create(options);


        const _client_received_close_event = sinon.spy();
        client.on("close", _client_received_close_event);

        async.series([
            function(callback) {
                debugLog(" --> Starting server");
                start_server(callback);
            },
            function(callback) {
                debugLog(" --> Connecting Client");
                client.connect(endpointUrl, callback);
            },
            function(callback) {

                _client_received_close_event.callCount.should.eql(0);

                debugLog(" --> Stopping server");
                end_server(function() {
                    callback();
                });
            },

            // wait a little bit , to relax client
            function(callback) {
                setTimeout(callback, 100);
            },

            function(callback) {
                _client_received_close_event.callCount.should.eql(1);
                _client_received_close_event.getCall(0).args[0].message.should.match(/disconnected by third party/);
                callback();
            },
            function(callback) {
                client.disconnect(callback);
            }

        ], done);
    });

    it("TSC-3 client (reconnecting)  should raise a close event with an error when server initiates disconnection (after reconnecting has failed)", function(done) {

        // note : client will  try to reconnect and eventually fail ...
        const options = {
            connectionStrategy: {
                initialDelay: 10,
                maxDelay: 20,
                maxRetry: 1,  // <= RETRY
                randomisationFactor: 0
            }
        };
        const client = OPCUAClient.create(options);


        const _client_received_close_event = sinon.spy();
        client.on("close", _client_received_close_event);

        const _client_backoff_event = sinon.spy();
        client.on("backoff", _client_backoff_event);
        client.on("backoff", () => {
            debugLog("client attempt to connect");
        });

        async.series([
            function(callback) {
                debugLog(" 1--> Starting server");
                start_server(callback);
            },
            function(callback) {
                debugLog(" 2--> Connecting Client");
                client.connect(endpointUrl, callback);
            },
            function(callback) {

                _client_received_close_event.callCount.should.eql(0);

                client.once("connection_lost", function() {

                    debugLog(" 4 or 5--> client has detected that server has shutdown abruptly");
                    debugLog("           and will try to reconnect");

                    setTimeout(() => {
                        debugLog(" 6--> disconnecting client (while reconnecting)");
                        client.disconnect(() => {
                            debugLog(" 8 --> client has been disconnected");
                            callback();
                        });
                    }, 5000); // let's give client some time to attempt a reconnection
                });
                client.on("close", function(err) {
                    debugLog(" 8 --> client has sent 'close' event", err ? err.message : null);
                    //xx should.exist(err);
                });

                debugLog(" 3--> Stopping server");
                end_server(function() {
                    debugLog(" 4 or 5 --> Server stopped");
                });
            },


            function(callback) {
                _client_backoff_event.callCount.should.be.greaterThan(0);
                _client_received_close_event.callCount.should.eql(1);
                should.exist(_client_received_close_event.getCall(0).args[0]);
                _client_received_close_event.getCall(0).args[0].message.should.match(/Reconnection has been canceled/);
                callback();
            }

        ], done);
    });

});
