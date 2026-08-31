import type { ExtensionObject } from "node-opcua";
import {
    BinaryStream,
    DataType,
    DataValue,
    HistoryData,
    HistoryReadRequest,
    nodesets,
    OPCUAClient,
    OPCUAServer,
    ReadRawModifiedDetails,
    StatusCodes,
    TimestampsToReturn
} from "node-opcua";
import { OpaqueStructure } from "node-opcua-extension-object";
import should from "should";

function date_add(date: Date, options: { seconds: number }): Date {
    const date1 = new Date(date.getTime() + options.seconds * 1000);
    return date1;
}

/** encode an ExtensionObject to its binary body so two instances can be compared byte-for-byte */
function toBuffer(extObj: ExtensionObject): Buffer {
    const stream = new BinaryStream(extObj.binaryStoreSize());
    extObj.encode(stream);
    return stream.buffer;
}

// minimal view of the RfidScanResult fields we spot-check after decoding.
// note: ScanData is a Union whose selected member is `epc`, and the generated field is `PC` (upper case).
interface RfidScanResultLike {
    codeType: string;
    scanData: { epc: { PC: number } };
}

import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

const port = 2248;

const nodeId = "ns=1;s=MyObject.TheVariable";

describe("Testing HistoryRead with ExtensionObject", () => {
    let server: OPCUAServer;
    let client: OPCUAClient;
    let endpointUrl: string;

    // reference copies of what we historized, in chronological order
    const storedValues: { extObj: ExtensionObject; sourceTimestamp: Date }[] = [];
    // the time domain that brackets all the pushed values
    let firstTimestamp: Date;
    let lastTimestamp: Date;

    before(async () => {
        server = new OPCUAServer({
            port,
            nodeset_filename: [nodesets.standard, nodesets.di, nodesets.autoId]
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
            browseName: "MyObject"
        });

        const uaVariable = namespace.addVariable({
            componentOf: uaMyObject,
            browseName: "TheVariable",
            nodeId,
            dataType: rfidScanResult
        });

        addressSpace.installHistoricalDataNode(uaVariable);

        // Push several distinct extension objects, each at a distinct (increasing) source timestamp,
        // so we can later assert that the whole history is returned in order and byte-for-byte identical.
        const base = new Date();
        const numValues = 5;
        for (let i = 0; i < numValues; i++) {
            const sourceTimestamp = date_add(base, { seconds: i });

            const extObj = addressSpace.constructExtensionObject(rfidScanResult, {
                codeType: `Code-${i}`,
                scanData: {
                    epc: {
                        PC: 12 + i,
                        uId: Buffer.from(`uId-${i}`),
                        XPC_W1: 10 + i,
                        XPC_W2: 12 + i
                    }
                },
                timestamp: sourceTimestamp,
                location: {
                    local: {
                        x: 100 + i,
                        y: 200 + i,
                        z: 300 + i,
                        timestamp: sourceTimestamp,
                        dilutionOfPrecision: 0.01 * (i + 1),
                        usefulPrecicision: 2
                    }
                }
            }) as ExtensionObject;

            uaVariable.setValueFromSource({ dataType: DataType.ExtensionObject, value: extObj }, StatusCodes.Good, sourceTimestamp);

            storedValues.push({ extObj, sourceTimestamp });
        }
        firstTimestamp = storedValues[0].sourceTimestamp;
        lastTimestamp = storedValues[storedValues.length - 1].sourceTimestamp;

        await server.start();
        endpointUrl = server.getEndpointUrl();
    });

    after(async () => {
        if (server) await server.shutdown();
    });

    it("should read the whole history and return every stored ExtensionObject exactly and in order", async () => {
        client = OPCUAClient.create({
            endpointMustExist: false
        });

        await client.withSessionAsync(endpointUrl, async (session) => {
            const historyReadDetails = new ReadRawModifiedDetails({
                // bracket the full range with a margin on both sides
                startTime: date_add(firstTimestamp, { seconds: -60 }),
                endTime: date_add(lastTimestamp, { seconds: 60 }),
                isReadModified: false,
                numValuesPerNode: 0, // 0 => all values in the time domain
                returnBounds: false
            });

            const result = await session.historyRead(
                new HistoryReadRequest({
                    nodesToRead: [
                        {
                            nodeId,
                            indexRange: undefined,
                            dataEncoding: undefined,
                            continuationPoint: undefined
                        }
                    ],
                    historyReadDetails,
                    releaseContinuationPoints: false,
                    timestampsToReturn: TimestampsToReturn.Both
                })
            );

            result.responseHeader.serviceResult.isGood().should.be.true();
            should(result.results?.length).eql(1);

            const historyResult = result.results![0];
            historyResult.statusCode.isGood().should.be.true();

            if (!historyResult.historyData) {
                throw new Error("historyData is null");
            }
            historyResult.historyData.should.be.instanceOf(HistoryData);

            const dataValues = (historyResult.historyData as HistoryData).dataValues;
            if (!dataValues) {
                throw new Error("dataValues is null");
            }

            // 1. every stored value must be returned, and nothing extra
            dataValues.length.should.eql(storedValues.length);

            for (let i = 0; i < storedValues.length; i++) {
                const dataValue = dataValues[i];
                const expected = storedValues[i];

                dataValue.should.be.instanceOf(DataValue);

                // 2. status code preserved
                dataValue.statusCode.isGood().should.be.true();

                // 3. source timestamp preserved and values returned in chronological order
                if (!dataValue.sourceTimestamp) {
                    throw new Error(`missing sourceTimestamp at index ${i}`);
                }
                dataValue.sourceTimestamp.getTime().should.eql(expected.sourceTimestamp.getTime());

                // 4. variant is a properly decoded ExtensionObject, promoted from the OpaqueStructure
                //    the client produced when decoding the (statically unknown) RfidScanResult.
                dataValue.value.dataType.should.eql(DataType.ExtensionObject);
                const returned = dataValue.value.value as ExtensionObject;
                returned.should.not.be.instanceOf(OpaqueStructure);
                returned.constructor.name.should.eql("RfidScanResult");

                // 5. the returned ExtensionObject must be byte-for-byte identical to what we stored
                toBuffer(returned).should.eql(
                    toBuffer(expected.extObj),
                    `stored and returned ExtensionObject differ at index ${i}`
                );

                // 6. spot-check a couple of decoded fields for good measure
                const decoded = returned as unknown as RfidScanResultLike;
                decoded.codeType.should.eql(`Code-${i}`);
                decoded.scanData.epc.PC.should.eql(12 + i);
            }
        });
    });
});
