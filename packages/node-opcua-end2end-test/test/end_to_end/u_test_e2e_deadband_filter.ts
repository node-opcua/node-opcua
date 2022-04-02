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
    DataType,
    DataValue,
    DeadbandType,
    ExtensionObject,
    getCurrentClock,
    makeBrowsePath,
    MonitoredItem,
    MonitoredItemNotification,
    MonitoringParametersOptions,
    Namespace,
    NodeIdLike,
    OPCUAClient,
    Range,
    ServerSidePublishEngine,
    StatusCode,
    StatusCodes,
    TimestampsToReturn,
    UAVariable
} from "node-opcua";
import * as sinon from "sinon";

import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const defaultRange = new Range({ low: -1000000, high: 100000 });

function makeValuesOutsideDeadBand(currentValue: number, range: Range, percent: number, count: number): number[] {
    assert(percent >= 0 && percent <= 100);
    const result: number[] = [];
    let value = currentValue;

    const increment = ((range.high - range.low) * percent) / 100 + 1;

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
function makeValuesInsideDeadBand(currentValue: number, range: Range, percent: number, count: number): number[] {
    assert(percent >= 0 && percent <= 100);

    const result: number[] = [];
    let value = currentValue;

    const span = ((range.high - range.low) * percent) / 100.0 - 2.01;
    for (let i = 0; i < count; i++) {
        value = currentValue + Math.ceil((Math.random() - 0.5) * span * 10) / 10;
    }
    debugLog("cv = ", currentValue, result, range, span);
    return result;
}
interface ClientSidePublishEnginePrivate extends ClientSidePublishEngine {
    internalSendPublishRequest(): void;
    suspend(suspend: boolean): void;
}
function getInternalPublishEngine(session: ClientSession): ClientSidePublishEnginePrivate {
    const s: ClientSidePublishEnginePrivate = (session as any).getPublishEngine();
    return s;
}

async function readCurrentValue(session: ClientSession, nodeId: NodeIdLike): Promise<number> {
    const currentDataValue = await session.read({
        attributeId: AttributeIds.Value,
        nodeId
    });
    const currentValue = currentDataValue.value!.value;
    return currentValue;
}
async function writeValue(session: ClientSession, nodeId: NodeIdLike, value: number): Promise<void> {
    await session.write({
        attributeId: AttributeIds.Value,
        nodeId,
        value: {
            value: {
                dataType: "Double",
                value
            }
        }
    });
    debugLog("wrote : value", value);
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
async function pause(delay: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, delay));
}

export function t(test: any) {
    const options = {};

    async function createSession() {
        const client = OPCUAClient.create(options);
        const endpointUrl = test.endpointUrl;
        await client.connect(endpointUrl);
        const session = await client.createSession();

        const publishEngine = getInternalPublishEngine(session);
        publishEngine.timeoutHint = 100000000; // for debugging with ease !
        // make sure we control how PublishRequest are send
        publishEngine.suspend(true);

        // create a subscriptions
        const subscription = ClientSubscription.create(session, {
            publishingEnabled: true,
            requestedLifetimeCount: 20,
            requestedMaxKeepAliveCount: 3,
            requestedPublishingInterval: 100
        });

        return { client, session, subscription, publishEngine };
    }
    interface Connection {
        client: OPCUAClient;
        session: ClientSession;
        subscription: ClientSubscription;
        publishEngine: ClientSidePublishEnginePrivate;
    }
    let s: Connection;
    async function waitForRawNotifications(): Promise<ExtensionObject[]> {
        const { publishEngine, subscription } = s;
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
    async function waitForNotificationsValues(): Promise<{ value: number; statusCode: StatusCode }[]> {
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

    const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
    describe("DBF0", function (this: any) {
        this.timeout(Math.max(200000, this.timeout()));

        let range: Range;
        const nodeId = "ns=1;s=SomeAnalogDataItem2";
        const nodeIdBool = "ns=1;s=SomeBoolean";

        before(() => {
            const addressSpace = test.server.engine.addressSpace as AddressSpace;
            const namespace = test.server.engine.addressSpace.getOwnNamespace() as Namespace;
            const n = namespace.addAnalogDataItem({
                browseName: "SomeAnalogDataItem2",
                componentOf: addressSpace.rootFolder.objects.server,
                dataType: "Double",
                engineeringUnitsRange: { low: -100, high: 200 },
                nodeId: "s=SomeAnalogDataItem2"
            });
            nodeId.should.eql(n.nodeId.toString());
            const n2 = namespace.addVariable({
                browseName: "SomeBoolean",
                componentOf: addressSpace.rootFolder.objects.server,
                dataType: "Boolean",
                nodeId: "s=SomeBoolean"
            });
            nodeIdBool.should.eql(n2.nodeId.toString());
        });
        beforeEach(async () => {
            const addressSpace = test.server.engine.addressSpace as AddressSpace;
            const n = addressSpace.findNode(nodeId)! as UAVariable;
            n.setValueFromSource({ dataType: "Double", value: 145.0 }, StatusCodes.Good);

            const n2 = addressSpace.findNode(nodeIdBool)! as UAVariable;
            n2.setValueFromSource({ dataType: DataType.Boolean, value: true }, StatusCodes.Good);

            s = await createSession();
            range = await readVariableRange(s.session, nodeId);
        });
        afterEach(async () => {
            await s.subscription.terminate();
            await s.session.close();
            await s.client.disconnect();
        });
        const changeSpy = sinon.spy();
        async function createMonitoredItem(
            nodeId: NodeIdLike,
            requestedParameters: MonitoringParametersOptions
        ): Promise<ClientMonitoredItem> {
            const { session, subscription, publishEngine } = s as Connection;

            const readValue = {
                attributeId: AttributeIds.Value,
                nodeId
            };
            // const monitoredItem = ClientMonitoredItem.create(subscription, readValue, requestedParameters, TimestampsToReturn.Both);
            const monitoredItem = await subscription.monitor(readValue, requestedParameters, TimestampsToReturn.Both);

            await new Promise((resolve: any) => {
                // wait for fist notification
                monitoredItem.once("changed", (dataValue) => {
                    // tslint:disable-next-line: no-console
                    debugLog("got initial value !!! ", dataValue.value.value);
                    resolve();
                });
                s.publishEngine.internalSendPublishRequest();
            });

            monitoredItem.on("changed", changeSpy);
            // debugLog("Started !");
            return monitoredItem;
        }
        async function setValueAndStatusCode(
            nodeId: NodeIdLike,
            dataType: DataType,
            value: number | boolean,
            statusCode: StatusCode
        ) {
            const { session } = s;
            const dataValue = new DataValue({
                value: { dataType, value }
            });
            dataValue.sourceTimestamp = getCurrentClock().timestamp;
            dataValue.serverTimestamp = getCurrentClock().timestamp;
            dataValue.statusCode = statusCode;
            dataValue.value.value = value;
            {
                const statusCode = await session.write({
                    attributeId: AttributeIds.Value,
                    nodeId,
                    value: dataValue
                });
                statusCode.should.eql(StatusCodes.Good);
            }
        }
        async function waitUntilKeepAlive(publishEngine: ClientSidePublishEngine, subscription: ClientSubscription) {
            publishEngine.internalSendPublishRequest();
            publishEngine.internalSendPublishRequest();
            publishEngine.internalSendPublishRequest();
            // wait until next keep alive
            await new Promise<void>((resolve) => {
                subscription.once("keepalive", () => resolve());
            });
        }
        it("DBF1: DeadBandFilter filter: none, trigger: Status - it should not received notification when trigger is status and value change", async () => {
            const { session, subscription, publishEngine } = s;

            const requestedParameters = {
                discardOldest: true,
                filter: new DataChangeFilter({
                    deadbandType: DeadbandType.None,
                    trigger: DataChangeTrigger.Status
                }), // FILTER !

                queueSize: 4,
                samplingInterval: 0
            };
            await createMonitoredItem(nodeId, requestedParameters);

            const changeNotificationCount1 = changeSpy.callCount;
            await setValueAndStatusCode(nodeId, DataType.Double, 145, StatusCodes.BadAggregateConfigurationRejected);

            await waitUntilKeepAlive(publishEngine, subscription);

            const changeNotificationCount2 = changeSpy.callCount;
            changeNotificationCount2.should.eql(changeNotificationCount1 + 1, "must have received a changed notification");

            // now change the value without changing the status
            await setValueAndStatusCode(nodeId, DataType.Double, 200, StatusCodes.BadAggregateConfigurationRejected);

            // wait until next keep alive
            await waitUntilKeepAlive(publishEngine, subscription);

            const changeNotificationCount3 = changeSpy.callCount;
            changeNotificationCount3.should.eql(changeNotificationCount2, "must NOT have received a changed notification");
        });
        /*
            Description:
            -  Create one monitored item with Filter =
                    DataChangeFilter( deadbandType = None, trigger = StatusValue ).
            - call Publish().
            - Write a value to the Value attribute.
            - call Publish().
            - Write a status code to the Value attribute
              (don’t change the value of the Value attribute).
            - call Publish().
              Write the existing value and status code to the Value attribute.
            - call Publish().
            Expected results:
            -All service and operation level results are Good.
            - The second Publish contains a DataChangeNotification with a value.value matching the
              written value.
            - The third Publish contains a DataChangeNotification with a value.statusCode matching the
              written value (and value.value matching the value before the write).
            -The fourth Publish contains no DataChangeNotifications.
            */
        it("DBF2: DeadBandFilter filter: none, trigger: StatusValue, (Double) it should not received notification when trigger is status and value change", async () => {
            const { session, subscription, publishEngine } = s;
            const requestedParameters = {
                discardOldest: true,
                filter: new DataChangeFilter({
                    deadbandType: DeadbandType.None,
                    deadbandValue: 0,
                    trigger: DataChangeTrigger.StatusValue
                }), // FILTER !

                queueSize: 4,
                samplingInterval: 0
            };

            await createMonitoredItem(nodeId, requestedParameters);

            const dataValue = await session.read({ nodeId, attributeId: AttributeIds.Value });
            dataValue.statusCode.should.eql(StatusCodes.Good);
            dataValue.value.value.should.eql(145);

            const changeNotificationCount1 = changeSpy.callCount;
            await setValueAndStatusCode(nodeId, DataType.Double, 145, StatusCodes.GoodClamped);

            await waitUntilKeepAlive(publishEngine, subscription);

            const changeNotificationCount2 = changeSpy.callCount;
            changeNotificationCount2.should.eql(changeNotificationCount1 + 1, "must have received a changed notification");

            const dataValue2 = changeSpy.getCall(changeNotificationCount2 - 1).firstArg;
            dataValue2.statusCode.should.eql(StatusCodes.GoodClamped);
            dataValue2.value.value.should.eql(145);

            // now change the value without changing the status
            await setValueAndStatusCode(nodeId, DataType.Double, 1000, StatusCodes.GoodClamped);

            await waitUntilKeepAlive(publishEngine, subscription);

            const changeNotificationCount3 = changeSpy.callCount;
            changeNotificationCount3.should.eql(changeNotificationCount2 + 1, "must have received a changed notification");

            const dataValue3 = changeSpy.getCall(changeNotificationCount3 - 1).firstArg;
            dataValue3.statusCode.should.eql(StatusCodes.GoodClamped);
            dataValue3.value.value.should.eql(1000);
        });
        it("DBF3: DeadBandFilter filter: none, trigger: StatusValue, (Bool) it should not received notification when trigger is status and value change", async () => {
            const { session, subscription, publishEngine } = s;
            const requestedParameters = {
                discardOldest: true,
                filter: new DataChangeFilter({
                    deadbandType: DeadbandType.None,
                    deadbandValue: 0,
                    trigger: DataChangeTrigger.StatusValue
                }), // FILTER !

                queueSize: 4,
                samplingInterval: 0
            };

            await createMonitoredItem(nodeIdBool, requestedParameters);

            const dataValue = await session.read({ nodeId: nodeIdBool, attributeId: AttributeIds.Value });
            dataValue.statusCode.should.eql(StatusCodes.Good);
            dataValue.value.value.should.eql(true);

            const changeNotificationCount1 = changeSpy.callCount;
            await setValueAndStatusCode(nodeIdBool, DataType.Boolean, false, StatusCodes.GoodClamped);

            await waitUntilKeepAlive(publishEngine, subscription);

            const changeNotificationCount2 = changeSpy.callCount;
            changeNotificationCount2.should.eql(changeNotificationCount1 + 1, "must have received a changed notification");

            const dataValue2 = changeSpy.getCall(changeNotificationCount2 - 1).firstArg;
            dataValue2.statusCode.should.eql(StatusCodes.GoodClamped);
            dataValue2.value.value.should.eql(false);

            // now change the value without changing the status
            await setValueAndStatusCode(nodeIdBool, DataType.Boolean, true, StatusCodes.GoodClamped);

            await waitUntilKeepAlive(publishEngine, subscription);

            const changeNotificationCount3 = changeSpy.callCount;
            changeNotificationCount3.should.eql(changeNotificationCount2 + 1, "must have received a changed notification");

            const dataValue3 = changeSpy.getCall(changeNotificationCount3 - 1).firstArg;
            dataValue3.statusCode.should.eql(StatusCodes.GoodClamped);
            dataValue3.value.value.should.eql(true);

            // now writing same data again
            await setValueAndStatusCode(nodeIdBool, DataType.Boolean, true, StatusCodes.GoodClamped);

            publishEngine.internalSendPublishRequest();
            publishEngine.internalSendPublishRequest();
            // wait until next keep alive
            await new Promise<void>((resolve) => {
                subscription.once("keepalive", () => resolve());
            });

            const changeNotificationCount4 = changeSpy.callCount;
            changeNotificationCount4.should.eql(changeNotificationCount3, "must NOT receive a changed notification");
        });

        it("DBF4- Testing DeadBandFilter associated with monitoring queue - check dead band filter 1", async () => {
            const percent = 10.0;
            const requestedParameters = {
                discardOldest: true,
                filter: new DataChangeFilter({
                    deadbandType: DeadbandType.Percent,
                    deadbandValue: percent,
                    trigger: DataChangeTrigger.StatusValue
                }), // FILTER !
                queueSize: 4,
                samplingInterval: 0
            };
            await createMonitoredItem(nodeId, requestedParameters);

            const { session } = s;

            // read dataValue
            const currentValue = await readCurrentValue(session, nodeId);
            // tslint:disable-next-line: no-console
            const values = makeValuesOutsideDeadBand(currentValue, range, percent, 5);

            for (const value of values) {
                await writeValue(session, nodeId, value);
                await pause(200);
            }

            const notifiedValues1 = await waitForNotificationsValues();
            notifiedValues1[0].value = values[1];
            notifiedValues1[1].value = values[2];
            notifiedValues1[2].value = values[3];
            notifiedValues1[3].value = values[4];

            // 4 in the queue => Oldest has been discarded !
            notifiedValues1[0].statusCode.toString().should.eql("Good#InfoTypeDataValue|Overflow (0x00000480)");
            notifiedValues1[1].statusCode.toString().should.eql("Good (0x00000000)");
            notifiedValues1[2].statusCode.toString().should.eql("Good (0x00000000)");
            notifiedValues1[3].statusCode.toString().should.eql("Good (0x00000000)");

            // now send value that are within dead band
            const currentValue1 = await readCurrentValue(session, nodeId);
            const valuesInside = makeValuesInsideDeadBand(currentValue1, range, percent, 5);
            for (const value of valuesInside) {
                await writeValue(session, nodeId, value);
                await pause(200);
            }
            // we should receive a empty notification
            const notifiedValues2 = await waitForNotificationsValues();
            notifiedValues2.should.eql([]);
        });
    });
}
