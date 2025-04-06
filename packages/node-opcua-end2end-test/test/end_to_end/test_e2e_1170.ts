import "should";
import { OPCUAClient, OPCUAServer } from "node-opcua";

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing bug #1170", function () {
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
            clientName: "1 " + __filename,
        });
        const serverEndpoints = await client.withSessionAsync(endpointUrl, async (session) => {
            return session.serverEndpoints;
        });
        serverEndpoints[0].server.productUri!.should.eql("Mini NodeOPCUA-Server");
    });
});
