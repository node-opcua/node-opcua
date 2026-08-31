import "should";
import fs from "node:fs";
import { AttributeIds, NumericRange, OPCUAClient, ReadValueId, StatusCodes } from "node-opcua";
import { type ServerHandle, start_simple_server, stop_simple_server } from "../../test_helpers/external_server_fixture.js";
import { perform_operation_on_client_session } from "../../test_helpers/perform_operation_on_client_session.js";

const port = 2018;

import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { serverScript } from "../../test_helpers/paths.js";

describe("testing extension object with client residing on a different process than the server process", function (this: Mocha.Context) {
    this.timeout(Math.max(600_000, this.timeout()));

    let serverHandle: ServerHandle;

    const options = {
        silent: true,
        server_sourcefile: serverScript("simple_server_with_custom_extension_objects.js"),
        port
    };
    if (!fs.existsSync(options.server_sourcefile)) {
        options.server_sourcefile = serverScript("simple_server_with_custom_extension_objects.js");
    }
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
            const dataValues = await session.read(nodesToRead);
            dataValues.length.should.eql(1);
            dataValues[0].statusCode.should.eql(StatusCodes.Good);
            const xmlData1 = dataValues[0].value.value.toString("utf-8");
            xmlData1.should.match(/opc:StructuredType BaseType="ua:ExtensionObject" Name="MyStructureDataType"/);
            // Second: read Description (attributeId 13) with explicit empty NumericRange
            const nodeToRead = { nodeId, attributeId: 13, indexRange: new NumericRange() };
            const dataValue = await session.read(nodeToRead);
            const xmlData2 = dataValue.value.value.toString("utf-8");
            xmlData2.should.match(/opc:StructuredType BaseType="ua:ExtensionObject" Name="MyStructureDataType"/);
        });
    });
});
