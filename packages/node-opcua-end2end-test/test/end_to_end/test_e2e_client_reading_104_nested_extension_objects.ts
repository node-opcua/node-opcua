import * as path from "path";
import * as fs from "fs";
import "should";
import { DataType, OPCUAClient, OPCUAServer, nodesets, AttributeIds, UAObject, UAVariableT, UAVariable } from "node-opcua";

const port = 4893;
const nodeId = "ns=3;i=6009";
async function startServer(): Promise<OPCUAServer> {
    const nodeset = path.join(__dirname, "../../fixtures/nodeset-with-nested_datastructure-1.04.NodeSet.xml");
    fs.existsSync(nodeset).should.eql(true);
    const server = new OPCUAServer({
        port,
        disableDiscovery: true,
        nodeset_filename: [nodesets.standard, nodeset]
    });

    await server.initialize();

    const addressSpace = server.engine.addressSpace!;

    const va1 = addressSpace.findNode(nodeId)! as UAVariable;
    va1.bindExtensionObject();

    await server.start();

    return server;
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing github issue", function () {
    let server: OPCUAServer;
    before(async () => {
        server = await startServer();
    });
    after(async () => {
        server && (await server.shutdown());
    });
    it("should be possible ", async () => {
        const endpointUrl = `opc.tcp://localhost:${port}`;

        const client = OPCUAClient.create({ endpointMustExist: false });

        const dataValue = await client.withSessionAsync(endpointUrl, async (session) => {
            const dataValue = await session.read({
                nodeId,
                attributeId: AttributeIds.Value
            });
            return dataValue;
        });
        console.log("dataValue", dataValue.toString());
        dataValue.value.value.field1_1.should.eql(0);
        dataValue.value.value.toJSON().should.eql({
            field1_1: 0,
            field1_2: {
                field2_1: false,
                field2_2: false
            },
            field1_3: {
                field3_1: false
            }
        });
    });
});
