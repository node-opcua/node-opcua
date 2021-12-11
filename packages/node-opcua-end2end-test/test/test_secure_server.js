"use strict";
const should = require("should");
const async = require("async");

const opcua = require("node-opcua");
const OPCUAServer = opcua.OPCUAServer;
const OPCUAClient = opcua.OPCUAClient;
const SecurityPolicy = opcua.SecurityPolicy;
const MessageSecurityMode = opcua.MessageSecurityMode;

const empty_nodeset_filename = opcua.get_empty_nodeset_filename();
/*
Discovery Endpoints shall not require any message security, but it may require transport layer
security. In production systems, Administrators may disable discovery for security reasons and
Clients shall rely on cached EndpointDescriptions. To provide support for systems with disabled
Discovery Services Clients shall allow Administrators to manually update the EndpointDescriptions
used to connect to a Server. Servers shall allow Administrators to disable the Discovery Endpoint.

Release 1.03 10 OPC Unified Architecture, Part 4
A Client shall be careful when using the information returned from a Discovery Endpoint since it
has no security. A Client does this by comparing the information returned from the Discovery
Endpoint to the information returned in the CreateSession response. A Client shall verify that:
a) The ApplicationUri specified in the Server Certificate is the same as the ApplicationUri
provided in the EndpointDescription.
b) The Server Certificate returned in CreateSession response is the same as the Certificate used
to create the SecureChannel.
c) The EndpointDescriptions returned from the Discovery Endpoint are the same as the
EndpointDescriptions returned in the CreateSession response.
If the Client detects that one of the above requirements is not fulfilled, then the Client shall close
the SecureChannel and report an error.

 */
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
const { createServerCertificateManager } = require("../test_helpers/createServerCertificateManager");
describe("testing behavior of secure Server ( server that only accept Sign or SignAndEncrypt channel", function () {
    let server, client;
    let endpointUrl;

    this.timeout(Math.max(20000, this.timeout()));

    const port = 2241;
    before(async () => {
        const serverCertificateManager = await createServerCertificateManager(port);
        server = new OPCUAServer({
            port,
            serverCertificateManager,
            nodeset_filename: empty_nodeset_filename,
            securityPolicies: [SecurityPolicy.Basic256],
            securityModes: [MessageSecurityMode.SignAndEncrypt],
            disableDiscovery: false
        });

        await server.start();
        endpointUrl = server.getEndpointUrl();
    });

    after(async () => {
        await server.shutdown();
    });

    it("it should not be possible to create a session on a secure server using a unsecure channel", function (done) {
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
                    client._serverEndpoints.length.should.eql(1);

                    // server has given us only its valid endpoint that the client will check before
                    // establishing a session. Let's inject a fake unsecure endpoint so we can
                    // skip the internal client test for invalid endpoint and get to the server

                    const unsecureEndpoint = new opcua.EndpointDescription(client._serverEndpoints[0]);
                    unsecureEndpoint.securityMode = MessageSecurityMode.None;
                    unsecureEndpoint.securityPolicyUri = SecurityPolicy.None;

                    client._serverEndpoints.push(unsecureEndpoint);

                    client.createSession(function (err, session) {
                        if (!err) {
                            return callback(
                                new Error("Should expect an error here and no session ! session id = " + session.sessionId)
                            );
                        }
                        err.message.should.match(/BadSecurityModeRejected/);
                        callback();
                    });
                },

                // assert that server has 0 sessions
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
    });

    it("it should be possible to get endpoint of a secure channel using a unsecure channel", function (done) {
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
                    client.getEndpoints(function (err, endpoints) {
                        if (!err) {
                            //xx console.log(endpoints);
                            endpoints.length.should.eql(1);
                            endpoints[0].securityMode.should.eql(MessageSecurityMode.SignAndEncrypt);
                            endpoints[0].securityPolicyUri.should.eql(SecurityPolicy.Basic256);
                        }
                        callback(err);
                    });
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
    });
});

xdescribe("It should be possible to create server with disabled discovery service", function () {
    // in this case client shall be given valid end point , manually !
    // to do ...
});
