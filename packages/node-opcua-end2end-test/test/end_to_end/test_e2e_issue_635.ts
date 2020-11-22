import * as chalk from "chalk";
import {
    AddressSpace,
    AttributeIds,
    CallbackT,
    ClientSubscription,
    DataType,
    DataValue,
    OPCUAClient,
    OPCUAServer,
    ReadValueIdOptions,
    StatusCodes,
    TimestampsToReturn,
    UAVariable,
    Variant
} from "node-opcua";
import { should } from "should";

const _should = should;

let timer1: any;
let _variableNode2: UAVariable;
let _variableNode1: UAVariable;

// tslint:disable:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing bug #635", () => {
    function createAddressSpace(addressSpace: AddressSpace) {
        const namespace = addressSpace.getOwnNamespace();

        const device = namespace.addObject({
            browseName: "MyDevice",
            organizedBy: addressSpace.rootFolder.objects
        });

        // add some variables
        // add a variable named MyVariable1 to the newly created folder "MyDevice"
        let variable1 = "ciao";
        let quality1 = StatusCodes.Good;
        let ts1 = new Date();

        let variable2 = 1;
        let quality2 = StatusCodes.Good;
        let ts2 = new Date();

        // emulate variable1 changing every 500 ms
        timer1 = setInterval(() => {
            if (variable1 === "ciao") {
                variable1 = "addio";
                quality1 = StatusCodes.Bad;
            } else {
                variable1 = "ciao";
                quality1 = StatusCodes.Good;
            }
            ts1 = new Date();

            if (variable2 === 1) {
                variable2 = 2;
                quality2 = StatusCodes.Bad;
            } else {
                variable2 = 1;
                quality2 = StatusCodes.Good;
            }
            ts2 = new Date();
        }, 500);

        const variableNode1 = namespace.addVariable({
            browseName: "MyVariable1",
            componentOf: device,
            dataType: "String",
            nodeId: "ns=1;s=MyVariable1",
            value: {
                timestamped_get: (callback: CallbackT<DataValue>) => {
                    setTimeout(() => {
                        const myDataValue = new DataValue({
                            serverPicoseconds: 0,
                            serverTimestamp: ts1,
                            sourcePicoseconds: 0,
                            sourceTimestamp: ts1,
                            statusCode: quality1,
                            value: new Variant({ dataType: DataType.String, value: variable1 })
                        });
                        callback(null, myDataValue);
                    }, 1);
                }
            }
        });

        const variableNode2 = namespace.addVariable({
            browseName: "MyVariable2",
            componentOf: device,
            dataType: "UInt32",
            nodeId: "ns=1;s=MyVariable2",
            value: {
                timestamped_get: () => {
                    const myDataValue = new DataValue({
                        serverPicoseconds: 0,
                        serverTimestamp: ts2,
                        sourcePicoseconds: 0,
                        sourceTimestamp: ts2,
                        statusCode: quality2,
                        value: new Variant({ dataType: DataType.UInt32, value: variable2 })
                    });
                    return myDataValue;
                }
            }
        });
        _variableNode1 = variableNode1;
        _variableNode2 = variableNode2;
        // console.log("variable 1 = ", variableNode1.nodeId.toString());
        // console.log("variable 2 = ", variableNode2.nodeId.toString());
    }

    const port = 2222;
    let server: OPCUAServer;
    let endpointUrl: string;
    before(async () => {
        server = new OPCUAServer({ port });
        await server.initialize();
        createAddressSpace(server.engine.addressSpace!);
        let endpoints = server._get_endpoints(null);
        endpointUrl = endpoints[0].endpointUrl!;
        await server.start();
    });
    after(async () => {
        clearInterval(timer1);
        await server.shutdown();
    });

    it("should handle statusCode according to specification when monitoring a String Variable", async () => {
        // user1/password1

        const client = OPCUAClient.create({
            endpoint_must_exist: false,
            requestedSessionTimeout: 60000
        });

        await client.connect(endpointUrl);
        const session = await client.createSession();

        const parameters = {
            maxNotificationsPerPublish: 100,
            priority: 10,
            publishingEnabled: true,
            requestedLifetimeCount: 1000,
            requestedMaxKeepAliveCount: 120,
            requestedPublishingInterval: 200
        };

        let subscription: ClientSubscription;

        subscription = await session.createSubscription2(parameters);

        const monitoringParameters = {
            discardOldest: true,
            queueSize: 100,
            samplingInterval: 50
        };

        const data: DataValue[] = [];

        const itemToMonitor1: ReadValueIdOptions = {
            attributeId: AttributeIds.Value,
            nodeId: "ns=1;s=MyVariable1"
        };
        const monitoringItem1 = await subscription.monitor(itemToMonitor1, monitoringParameters, TimestampsToReturn.Both);
        monitoringItem1.on("changed", (dataValue: DataValue) => {
            data.push(new DataValue(dataValue));
        });

        const itemToMonitor2: ReadValueIdOptions = {
            attributeId: AttributeIds.Value,
            nodeId: "ns=1;s=MyVariable2"
        };
        const monitoringItem2 = await subscription.monitor(itemToMonitor2, monitoringParameters, TimestampsToReturn.Both);
        monitoringItem2.on("changed", (dataValue: DataValue) => {
            data.push(new DataValue(dataValue));
        });

        await new Promise((resolve) => setTimeout(resolve, 5000));

        await subscription.terminate();
        await session.close();
        await client.disconnect();

        // perform some test now
        // 1 => Good
        // "Ciao" => Good
        // 2 => Bad
        // "Addio" => Bad
        let errorCount = 0;
        for (const dataValue of data) {
            let correctness = false;
            if ((dataValue.value.value === 1 || dataValue.value.value === "ciao") && dataValue.statusCode === StatusCodes.Good) {
                correctness = true;
            }
            if ((dataValue.value.value === 2 || dataValue.value.value === "addio") && dataValue.statusCode === StatusCodes.Bad) {
                correctness = true;
            }
            if (correctness) {
                // console.log(chalk.green(`value = ${dataValue.value.value} statusCode = ${dataValue.statusCode.toString()}`));
            } else {
                console.log(chalk.red(`value = ${dataValue.value.value} statusCode = ${dataValue.statusCode.toString()}`));
                errorCount += 1;
            }
        }
        errorCount.should.eql(0, "should not have no statusCode mismatch");
    });
});
