"use strict";
const should = require("should");
const async = require("async");

const { OPCUAServer } = require("node-opcua-server");
const { OPCUAClient } = require("node-opcua-client");

const { get_empty_nodeset_filename, is_valid_endpointUrl } = require("node-opcua");

const { make_debugLog, checkDebugFlag } = require("node-opcua-debug");
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const empty_nodeset_filename = get_empty_nodeset_filename();

const { createServerCertificateManager } = require("../test_helpers/createServerCertificateManager");

const { ServerSideUnimplementedRequest } = require("../test_helpers/unimplementedRequest");

const port = 1990;

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Server resilience to unsupported request", function () {
    let server, client;
    let endpointUrl, g_session;

    this.timeout(Math.max(20000, this.timeout()));

    before(async () => {
        const serverCertificateManager = await createServerCertificateManager(port);

        server = new OPCUAServer({ port, serverCertificateManager, nodeset_filename: empty_nodeset_filename });

        client = OPCUAClient.create();

        await server.start();

        // we will connect to first server end point
        endpointUrl = server.getEndpointUrl();
        debugLog("endpointUrl", endpointUrl);
        is_valid_endpointUrl(endpointUrl).should.equal(true);

        await client.connect(endpointUrl);
        g_session = await client.createSession();
    });

    after(async () => {
        await client.disconnect();
        await server.shutdown();
    });

    it("server should return a ServiceFault if receiving a unsupported MessageType", function (done) {
        const bad_request = new ServerSideUnimplementedRequest(); // intentionally send a bad request

        g_session.performMessageTransaction(bad_request, function (err, response) {
            err.should.be.instanceOf(Error);
            done();
        });
    });
});

function abrupty_disconnect_client(client, callback) {
    client._secureChannel._transport.disconnect(callback);
}

describe("testing Server resilience with bad internet connection", function () {
    let server, client;
    let endpointUrl;

    this.timeout(Math.max(20000, this.timeout()));

    before(async () => {
        const serverCertificateManager = await createServerCertificateManager(port);
        server = new OPCUAServer({ port, serverCertificateManager, nodeset_filename: empty_nodeset_filename });
        await server.start();

        endpointUrl = server.getEndpointUrl();
    });

    after(async () => {
        await server.shutdown();
    });

    it("server should discard session from abruptly disconnected client after the timeout has expired", function (done) {
        // ask for a very short session timeout
        client = OPCUAClient.create({ requestedSessionTimeout: 200 });

        let the_session;

        async.series(
            [
                // assert that server has 0 session
                function (callback) {
                    server.currentSessionCount.should.eql(0);
                    callback();
                },

                // connect
                function (callback) {
                    client.connect(endpointUrl, function (err) {
                        callback(err);
                    });
                },

                // create session
                function (callback) {
                    client.createSession(function (err, session) {
                        if (!err) {
                            the_session = session;
                            the_session.timeout.should.eql(client.requestedSessionTimeout);
                        }
                        callback(err);
                    });
                },

                // assert that server has 1 sessions
                function (callback) {
                    server.currentSessionCount.should.eql(1);
                    callback();
                },

                function (callback) {
                    abrupty_disconnect_client(client, callback);
                },

                // assert that server has 1 sessions
                function (callback) {
                    server.currentSessionCount.should.eql(1);
                    callback();
                },

                // wait for time out
                function (callback) {
                    setTimeout(callback, 4000);
                },

                // assert that server has no more session
                function (callback) {
                    server.currentSessionCount.should.eql(0);
                    callback();
                },
                function (callback) {
                    client.disconnect(callback);
                }
            ],
            done
        );
        // client.disconnect(function(){
    });
});
