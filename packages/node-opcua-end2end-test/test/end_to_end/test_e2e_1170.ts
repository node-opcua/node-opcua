import "should";
import { OPCUAClient, OPCUAServer } from "node-opcua";

import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

describe("Testing bug #1170", () => {
    const port = 1170;
    let server: OPCUAServer;
    let endpointUrl: string;
    before(async () => {
        server = new OPCUAServer({
            port,
            serverInfo: {
                productUri: "Mini NodeOPCUA-Server"
            }
        });

        await server.start();

        endpointUrl = server.getEndpointUrl();
    });
    after(async () => {
        await server.shutdown();
    });

    it("server createSession should expose endpoints with correct productURI", async () => {
        const client = OPCUAClient.create({
            clientName: `1 test_e2e_1170`
        });
        const serverEndpoints = await client.withSessionAsync(endpointUrl, async (session) => {
            return session.serverEndpoints;
        });
        serverEndpoints[0].server.productUri?.should.eql("Mini NodeOPCUA-Server");
    });
});
