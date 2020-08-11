// tslint:disable: no-shadowed-variable
// tslint:disable: no-console
import {
    AddressSpace,
    assert,
    AttributeIds,
    ClientMonitoredItem,
    ClientSession,
    ClientSidePublishEngine,
    ClientSubscription,
    DataChangeFilter,
    DataChangeNotification,
    DataChangeTrigger,
    DeadbandType,
    ExtensionObject,
    makeBrowsePath,
    MonitoredItem,
    MonitoredItemNotification,
    Namespace,
    NodeIdLike,
    OPCUAClient,
    Range,
    StatusCode,
    StatusCodes,
    TimestampsToReturn,
    WriteValue,
} from "node-opcua";
import * as sinon from "sinon";

function debugLog(...args: any[]) {
    /* empty */
}
const defaultRange = new Range({ low: -1000000, high: 100000 });

function makeValuesOutsideDeadBand(
    currentValue: number, range: Range, percent: number, count: number
): number[] {
    assert(percent >= 0 && percent <= 100);
    const result: number[] = [];
    let value = currentValue;

    const increment = (range.high - range.low) * percent / 100 + 1;

    for (let i = 0; i < count; i++) {
        value = value + increment;
        if (value > range.high) {
            value = range.low + 1;
        }
        result.push(value);
    }
    debugLog("cv = ", currentValue, result);
    return result;
}
function makeValuesInsideDeadBand(
    currentValue: number, range: Range, percent: number, count: number
): number[] {
    assert(percent >= 0 && percent <= 100);
    const result: number[] = [];
    let value = currentValue;

    const span = (range.high - range.low) * percent / 100.0 - 2.01;
    for (let i = 0; i < count; i++) {
        value = currentValue + Math.ceil((Math.random() - 0.5) * span * 10) / 10;
    }
    debugLog("cv = ", currentValue, result, range, span);
    return result;
}

/**
 * @param {ClientSession} session
 * @param {NodeId} nodeId
 */
async function readVariableRange(session: ClientSession, nodeId: NodeIdLike): Promise<Range> {
    const browsePath = makeBrowsePath(nodeId, ".EURange");
    const result = await session.translateBrowsePath(browsePath);
    if (!result.targets || result.statusCode !== StatusCodes.Good) {
        return defaultRange;
    }
    const euRangeNodeId = result.targets[0].targetId;

    const dataValue = await session.read({ nodeId: euRangeNodeId, attributeId: AttributeIds.Value });
    if (dataValue.statusCode !== StatusCodes.Good) {
        return defaultRange;
    }
    return dataValue.value.value as Range;
}
export function t(test: any) {

    describe("Testing DeadBandFilter associated with monitoring queue", function (this: any) {

        const options = {};

        this.timeout(Math.max(200000, this.timeout()));

        let client: OPCUAClient;
        let endpointUrl: string;
        let session: ClientSession;
        let subscription: ClientSubscription;
        let monitoredItem: ClientMonitoredItem;
        let range: Range;

        const variableWithRange = "ns=1;s=Int32AnalogDataItem";
        const percent = 10.0;
        before(() => {
            const addressSpace = test.server.engine.addressSpace as AddressSpace;
            const namespace = test.server.engine.addressSpace.getOwnNamespace() as Namespace;
            const n = namespace.addAnalogDataItem({
                browseName: "Int32AnalogDataItem",
                componentOf: addressSpace.rootFolder.objects.server,
                dataType: "Double",
                engineeringUnitsRange: { low: -100, high: 200 },
                nodeId: "s=Int32AnalogDataItem",
            });
            variableWithRange.should.eql(n.nodeId.toString());
            n.setValueFromSource({ dataType: "Double", value: 145.0 });
        });

        const changeSpy = sinon.spy();
        beforeEach(async () => {
            client = OPCUAClient.create(options);

            endpointUrl = test.endpointUrl;
            await client.connect(endpointUrl);
            session = await client.createSession();

            // create a subscriptions
            subscription = ClientSubscription.create(session, {
                publishingEnabled: true,
                requestedLifetimeCount: 1000,
                requestedMaxKeepAliveCount: 20,
                requestedPublishingInterval: 100,
            });

            const publishEngine = (session as any).getPublishEngine();
            // make sure we control how PublishRequest are send
            publishEngine.suspend(true);

            range = await readVariableRange(session, variableWithRange);

            const readValue = {
                attributeId: AttributeIds.Value,
                nodeId: variableWithRange,
            };
            const requestedParameters = {
                discardOldest: true,
                filter: new DataChangeFilter({
                    deadbandType: DeadbandType.Percent,
                    deadbandValue: percent,
                    trigger: DataChangeTrigger.StatusValue,
                }), // FILTER !
                queueSize: 4,
                samplingInterval: 0,
            };
            monitoredItem = ClientMonitoredItem.create(subscription, readValue, requestedParameters, TimestampsToReturn.Both);

            publishEngine.internalSendPublishRequest();

            await new Promise((resolve: any) => {
                // wait for fist notification
                monitoredItem.once("changed", (dataValue) => {
                    // tslint:disable-next-line: no-console
                    debugLog("got initial value !!! ", dataValue.value.value);
                    resolve();
                });
            });

            monitoredItem.on("changed", changeSpy);
            // debugLog("Started !");
        });
        afterEach(async () => {
            await subscription.terminate();
            await session.close();
            await client.disconnect();
        });

        async function readCurrentValue(): Promise<number> {
            const currentDataValue = await session.read({
                attributeId: AttributeIds.Value,
                nodeId: variableWithRange,
            });
            const currentValue = currentDataValue.value!.value;
            return currentValue;
        }
        async function writeValue(value: number): Promise<void> {
            await session.write({
                attributeId: AttributeIds.Value,
                nodeId: variableWithRange,
                value: {
                    value: {
                        dataType: "Double",
                        value
                    }
                }
            });
            debugLog("wrote : value", value);
        }

        async function pause(delay: number): Promise<void> {
            await new Promise((resolve) => setTimeout(resolve, delay));
        }

        it("DBF1 - check dead band filter 1", async () => {

            async function waitForRawNotifications(): Promise<ExtensionObject[]> {
                publishEngine.internalSendPublishRequest();
                return await new Promise((resolve: (result: ExtensionObject[]) => void) => {
                    // wait for fist notification
                    subscription.once("raw_notification", (notificationMessage: any) => {
                        // tslint:disable-next-line: no-console
                        debugLog("got notification message ", notificationMessage.toString());
                        resolve(notificationMessage.notificationData);
                    });
                });
            }
            async function waitForNotificationsValues(): Promise<Array<{ value: number, statusCode: StatusCode }>> {
                while (true) {
                    const notificationData1 = await waitForRawNotifications();
                    if (notificationData1.length > 0) {
                        const dcn = notificationData1[0] as DataChangeNotification;
                        const r = dcn.monitoredItems!.map((item: MonitoredItemNotification) => ({
                            statusCode: item.value.statusCode,
                            value: item.value.value.value
                        }));
                        return r;
                    }
                    // tslint:disable-next-line: no-console
                    debugLog(" ------- skipping empty publish response");
                    return [];
                }
            }

            const publishEngine = (session as any).getPublishEngine();

            // read dataValue
            const currentValue = await readCurrentValue();
            // tslint:disable-next-line: no-console
            const values = makeValuesOutsideDeadBand(currentValue, range, percent, 5);

            console.log("currentValue", currentValue, values);
            for (const value of values) {
                await writeValue(value);
                await pause(200);
            }

            const notifiedValues1 = await waitForNotificationsValues();
            notifiedValues1[0].value = values[1];
            notifiedValues1[1].value = values[2];
            notifiedValues1[2].value = values[3];
            notifiedValues1[3].value = values[4];

            // 4 in the queue => Oldest has been discarded !
            notifiedValues1[0].statusCode.toString().should.eql("Good#InfoTypeDataValue|Overflow (0x0000480)");
            notifiedValues1[1].statusCode.toString().should.eql("Good (0x00000)");
            notifiedValues1[2].statusCode.toString().should.eql("Good (0x00000)");
            notifiedValues1[3].statusCode.toString().should.eql("Good (0x00000)");

            // now send value that are within dead band
            const currentValue1 = await readCurrentValue();
            const valuesInside = makeValuesInsideDeadBand(currentValue1, range, percent, 5);
            console.log("currentValue", currentValue1, valuesInside);
            for (const value of valuesInside) {
                await writeValue(value);
                await pause(200);
            }
            // we should receive a empty notification
            const notifiedValues2 = await waitForNotificationsValues();
            notifiedValues2.should.eql([]);

        });
    });
}
