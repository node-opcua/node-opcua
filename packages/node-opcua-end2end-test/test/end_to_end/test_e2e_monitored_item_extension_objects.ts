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
    DataValue,
    resolveNodeId,
    Variant,
    constructEventFilter,
    ClientSession
} from "node-opcua";
import * as should from "should";
import * as sinon from "sinon";

import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const _should = should;

const port = 2228;
let endpointUrl: string;

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("AZA1- testing Client-Server subscription use case, on a fake server exposing the temperature device", () => {
    let nodeId: NodeId;
    let scanResultNode: UAVariable;

    const server = new OPCUAServer({
        port,
        nodeset_filename: [nodesets.standard, nodesets.di, nodesets.autoId]
    });

    function raiseRfidScanEvent() {
        const addressSpace = server.engine.addressSpace!;

        const nsAutoId = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");

        const rfidScanResultDataTypeNode = addressSpace.findDataType("RfidScanResult", nsAutoId)!;
        if (!rfidScanResultDataTypeNode) {
            throw new Error("cannot find RfidScanResult");
        }
        const rfidScanEventType = addressSpace.findEventType("RfidScanEventType", nsAutoId);
        if (!rfidScanEventType) {
            throw new Error("cannot find RfidScanEventType");
        }

        const scanResult = addressSpace.constructExtensionObject(rfidScanResultDataTypeNode, {
            // ScanResult
            scanData: {
                epc: {
                    pC: Math.ceil(Math.random() * 100),
                    uId: Buffer.from("Hello"),
                    xpC_W1: Math.ceil(Math.random() * 100),
                    xpC_W2: Math.ceil(Math.random() * 100)
                }
            },
            timestamp: new Date(2018, 11, 23),

            location: {
                local: {
                    x: 100,
                    y: 200,
                    z: 300,

                    timestamp: new Date(),

                    dilutionOfPrecision: Math.random(),

                    usefulPrecicision: 2 // <<!!!! Note the TYPO HERE ! Bug in AutoID.XML !
                }
            }
        });
        const s = server.engine.addressSpace?.rootFolder.objects.server!;
        s.raiseEvent(rfidScanEventType, {
            scanResult: {
                dataType: DataType.ExtensionObject,
                value: scanResult
            }
        });

        debugLog("Event raised");
    }

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
                }
            },
            timestamp: new Date(2018, 11, 23),

            location: {
                local: {
                    x: 100,
                    y: 200,
                    z: 300,

                    timestamp: new Date(),

                    dilutionOfPrecision: 0.01,

                    usefulPrecicision: 2 // <<!!!! Note the TYPO HERE ! Bug in AutoID.XML !
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
        endpointUrl = server.getEndpointUrl();
    });
    after(async () => {
        await server.shutdown();
    });

    const publishingInterval = 500;
    it("MIEO-1 - a client should not receive opaque structure when monitoring extension objects", async () => {
        const client = OPCUAClient.create({
            requestedSessionTimeout: 10000000,
            // tslint:disable-next-line: object-literal-sort-keys
            endpointMustExist: false
        });

        const subscriptionParameters = {
            publishingEnabled: true,
            requestedLifetimeCount: 10000,
            requestedMaxKeepAliveCount: 100,
            requestedPublishingInterval: publishingInterval
        };
        await client.withSubscriptionAsync(
            endpointUrl,
            subscriptionParameters,
            async (session: IBasicSession, subscription: ClientSubscription) => {
                try {
                    const itemToMonitor = {
                        attributeId: AttributeIds.Value,
                        nodeId
                    };
                    const parameters: MonitoringParametersOptions = {
                        queueSize: 10,
                        samplingInterval: 100
                    };
                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        itemToMonitor,
                        parameters,
                        TimestampsToReturn.Both
                    );

                    const changedSpy = sinon.spy();
                    monitoredItem.on("changed", changedSpy);
                    monitoredItem.on("err", (message: string) => {
                        debugLog("Error", message);
                    });

                    monitoredItem.on("changed", (dataValue) => {
                        debugLog("."); //dataValue.toJSON());
                    });
                    await new Promise<void>((resolve) => {
                        // subscription.on("item_added",function(monitoredItem){
                        monitoredItem.on("initialized", () => {
                            debugLog(" Initialized !");
                            resolve();
                        });
                    });

                    await new Promise<void>((resolve) => monitoredItem.once("changed", () => resolve()));

                    debugLog("changedSpy = ", changedSpy.getCalls().length);
                    /*RfidScanResult*/
                    changedSpy.firstCall.args[0].should.be.instanceOf(DataValue);
                    changedSpy.firstCall.args[0].value.dataType.should.eql(DataType.ExtensionObject);
                    changedSpy.firstCall.args[0].value.value.constructor.name.should.eql("RfidScanResult");
                    changedSpy.callCount.should.eql(1);
                } catch (err) {
                    debugLog(err);
                    throw err;
                }
            }
        );
    });

    it("MIEO-2 - a client should not receive opaque structure when monitoring extension objects", async () => {
        const client = OPCUAClient.create({
            requestedSessionTimeout: 10000000,
            endpointMustExist: false
        });

        const subscriptionParameters = {
            publishingEnabled: true,
            requestedLifetimeCount: 10000,
            requestedMaxKeepAliveCount: 100,
            requestedPublishingInterval: publishingInterval
        };
        await client.withSubscriptionAsync(
            endpointUrl,
            subscriptionParameters,
            async (session: ClientSession, subscription: ClientSubscription) => {
                try {
                    await session.readNamespaceArray();
                    const nsAutoId = session.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");
                    const rfidScanEventTypeNodeId = `ns=${nsAutoId};i=1006`;

                    const fields = [
                        "EventType",
                        "SourceName",
                        "EventId",
                        "ReceiveTime",
                        "Severity",
                        "Message",
                        `${nsAutoId}:ScanResult`
                    ];
                    // Create event filter for when changes are detected on the server
                    const eventFilter = constructEventFilter(fields);
                    const monitoringParameters = {
                        discardOldest: true,
                        queueSize: 100,
                        samplingInterval: 0, // when ever changed

                        // tslint:disable-next-line: object-literal-sort-keys
                        filter: eventFilter
                    };

                    const itemToMonitor = {
                        attributeId: AttributeIds.EventNotifier,
                        nodeId: resolveNodeId("ns=0;i=2253") // resolveNodeId("Server")
                    };

                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        itemToMonitor,
                        monitoringParameters,
                        TimestampsToReturn.Both
                    );

                    // subscription.on("item_added",function(monitoredItem){
                    monitoredItem.on("initialized", () => {
                        // tslint:disable-next-line: no-console
                        debugLog(" Initialized !");
                    });

                    const changedSpy = sinon.spy();
                    monitoredItem.on("changed", changedSpy);
                    monitoredItem.on("err", (message: string) => {
                        // tslint:disable-next-line: no-console
                        debugLog("Error", message);
                    });

                    monitoredItem.on("changed", (eventFields: Variant[]) => {
                        for (const eventField of eventFields) {
                            // tslint:disable-next-line: no-console
                            // debugLog(eventField.toString());
                        }
                    });
                    await new Promise<void>((resolve) => {
                        // subscription.on("item_added",function(monitoredItem){
                        monitoredItem.on("initialized", () => {
                            debugLog(" Initialized !");
                            resolve();
                        });
                    });

                    raiseRfidScanEvent();

                    await new Promise<void>((resolve) => monitoredItem.once("changed", () => resolve()));

                    debugLog("changedSpy = ", changedSpy.getCalls().length);

                    // debugLog(changedSpy.firstCall.args[0]);
                    /*RfidScanResult*/
                    changedSpy.firstCall.args[0].should.be.instanceOf(Array);
                    changedSpy.firstCall.args[0][6].dataType.should.eql(DataType.ExtensionObject);
                    changedSpy.firstCall.args[0][6].value.constructor.name.should.eql("RfidScanResult");
                    changedSpy.callCount.should.eql(1);
                } catch (err) {
                    debugLog(err);
                    throw err;
                }
            }
        );
    });
});
