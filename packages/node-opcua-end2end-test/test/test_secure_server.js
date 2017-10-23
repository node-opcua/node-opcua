"use strict";
var should = require("should");
var async = require("async");

var opcua = require("node-opcua");
var OPCUAServer = opcua.OPCUAServer;
var OPCUAClient = opcua.OPCUAClient;
var SecurityPolicy = opcua.SecurityPolicy;
var MessageSecurityMode = opcua.MessageSecurityMode;

var empty_nodeset_filename = opcua.empty_nodeset_filename;
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
var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing behavior of secure Server ( server that only accept SIGN or SIGNANDENCRYPT channel", function () {
    var server, client;
    var endpointUrl;

    this.timeout(Math.max(20000, this._timeout));

    before(function (done) {

        server = new OPCUAServer({
            port: 2000,
            nodeset_filename: empty_nodeset_filename,
            securityPolicies: [
                SecurityPolicy.Basic256
            ],
            securityModes: [
                MessageSecurityMode.SIGNANDENCRYPT
            ]
        });

        endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        server.start(done);
    });

    after(function (done) {
        server.shutdown(done);
    });

    it("it should not be possible to create a session on a secure server using a unsecure channel", function (done) {

        // ask for a very short session timeout
        client = new OPCUAClient({requestedSessionTimeout: 200});

        var the_session;

        async.series([
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

                // server has given us only its valid endpoint that the client will check before
                // establishing a session. Let's inject a fake unsecure endpoint so we can
                // skip the internal client test for invalid endpoint and get to the server

                var unsecure_endpoint = new opcua.EndpointDescription(client._server_endpoints[0]);
                unsecure_endpoint.securityMode = MessageSecurityMode.NONE;
                unsecure_endpoint.securityPolicyUri = SecurityPolicy.None.value;
                client._server_endpoints.push(unsecure_endpoint);


                client.createSession(function (err, session) {

                    if (!err) {
                        return callback(new Error("Should expect an error here and no session ! session id = " + session.sessionId));
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
        ], done);

    });

    it("it should be possible to get endpoint of a secure channel using a unsecure channel", function (done) {

        // ask for a very short session timeout
        client = new OPCUAClient({requestedSessionTimeout: 200});

        var the_session;

        async.series([
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
                client.getEndpointsRequest(function (err, endpoints) {
                    if (!err) {
                        //xx console.log(endpoints);
                        endpoints.length.should.eql(1);
                        endpoints[0].securityMode.should.eql(MessageSecurityMode.SIGNANDENCRYPT);
                        endpoints[0].securityPolicyUri.should.eql(SecurityPolicy.Basic256.value);
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

        ], done);
    });

});

xdescribe("It should be possible to create server with disabled discovery service", function () {

    // in this case client shall be given valid end point , manually !
    // to do ...
});

