import {
    OPCUAServer,
    nodesets,
    OPCUAClient,
    ClientMonitoredItem,
    MonitoringParametersOptions,
    TimestampsToReturn,
    IBasicSession,
    ClientSubscription,
    AttributeIds,
    NodeId,
    DataType,
    VariantArrayType,
    UAVariable,
    DataValue
} from "node-opcua";
import * as should from "should";
import * as sinon from "sinon";
const _should = should;

const port = 4000;
const endpointUrl = `opc.tcp://localhost:${port}`;

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("AZA1- testing Client-Server subscription use case, on a fake server exposing the temperature device", function () {

    let nodeId: NodeId;
    let scanResultNode: UAVariable;

    const server = new OPCUAServer({
        port,
        nodeset_filename: [
            nodesets.standard,
            nodesets.di,
            nodesets.autoId
        ]
    });
    before(async () => {
        await server.initialize();

        const addressSpace = server.engine.addressSpace!;

        const nsAutoId = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");

        const rfidScanResultDataTypeNode = addressSpace.findDataType("RfidScanResult", nsAutoId)!;
        if (!rfidScanResultDataTypeNode) {
            throw new Error("cannot find RfidScanResult");
        }

        const namespace = addressSpace.getOwnNamespace();

        const scanResult = addressSpace.constructExtensionObject(rfidScanResultDataTypeNode, {
            // ScanResult
            scanData: {
                epc: {
                    pC: 12,
                    uId: Buffer.from("Hello"),
                    xpC_W1: 10,
                    xpC_W2: 12
                },
            },
            timestamp: new Date(2018, 11, 23),
            location: {
                local: {
                    x: 100,
                    y: 200,
                    z: 300,
                    timestamp: new Date(),
                    dilutionOfPrecision: 0.01,
                    usefulPrecicision: 2  // <<!!!! Note the TYPO HERE ! Bug in AutoID.XML !
                }
            }
        });

        scanResultNode = namespace.addVariable({
            browseName: "Result",
            dataType: rfidScanResultDataTypeNode,
            valueRank: -1,
            organizedBy: addressSpace.rootFolder.objects,
            value: { dataType: DataType.ExtensionObject, value: scanResult },
            minimumSamplingInterval: -1
        });


        scanResultNode.setValueFromSource({
            arrayType: VariantArrayType.Scalar,
            dataType: DataType.ExtensionObject,
            value: scanResult
        });

        nodeId = scanResultNode.nodeId;
        await server.start();
    });
    after(async () => {
        await server.shutdown();
    });


    it("MIEO - a client should not receive opaque structure when monitoring extension objects", async () => {

        const client = OPCUAClient.create({ endpoint_must_exist: false });

        const subscriptionParameters = {
            publishingEnabled: true,
            requestedLifetimeCount: 10000,
            requestedMaxKeepAliveCount: 100,
            requestedPublishingInterval: 100,
        };
        await client.withSubscriptionAsync(endpointUrl, subscriptionParameters, async (session: IBasicSession, subscription: ClientSubscription) => {

            try {

                const itemToMonitor = {
                    nodeId,
                    attributeId: AttributeIds.Value
                };
                const parameters: MonitoringParametersOptions = {
                    queueSize: 10,
                    samplingInterval: 100,
                };
                const monitoredItem = ClientMonitoredItem.create(subscription, itemToMonitor, parameters, TimestampsToReturn.Both);

                // subscription.on("item_added",function(monitoredItem){
                monitoredItem.on("initialized", () => {
                    console.log(" Initialized !");
                });

                const changedSpy = sinon.spy();
                monitoredItem.on("changed", changedSpy);
                monitoredItem.on("err", (message: string) => {
                    console.log("Error", message);
                });

                monitoredItem.on("changed", (dataValue) => {
                    console.log(".");//dataValue.toJSON());
                });
                await new Promise((resolve) => setTimeout(resolve, 1000));

                console.log("changedSpy = ", changedSpy.getCalls().length);
                /*RfidScanResult*/
                changedSpy.firstCall.args[0].should.be.instanceOf(DataValue);
                changedSpy.firstCall.args[0].value.dataType.should.eql(DataType.ExtensionObject);
                changedSpy.firstCall.args[0].value.value.constructor.name.should.eql("RfidScanResult");
                changedSpy.callCount.should.eql(1);
            }
            catch (err) {
                console.log(err);
                throw err;
            }
        });

    });
});

