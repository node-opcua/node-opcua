import should from "should";
import {
    OPCUAServer,
    DataType,
    nodesets,
    OPCUAClient,
    TimestampsToReturn,
    DataValue,
    TransferSubscriptionsResponse,
    StatusCodes,
    ServerSecureChannelLayer
} from "node-opcua";

const port = 2797;
let counter = 0;
function addVariable(server: OPCUAServer) {
    const addressSpace = server.engine.addressSpace!;
    const namespace = addressSpace.getOwnNamespace();

    const nsAutoId = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");
    const rfidScanResultDataTypeNode = addressSpace.findDataType("RfidScanResult", nsAutoId)!;

    const myVar = namespace.addVariable({
        browseName: "MyVar",
        nodeId: "s=MyVar",
        minimumSamplingInterval: 20,
        dataType: rfidScanResultDataTypeNode
    });

    const nextValue = () => {
        const scanResult = addressSpace.constructExtensionObject(rfidScanResultDataTypeNode, {
            // ScanResult
            codeType: "Hello" + counter,
            scanData: {
                epc: {
                    pC: 12 + counter,
                    uId: Buffer.from("Hello" + counter),
                    xpC_W1: 10,
                    xpC_W2: 12
                }
            },
            timestamp: new Date(Date.UTC(2018, 11, 23, 3, 45, counter % 60)),
            location: {
                local: {
                    x: 100 + counter,
                    y: 200 + counter,
                    z: 300 + counter,
                    timestamp: new Date(Date.UTC(2018, 11, 23, 3, 50, 0)),
                    dilutionOfPrecision: 0.01,
                    usefulPrecision: 2
                }
            }
        });
        counter += 1;
        return scanResult;
    };
    const scanResult = nextValue();
    myVar.setValueFromSource({ dataType: DataType.ExtensionObject, value: scanResult });

    const timerId = setInterval(() => {
        const scanResult = nextValue();
        myVar.setValueFromSource({ dataType: DataType.ExtensionObject, value: scanResult });
    }, 50);
    addressSpace.registerShutdownTask(() => clearInterval(timerId));
}
async function createServer() {
    const server = new OPCUAServer({
        port,
        nodeset_filename: [nodesets.standard, nodesets.di, nodesets.autoId]
    });
    await server.initialize();
    addVariable(server);

    should.exist((server as any)._on_TransferSubscriptionsRequest);
    (server as any)._on_TransferSubscriptionsRequest = (message: any, channel: ServerSecureChannelLayer) => {
        const response = new TransferSubscriptionsResponse({
            responseHeader: { serviceResult: StatusCodes.BadServiceUnsupported }
        });
        return channel.send_response("MSG", response, message);
    };

    await server.start();
    return server;
}

const wait = (timeout: number) => new Promise((resolve) => setTimeout(resolve, timeout));
// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Test dataTypeManager lifecycle during client reconnection ", function (this: any) {
    this.timeout(Math.max(300000, this.timeout()));

    it("client should recreate subscription and monitoredItem when the server doesn't support TransferSubscription is restarted #1059", async () => {
        let server = await createServer();

        const dataValues: DataValue[] = [];
        const endpointUrl = server.getEndpointUrl();
        try {
            const client = OPCUAClient.create({});
            client.on("connection_lost", () => console.log("connection_lost"));
            client.on("connection_reestablished", () => console.log("connection_reestablished"));
            client.on("reconnection_attempt_has_failed", () => console.log("reconnection_attempt_has_failed"));

            await client.withSubscriptionAsync(
                endpointUrl,
                { publishingEnabled: true, requestedPublishingInterval: 100 },
                async (session, subscription) => {
                    const monitoredItem = await subscription.monitor(
                        { nodeId: "ns=1;s=MyVar", attributeId: 13 },
                        { samplingInterval: 10 },
                        TimestampsToReturn.Both
                    );

                    monitoredItem.on("changed", (dataValue) => {
                        console.log("onc hanged =", dataValue.statusCode.toString());
                        dataValues.push(dataValue);
                    });
                    session.on("session_restored", () => {
                        console.log("session_restored");
                    });

                    await new Promise((resolve) => monitoredItem.once("changed", resolve));

                    await server.shutdown();

                    // await new Promise((resolve) => client.once("reconnection_attempt_has_failed", resolve));

                    dataValues.splice(0);
                    await wait(1000);

                    await new Promise((resolve) => {
                        client.once("connection_reestablished", resolve);
                        (async () => {
                            console.log("restarting server");
                            server = await createServer();
                        })();
                    });
                    await wait(1000);
                    await new Promise((resolve) => monitoredItem.once("changed", resolve));
                }
            );
        } finally {
            await server.shutdown();
        }
        dataValues.length.should.be.greaterThan(1);
    });
});
