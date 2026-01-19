import {
    OPCUAServer,
    nodesets,
    DataType,
    OPCUAClient,
    ReadRawModifiedDetails,
    TimestampsToReturn,
    HistoryReadRequest,
} from "node-opcua";
import "should";

function date_add(date: Date, options: { seconds: number }): Date {
    const date1 = new Date(date.getTime() + options.seconds * 1000);
    return date1;
}

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

const port = 2248;

describe("Testing HistoryRead with ExtensionObject", function () {
    let server: OPCUAServer;
    let client: OPCUAClient;
    let endpointUrl: string;

    before(async () => {
        server = new OPCUAServer({
            port,
            nodeset_filename: [
                nodesets.standard,
                nodesets.di,
                nodesets.autoId
            ]
        });
        await server.initialize();
        const addressSpace = server.engine.addressSpace!;
        const namespace = addressSpace.getOwnNamespace();

        const nsAutoId = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");
        if (nsAutoId === -1) {
            throw new Error("Namespace AutoID not found");
        }
        const rfidScanResult = addressSpace.findDataType("RfidScanResult", nsAutoId);
        if (!rfidScanResult) {
            throw new Error("DataType RfidScanResult not found");
        }

        const uaMyObject = namespace.addObject({
            organizedBy: addressSpace.rootFolder.objects,
            browseName: "MyObject",
        });

        const uaVariable = namespace.addVariable({
            componentOf: uaMyObject,
            browseName: "TheVariable",
            nodeId: "s=MyObject.TheVariable",
            dataType: rfidScanResult,
        });

        addressSpace.installHistoricalDataNode(uaVariable);

        // Push some data
        const result = addressSpace.constructExtensionObject(rfidScanResult, {
            codeType: "Hello",
            scanData: {
                epc: {
                    pC: 12,
                    uId: Buffer.from("Hello"),
                    xpC_W1: 10,
                    xpC_W2: 12
                }
            },
            timestamp: new Date(),
            location: {
                local: {
                    x: 100,
                    y: 200,
                    z: 300,
                    timestamp: new Date(),
                    dilutionOfPrecision: 0.01,
                    usefulPrecicision: 2
                }
            }
        });

        uaVariable.setValueFromSource({ dataType: DataType.ExtensionObject, value: result });
        uaVariable.touchValue();

        await server.start();
        endpointUrl = server.getEndpointUrl();
    });

    after(async () => {
        if (server) await server.shutdown();
    });

    it("should read history with ExtensionObject and decode it properly", async () => {
        client = OPCUAClient.create({
            endpointMustExist: false
        });

        await client.withSessionAsync(endpointUrl, async (session) => {
            const nodeId = "ns=1;s=MyObject.TheVariable";
            const today = new Date();
            const historyReadDetails = new ReadRawModifiedDetails({
                endTime: date_add(today, { seconds: 1000 }),
                isReadModified: false,
                numValuesPerNode: 3,
                returnBounds: false,
                startTime: date_add(today, { seconds: -60 })
            });

            const result = await session.historyRead(new HistoryReadRequest({
                nodesToRead: [{
                    nodeId,
                    indexRange: undefined,
                    dataEncoding: undefined,
                    continuationPoint: undefined
                }],
                historyReadDetails,
                releaseContinuationPoints: false,
                timestampsToReturn: TimestampsToReturn.Both
            }));

            result.responseHeader.serviceResult.isGood().should.be.true();
            result.results!.length.should.eql(1);
            const historyResult = result.results![0];
            historyResult.statusCode.isGood().should.be.true();

            // Checking historyData type
            if (!historyResult.historyData) {
                throw new Error("historyData is null");
            }

            const historyData = historyResult.historyData as any;

            if (historyData.constructor.name === "HistoryData") {
                const dataValues = historyData.dataValues;
                dataValues.length.should.be.greaterThan(0);
                const val = dataValues[0].value.value;

                // Value should be promoted to RfidScanResult
                val.constructor.name.should.not.eql("OpaqueStructure");
                val.constructor.name.should.eql("RfidScanResult");
            } else {
                throw new Error("Expected HistoryData but got " + historyData.constructor.name);
            }
        });
    });
});
