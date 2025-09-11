
import "should";
import { OPCUAServer, OPCUAClient, get_empty_nodeset_filename, parseEndpointUrl } from "node-opcua";
import { getFullyQualifiedDomainName } from "node-opcua-hostname";
import { perform_operation_on_client_session } from "../../test_helpers/perform_operation_on_client_session";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

const empty_nodeset_filename = get_empty_nodeset_filename();
const port = 6789;

describe("Testing a simple server from Server side", function () {
    it("should have at least one endpoint", async () => {
        const server = new OPCUAServer({ port, nodeset_filename: empty_nodeset_filename });
        try {
            await server.start();
            server.endpoints.length.should.be.greaterThan(0);
            const endPoint = server.endpoints[0];
            const rawEndpointUrl = endPoint.endpointDescriptions()[0].endpointUrl || ""; // UAString -> string
            const ep = parseEndpointUrl(rawEndpointUrl);
            const expected_hostname = getFullyQualifiedDomainName();
            (ep.hostname || "").toLowerCase().should.match(new RegExp(expected_hostname.toLowerCase()));
            (ep.port || "").should.eql("6789");
        } finally {
            await server.shutdown();
        }
    });

    it("OPCUAServer#getChannels", async () => {
    const server = new OPCUAServer({ port, nodeset_filename: empty_nodeset_filename });
        try {
        (server as any).getChannels().length.should.equal(0);
            await server.start();
        (server as any).getChannels().length.should.equal(0);
            const endpointUrl = server.getEndpointUrl();
            const client = OPCUAClient.create({});
            await perform_operation_on_client_session(client, endpointUrl, async (_session) => {
                (server as any).getChannels().length.should.equal(1);
            });
            // after session closed
            (server as any).getChannels().length.should.equal(0);
        } finally {
            await server.shutdown();
            (OPCUAServer as any).registry.count().should.eql(0);
        }
    });

    it("should start and shutdown", async () => {
        const server = new OPCUAServer({ port, nodeset_filename: empty_nodeset_filename });
        await server.start();
        await server.shutdown();
    });
});


