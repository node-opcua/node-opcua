import {
    OPCUAServer,
    nodesets,
    DataType,
    OPCUAClient,
    HistoryReadRequest,
    ReadRawModifiedDetails,
    TimestampsToReturn
} from "node-opcua";
export function date_add(date: Date, options: { seconds: number }): Date {
    const date1 = new Date(date.getTime() + options.seconds * 1000);
    (date1 as any).picoseconds = 0;
    return date1;
}


async function main() {

    const server = new OPCUAServer({
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
    uaVariable.on("value_changed", (dataValue) => {
        console.log(dataValue.toString());
    });

    addressSpace.installHistoricalDataNode(uaVariable);


    let counter = 0;
    const doScan = () => {
        counter += 1;
        console.log("Scanning RFID...", counter);
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
                    x: 100 + counter,
                    y: 200 + counter,
                    z: 300 + counter,
                    timestamp: new Date(),
                    dilutionOfPrecision: 0.01,
                    usefulPrecicision: 2 // <<!!!! Note the TYPO HERE ! Bug in AutoID.XML !
                }
            }
        });
        uaVariable.setValueFromSource({ dataType: DataType.ExtensionObject, value: result });

        // Important in case of a extension object
        uaVariable.touchValue();
    };

    const timerId = setInterval(doScan, 1000);

    addressSpace.registerShutdownTask(() => {
        clearInterval(timerId);
    });

    const timerId2 = setInterval(async () => {
        await readHistoricalRfidScanResults();
    }, 10000);

    addressSpace.registerShutdownTask(() => {
        clearInterval(timerId2);
    });

    await server.start();
    console.log("Server is now listening ... ( press CTRL+C to stop)");
    console.log("endpointUrl: ", server.getEndpointUrl());

    await new Promise<void>((resolve) => process.once("SIGINT", resolve));
    console.log("Shutting down server...");
    await server.shutdown(1000);
    console.log("Server shut down completed");

}
main();

async function readHistoricalRfidScanResults() {
    const client = OPCUAClient.create({
        endpointMustExist: false
    });
    await client.withSessionAsync("opc.tcp://localhost:26543", async (session) => {

        const nodeId = "ns=1;s=MyObject.TheVariable";
        const today = new Date();
        const historyReadDetails = new ReadRawModifiedDetails({
            endTime: date_add(today, { seconds: 1000 }),
            isReadModified: false,
            numValuesPerNode: 3, // three at a time
            returnBounds: false,
            startTime: date_add(today, { seconds: -60 })
        });
        const indexRange = undefined;
        const dataEncoding = undefined;
        const continuationPoint = undefined;
        const result = await session.historyRead(new HistoryReadRequest({
            nodesToRead: [{ nodeId, indexRange, dataEncoding, continuationPoint }],
            historyReadDetails,
            releaseContinuationPoints: false,
            timestampsToReturn: TimestampsToReturn.Both
        }));
        console.log(result.toString());
    });

}