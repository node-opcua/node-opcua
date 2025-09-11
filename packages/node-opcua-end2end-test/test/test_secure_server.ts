import should from "should";

import {
    EndpointDescription,
    OPCUAServer,
    OPCUAClient,
    SecurityPolicy,
    MessageSecurityMode,
    get_empty_nodeset_filename
} from "node-opcua";

import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { createServerCertificateManager } from "../test_helpers/createServerCertificateManager";
import { assertThrow } from "../test_helpers/assert_throw";

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
describe("testing behavior of secure Server ( server that only accept Sign or SignAndEncrypt channel", function (this: Mocha.Runnable) {
    let server: OPCUAServer;
    let client: OPCUAClient;
    let endpointUrl: string;

    this.timeout(Math.max(20000, this.timeout()));

    const empty_nodeset_filename = get_empty_nodeset_filename();
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

    it("it should not be possible to create a session on a secure server using a unsecure channel", async () => {
        // ask for a very short session timeout
        client = OPCUAClient.create({ requestedSessionTimeout: 200 });

        // assert that server has 0 session
        server.currentSessionCount.should.eql(0);
        // connect
        await client.connect(endpointUrl);

        try {
            (client as any)._serverEndpoints.length.should.eql(1);
            // create session


            // server has given us only its valid endpoint that the client will check before
            // establishing a session. Let's inject a fake unsecure endpoint so we can
            // skip the internal client test for invalid endpoint and get to the server
            const unsecureEndpoint = new EndpointDescription((client as any)._serverEndpoints[0]);
            unsecureEndpoint.securityMode = MessageSecurityMode.None;
            unsecureEndpoint.securityPolicyUri = SecurityPolicy.None;
            (client as any)._serverEndpoints.push(unsecureEndpoint);

            await assertThrow(async () => {
                await client.createSession();
            }, /BadSecurityModeRejected/);


            // assert that server has 0 sessions

            server.currentSessionCount.should.eql(0);
        } finally {
            await client.disconnect();
        }
    });

    it("it should be possible to get endpoint of a secure channel using a unsecure channel", async () => {
       
        // ask for a very short session timeout
        client = OPCUAClient.create({ requestedSessionTimeout: 200 });
        // assert that server has 0 session
        server.currentSessionCount.should.eql(0);

        // connect
        await client.connect(endpointUrl);

        try {
            // create session
            const endpoints = await client.getEndpoints();
          
            //xx console.log(endpoints);
            endpoints.length.should.eql(1);
            endpoints[0].securityMode.should.eql(MessageSecurityMode.SignAndEncrypt);
            endpoints[0].securityPolicyUri!.should.eql(SecurityPolicy.Basic256);

            // assert that server has no more session
            server.currentSessionCount.should.eql(0);

        } finally {
            await client.disconnect();
        }
    });
});

xdescribe("It should be possible to create server with disabled discovery service", function () {
    // in this case client shall be given valid end point , manually !
    // to do ...
});
