import "should";
import {
    OPCUAServer,
    OPCUAClient,
    resolveNodeId,
    AttributeIds,
    readNamespaceArray,
    DataType,
    nodesets,
    Variant
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

async function startServer() {
    const server = new OPCUAServer({
        port: port, // the port of the listening socket of the server
        resourcePath: "/UA/MyLittleServer", // this path will be added to the endpoint resource name
        buildInfo: {
            productName: "MySampleServer1",
            buildNumber: "7658",
            buildDate: new Date(),

        },
        nodeset_filename: [
            nodesets.standard,
            nodesets.di,
            nodesets.machineryResult
        ]
    });

    await server.initialize();


    const addressSpace = server.engine.addressSpace!;
    const namespaceArray = addressSpace.getNamespaceArray();
    const nsResult = namespaceArray.findIndex((ns) => ns.namespaceUri === "http://opcfoundation.org/UA/Machinery/Result/");
    if (nsResult === -1) {
        throw new Error("Failed to find MachineryResult namespace");
    }

    const resultDataType = addressSpace.findDataType("ResultDataType", nsResult);
    if (!resultDataType) {
        throw new Error("Failed to find ResultDataType data type");
    }

    const namespace = addressSpace.getOwnNamespace();

    const uaMyDevice = namespace.addObject({
        organizedBy: addressSpace.rootFolder.objects,
        browseName: "MyDevice"
    });

    const uaVariable = namespace.addVariable({
        componentOf: uaMyDevice,
        nodeId: "s=MyDevice_ResultVariable",
        browseName: "Result",
        dataType: resultDataType,
    });

    const content1 = new Variant({
        dataType: DataType.String,
        value: "Measurement1"
    });

    const threeDVectorType = addressSpace.findDataType("3DCartesianCoordinates", 0);
    if (!threeDVectorType) {
        throw new Error("Failed to find ThreeDVectorType data type");
    }
    const content2 = new Variant({
        dataType: DataType.ExtensionObject,
        value: addressSpace.constructExtensionObject(threeDVectorType, {
            x: 1.0,
            y: 2.0,
            z: 3.0
        })
    });

    const extObj = addressSpace.constructExtensionObject(resultDataType, {
        ResultMetadata: {
            IsSimulated: true,
            ProductId: "12345",
        },
        ResultContent: [
            content1,
            content2
        ]
    });
    uaVariable.setValueFromSource({ dataType: "ExtensionObject", value: extObj });

    await server.start();
    return server;
}

const port = 28090;
describe("testing ResultDataType extension (containing BaseDataType field) object on client ", function (this: Mocha.Context) {


   this.timeout(Math.max(200_000, this.timeout()));

    let server: OPCUAServer;
    before(async () => {
        server = await startServer();
    });

    after(async () => {
        await server.shutdown();
    });

    it("should be possible to write a ResultDataType extension object to the server with a client", async () => {
        const client = OPCUAClient.create({
            endpointMustExist: false,
        });
        const endpointUrl = server.getEndpointUrl();

        const writeStatusCode = await client.withSessionAsync(endpointUrl, async (session) => {
            await session.extractNamespaceDataType();

            // #region Find MachineryResult namespace
            const namespaceArray = await readNamespaceArray(session);
            const nsResult = namespaceArray.findIndex((ns) => ns === "http://opcfoundation.org/UA/Machinery/Result/");
            if (nsResult === -1) {
                throw new Error("Failed to find MachineryResult namespace");
            }
            // important to use resolveNodeId here to get a proper NodeId object
            const resultDataTypeNodeId = resolveNodeId(`ns=${nsResult};i=3008`);
            // #endregion

            const content1 = new Variant({
                dataType: DataType.String,
                value: "Measurement1"
            });
            const content2 = new Variant({
                dataType: DataType.Double,
                value: [1, 2, 3]
            });


            const extObj = await session.constructExtensionObject(resultDataTypeNodeId, {
                ResultContent: [
                    content1,
                    content2
                ]
            });

            const nodeId = "ns=1;s=MyDevice_ResultVariable";
            const statusCode = await session.write({
                nodeId,
                attributeId: AttributeIds.Value,
                value: {
                    value: {
                        dataType: DataType.ExtensionObject,
                        value: extObj
                    }
                }
            });
            return statusCode;
        });
        writeStatusCode.isGood().should.eql(true);

    });
});
