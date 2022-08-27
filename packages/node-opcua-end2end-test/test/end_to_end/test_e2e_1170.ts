const async = require("async");
const should = require("should");
const opcua = require("node-opcua");
const OPCUAClient = opcua.OPCUAClient;
const UserTokenPolicy = opcua.UserTokenPolicy;
const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing bug #1170", function () {
    const port = 1170;
    let server;
    let endpointUrl;
    before(async () => {
        server = new opcua.OPCUAServer({
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
        const client = OPCUAClient.create({});
        const serverEndpoints = await client.withSessionAsync(endpointUrl, async (session) => {
            return session.serverEndpoints;
        });
        serverEndpoints[0].server.productUri.should.eql("Mini NodeOPCUA-Server");
    });
});
