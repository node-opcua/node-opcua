import "should";
import fs from "fs";
import path from "path";
import {
    OPCUAClient,
    AttributeIds,
    StatusCodes,
    ReadValueId,
    NumericRange
} from "node-opcua";
import { start_simple_server, stop_simple_server } from "../../test_helpers/external_server_fixture";
import { perform_operation_on_client_session } from "../../test_helpers/perform_operation_on_client_session";

const port = 2018;

// eslint-disable-next-line import/order
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
describe("testing extension object with client residing on a different process than the server process", function (this: Mocha.Context) {
    this.timeout(Math.max(600_000, this.timeout()));

    let serverHandle: any = null;

    const options = {
        silent: true,
        server_sourcefile: path.join(__dirname, "../../test_helpers/bin/simple_server_with_custom_extension_objects.js"),
        port
    };
    fs.existsSync(options.server_sourcefile).should.eql(true, "cannot find simple_server_with_custom_extension_objects script");

    before(async () => {
        serverHandle = await start_simple_server(options);
    });
    after(async () => {
        await stop_simple_server(serverHandle);
    });

    it("should read the MyStructureDataType definition", async () => {
        const client = OPCUAClient.create({ endpointMustExist: false });
        const endpointUrl = serverHandle.endpointUrl;
        const nodeId = "ns=2;i=6001";
        await perform_operation_on_client_session(client, endpointUrl, async (session) => {
            // First: read Value attribute (expects an XML schema string for custom structure definition)
            const nodesToRead = [new ReadValueId({ nodeId, attributeId: AttributeIds.Value })];
            const dataValues = await (session as any).read(nodesToRead);
            dataValues.length.should.eql(1);
            dataValues[0].statusCode.should.eql(StatusCodes.Good);
            const xmlData1 = dataValues[0].value.value.toString("utf-8");
            xmlData1.should.match(/opc:StructuredType BaseType="ua:ExtensionObject" Name="MyStructureDataType"/);
            // Second: read Description (attributeId 13) with explicit empty NumericRange
            const nodeToRead = { nodeId, attributeId: 13, indexRange: new NumericRange() };
            const dataValue = await (session as any).read(nodeToRead);
            const xmlData2 = dataValue.value.value.toString("utf-8");
            xmlData2.should.match(/opc:StructuredType BaseType="ua:ExtensionObject" Name="MyStructureDataType"/);
        });
    });
});
