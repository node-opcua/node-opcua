import should from "should";
import {
    ClientSubscriptionOptions,
    OPCUAClient,
    DataType,
    OPCUAServer,
    nodesets,
    AttributeIds,
    MonitoringMode,
    TimestampsToReturn,
    DataValue,
    ClientSecureChannelLayer
} from "node-opcua";
import { make_errorLog } from "node-opcua-debug";
// import { DTScanResult } from "node-opcua-nodeset-auto-id";
interface DTScanResult {
    codeType: string;
}
const errorLog = make_errorLog("TEST");

const port = 2787;

let counter = 0;
const doDebug = false;

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
async function createServerVersion1() {
    const server = new OPCUAServer({
        port,
        nodeset_filename: [nodesets.standard, nodesets.di, nodesets.autoId]
    });
    await server.initialize();
    addVariable(server);
    await server.start();
    return server;
}

async function createServerVersion2() {
    const server = new OPCUAServer({
        port,
        nodeset_filename: [nodesets.standard, nodesets.di, nodesets.robotics, nodesets.autoId]
    });
    await server.initialize();
    addVariable(server);
    await server.start();
    return server;
}
async function createServerVersion3() {
    const server = new OPCUAServer({
        port,
        nodeset_filename: [nodesets.standard, nodesets.di, nodesets.robotics, nodesets.commercialKitchenEquipment, nodesets.autoId]
    });
    await server.initialize();
    addVariable(server);
    await server.start();
    return server;
}

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Test dataTypeManager lifecycle during client reconnection ", function (this: any) {
    this.timeout(Math.max(300000, this.timeout()));

    let server: OPCUAServer;
    let o = 0;
    before(async () => {
        o = ClientSecureChannelLayer.defaultTransactionTimeout;
        ClientSecureChannelLayer.defaultTransactionTimeout = 100000000;

        server = await createServerVersion1();
    });
    after(async () => {
        await server.shutdown(0);
        ClientSecureChannelLayer.defaultTransactionTimeout = o;
    });
    it("RDR-0 - should repair dataTypeManager after server has restarted ", async () => {
        const endpointUrl = server.getEndpointUrl();

        const client = OPCUAClient.create({});
        await client.withSessionAsync(endpointUrl, async (session) => {
            /** */
            errorLog("done");
        });
        errorLog("done/done");
    });
    it("RDR-1 - should repair dataTypeManager after server has restarted ", async () => {
        const endpointUrl = server.getEndpointUrl();

        const client = OPCUAClient.create({});
        const subscriptionParameters: ClientSubscriptionOptions = {
            publishingEnabled: true,
            requestedPublishingInterval: 100
        };
        await client.withSubscriptionAsync(endpointUrl, subscriptionParameters, async (session, subscription) => {
            /** */
            console.log("done");
        });
        console.log("done/done");
    });

    it("RDR-2 - should repair dataTypeManager after server has restarted ", async () => {
        const endpointUrl = server.getEndpointUrl();

        const client = OPCUAClient.create({});
        const subscriptionParameters: ClientSubscriptionOptions = {
            publishingEnabled: true,
            requestedPublishingInterval: 100
        };
        await client.withSubscriptionAsync(endpointUrl, subscriptionParameters, async (session, subscription) => {
            /** */
            await server.shutdown();
            server = await createServerVersion2();
            await new Promise((resolve) => setTimeout(resolve, 1000));
            errorLog("done");
        });
        errorLog("done/done");
    });

    it("RDR-4 - should repair dataTypeManager after server has restarted ", async () => {
        const endpointUrl = server.getEndpointUrl();

        const client = OPCUAClient.create({});

        client.on("backoff", () => {
            console.log("backoff");
        });
        client.on("connection_reestablished", () => {
            console.log("connection_reestablished");
        });
        client.on("connection_lost", () => {
            console.log("connection_lost");
        });
        client.on("connection_failed", () => {
            console.log("connection_failed");
        });
        client.on("start_reconnection", () => {
            console.log("start_reconnection");
        });
        client.on("after_reconnection", () => {
            console.log("after_reconnection");
        });
        client.on("close", () => {
            console.log("close");
        });

        const subscriptionParameters: ClientSubscriptionOptions = {
            publishingEnabled: true,
            requestedPublishingInterval: 100
        };

        const dataValues: DataValue[] = [];
        await client.withSubscriptionAsync(endpointUrl, subscriptionParameters, async (session, subscription) => {
            session.on("session_closed", () => {
                console.log("session_closed");
            });
            session.on("session_restored", () => {
                console.log("session_restored");
            });

            const monitoredItem = await subscription.monitor(
                {
                    nodeId: "ns=1;s=MyVar",
                    attributeId: AttributeIds.Value
                },
                { queueSize: 10, samplingInterval: 20 },
                TimestampsToReturn.Both,
                MonitoringMode.Reporting
            );

            monitoredItem.on("changed", (dataValue) => {
                doDebug && console.log("dataValue = ", dataValue.toString());
                dataValues.push(dataValue);
            });

            const waitNextChange = async () =>
                await new Promise<void>((resolve) => {
                    monitoredItem.once("changed", () => {
                        resolve();
                    });
                });

            const waitSessionRestore = async () =>
                await new Promise<void>((resolve) => {
                    session.on("session_restored", () => {
                        resolve();
                    });
                });

            await waitNextChange();
            await waitNextChange();
            await waitNextChange();

            await server.shutdown();
            (async () => {
                server = await createServerVersion2();
            })();

            await waitSessionRestore();

            await waitNextChange();
            await waitNextChange();
            await waitNextChange();

            if (true) {
                await server.shutdown();
                (async () => {
                    server = await createServerVersion3();
                })();

                await waitSessionRestore();

                await waitNextChange();
                await waitNextChange();
                await waitNextChange();
            }

            errorLog("done");
            return dataValues;
        });
        errorLog("done/done");

        for (const dv of dataValues) {
            //  console.log("dv = ", dv.toString());
            const scanResult = dv.value.value as DTScanResult;
            should(scanResult.codeType).be.instanceOf(String);
            console.log("scanResult = ", scanResult.codeType);
        }
    });
});
