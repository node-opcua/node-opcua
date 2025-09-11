

import should from "should";
import { assert } from "node-opcua-assert";
import { OPCUAServer, OPCUAClient, OPCUAClientBase } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { assertThrow } from "../../test_helpers/assert_throw";

const port = 2010;


describe("testing the server ability to deny client session request (server with maxSessions = 1)", function (this: Mocha.Runnable) {
    this.timeout(Math.max(300000, this.timeout()));

    let server: OPCUAServer;
    let client1: OPCUAClient;
    let client2: OPCUAClient;
    let endpointUrl: string;

    before(function (done) {
        OPCUAClientBase.registry.count().should.eql(0);

        // Given a server with only one allowed Session
        server = new OPCUAServer({
            port,
            serverCapabilities: { 
                maxSessions: 1 
            }
        });

        client1 = OPCUAClient.create({});
        client2 = OPCUAClient.create({});

        server.start(function () {
            endpointUrl = server.getEndpointUrl();
            done();
        });
    });

    after(async () => {
        await client2.disconnect();
        await client1.disconnect();
        await server.shutdown();
        OPCUAServer.registry.count().should.eql(0);
    });




    it("should accept only one session at a time", async () => {
        server.currentChannelCount.should.eql(0);

        // given that client1 is connected, and have a session
        await client1.connect(endpointUrl);
        await client1.createSession();

        //  when client2 try to create a session
        await client2.connect(endpointUrl);
        await assertThrow(async () => {
           await  client2.createSession();
        }, /BadTooManySessions/);

        // now if client1 disconnect ...

        await client1.disconnect();

        // it should be possible to connect client 2
        await client2.createSession();
        await client2.disconnect();
    });
});
