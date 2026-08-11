import "should";
import { AttributeIds, DataType, makeNodeId, OPCUAClient, OPCUAServer, VariableIds } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

const port = 2263;

// OPC 10000-17 (GDS) Annex C.2: an aggregating server exposes the ServerUri of every
// aggregated server in its ServerArray, so that ExpandedNodeId.serverIndex values
// (e.g. in FindAlias results) can be resolved by clients.
describe("Testing ServerEngine#setServerArrayProvider (Server_ServerArray i=2254)", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 20000));

    const serverArrayNodeId = makeNodeId(VariableIds.Server_ServerArray);

    async function readServerArray(server: OPCUAServer): Promise<string[]> {
        const client = OPCUAClient.create({ endpointMustExist: false });
        return await client.withSessionAsync(server.getEndpointUrl(), async (session) => {
            const dataValue = await session.read({ nodeId: serverArrayNodeId, attributeId: AttributeIds.Value });
            dataValue.statusCode.isGood().should.eql(true);
            dataValue.value.dataType.should.eql(DataType.String);
            return dataValue.value.value as string[];
        });
    }

    it("SAP-1 should expose provider entries at indices 1..n, keeping the server's own URI at index 0, and keep indices stable when an entry is withdrawn", async () => {
        const server = new OPCUAServer({ port });
        try {
            await server.initialize();

            const additionalEntries = ["urn:aggregated-server-A", "urn:aggregated-server-B"];
            server.engine.setServerArrayProvider(() => additionalEntries);

            await server.start();
            const ownUri = server.engine.serverNameUrn;

            const serverArray1 = await readServerArray(server);
            serverArray1.should.eql([ownUri, "urn:aggregated-server-A", "urn:aggregated-server-B"]);

            // withdrawing an entry leaves an empty-string hole: the index of every
            // remaining entry must not shift
            additionalEntries[0] = "";
            const serverArray2 = await readServerArray(server);
            serverArray2.should.eql([ownUri, "", "urn:aggregated-server-B"]);
            serverArray2[2].should.eql(serverArray1[2]);
        } finally {
            await server.shutdown();
        }
    });

    it("SAP-2 should serve only the server's own URI when no provider is installed or after the provider is removed", async () => {
        const server = new OPCUAServer({ port });
        try {
            await server.start();
            const ownUri = server.engine.serverNameUrn;

            (await readServerArray(server)).should.eql([ownUri]);

            server.engine.setServerArrayProvider(() => ["urn:aggregated-server-A"]);
            (await readServerArray(server)).should.eql([ownUri, "urn:aggregated-server-A"]);

            server.engine.setServerArrayProvider(null);
            (await readServerArray(server)).should.eql([ownUri]);
        } finally {
            await server.shutdown();
        }
    });
});
