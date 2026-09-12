import {
    AttributeIds,
    type ClientSession,
    type ClientSessionPublishService,
    type ClientSessionRawSubscriptionService,
    CreateMonitoredItemsRequest,
    DataChangeFilter,
    type DataChangeNotification,
    DataChangeTrigger,
    DataType,
    DataValue,
    DeadbandType,
    type MonitoredItemNotification,
    MonitoringMode,
    MonitoringParameters,
    makeBrowsePath,
    type NodeIdLike,
    OPCUAClient,
    PublishRequest,
    type PublishResponse,
    Range,
    ReadValueId,
    StatusCodes,
    TimestampsToReturn
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import { perform_operation_on_raw_subscription } from "../../test_helpers/perform_operation_on_client_session.js";

interface TestHarness {
    endpointUrl: string;
}

const doDebug = false;

// createMonitoredItems/publish are deliberately excluded from the public ClientSession
// type (superseded by createSubscription2/ClientMonitoredItemGroup); these tests exercise
// the raw low-level service directly.
type RawSession = ClientSession & ClientSessionRawSubscriptionService & ClientSessionPublishService;

async function translateBrowsePathToFirstTarget(session: ClientSession, nodeId: string, relativePath: string) {
    const browsePath = [makeBrowsePath(nodeId, relativePath)];
    const results = await session.translateBrowsePath(browsePath);
    return results[0].targets![0].targetId;
}

async function getEURangeNodeId(session: ClientSession, nodeId: string): Promise<NodeIdLike> {
    return await translateBrowsePathToFirstTarget(session, nodeId, ".EURange");
}

async function readValue(session: ClientSession, nodeId: NodeIdLike) {
    const dv = await session.read({ nodeId, attributeId: AttributeIds.Value });
    return dv.value.value;
}

async function writeValue(session: ClientSession, nodeId: NodeIdLike, value: unknown, dataType = DataType.Double) {
    const statusCode = await session.write({
        nodeId,
        attributeId: AttributeIds.Value,
        value: new DataValue({ value: { dataType, value } })
    });
    statusCode.should.eql(StatusCodes.Good);
}

async function readEURange(session: ClientSession, nodeId: string) {
    const euRangeNodeId = await getEURangeNodeId(session, nodeId);
    const dv = await session.read({ nodeId: euRangeNodeId, attributeId: AttributeIds.Value });
    return dv.value.value;
}

async function writeEURange(session: ClientSession, nodeId: string, euRange: { low: number; high: number }) {
    const euRangeNodeId = await getEURangeNodeId(session, nodeId);
    await writeValue(session, euRangeNodeId, new Range(euRange), DataType.ExtensionObject);
}

async function incrementAnalog(session: ClientSession, nodeId: string) {
    const current = await readValue(session, nodeId);
    await writeValue(session, nodeId, current + 1, DataType.Double);
}

async function getNextDataChangeNotification(session: ClientSession): Promise<MonitoredItemNotification> {
    const request = new PublishRequest({ requestHeader: { timeoutHint: 100000 }, subscriptionAcknowledgements: [] });
    return await new Promise<MonitoredItemNotification>((resolve, reject) => {
        (session as RawSession).publish(request, (err: Error | null, response?: PublishResponse) => {
            if (err) return reject(err);
            try {
                const dataChangeNotification = response!.notificationMessage.notificationData![0] as DataChangeNotification;
                const monitoredData = dataChangeNotification.monitoredItems![0];
                if (doDebug) console.log(monitoredData.toString());
                resolve(monitoredData);
            } catch (e) {
                reject(e);
            }
        });
    });
}

/**
 * the next data change, or null when the subscription answers with a keep-alive - which is what
 * "nothing more to report" looks like on the wire. Used to assert the absence of a notification.
 */
async function getNextDataChangeNotificationOrKeepAlive(session: ClientSession): Promise<MonitoredItemNotification | null> {
    const request = new PublishRequest({ requestHeader: { timeoutHint: 100000 }, subscriptionAcknowledgements: [] });
    return await new Promise<MonitoredItemNotification | null>((resolve, reject) => {
        (session as RawSession).publish(request, (err: Error | null, response?: PublishResponse) => {
            if (err) return reject(err);
            const notificationData = response!.notificationMessage.notificationData;
            if (!notificationData || notificationData.length === 0) return resolve(null);
            const dataChangeNotification = notificationData[0] as DataChangeNotification;
            const monitoredItems = dataChangeNotification.monitoredItems;
            resolve(monitoredItems && monitoredItems.length > 0 ? monitoredItems[0] : null);
        });
    });
}

export function t(test: TestHarness) {
    describe("SemanticChanged bit behaviour", () => {
        let client: OPCUAClient;

        let _endpointUrl = test.endpointUrl;

        beforeEach(() => {
            client = OPCUAClient.create({});
            _endpointUrl = test.endpointUrl;
        });
        afterEach(async () => {
            if (client) await client.disconnect();
        });

        async function checkSemanticChange(samplingInterval: number) {
            const analogNodeId = "ns=2;s=DoubleAnalogDataItem";

            await perform_operation_on_raw_subscription(
                client,
                test.endpointUrl,

                async (session, { subscriptionId }) => {
                    const orgEURange = await readEURange(session, analogNodeId);

                    // Create monitored item
                    const itemToMonitor = new ReadValueId({
                        attributeId: AttributeIds.Value,
                        nodeId: analogNodeId
                    });

                    // #region create monitored item
                    const monitoringParameters = new MonitoringParameters({
                        clientHandle: 1000,
                        samplingInterval,
                        filter: null,
                        queueSize: 100,
                        discardOldest: true
                    });

                    const createReq = new CreateMonitoredItemsRequest({
                        subscriptionId,
                        timestampsToReturn: TimestampsToReturn.Neither,
                        itemsToCreate: [
                            {
                                itemToMonitor,
                                monitoringMode: MonitoringMode.Reporting,
                                requestedParameters: monitoringParameters
                            }
                        ]
                    });

                    const createMonitoredItemResponse = await (session as RawSession).createMonitoredItems(createReq);
                    console.log(createMonitoredItemResponse.toString());
                    //#endregion

                    // Initial notification: semanticChanged should be false
                    const firstNotif = await getNextDataChangeNotification(session);
                    firstNotif.value.statusCode.hasSemanticChangedBit.should.eql(false);

                    // Modify EURange
                    await writeEURange(session, analogNodeId, { low: orgEURange.low - 1, high: orgEURange.high + 1 });
                    const secondNotif = await getNextDataChangeNotification(session);
                    secondNotif.value.statusCode.hasSemanticChangedBit.should.eql(true);

                    // Change value again (no further semantic change)
                    await incrementAnalog(session, analogNodeId);
                    const thirdNotif = await getNextDataChangeNotification(session);
                    thirdNotif.value.statusCode.hasSemanticChangedBit.should.eql(false);

                    // restore
                    await writeEURange(session, analogNodeId, orgEURange);
                }
            );
        }

        /**
         * CTT Data Access AnalogItemType 008: the item carries an absolute deadband of 10 and the
         * initial data change has already been consumed, so nothing but the semantic change can
         * produce the notification the script then publishes for. The DataChangeFilter must not
         * swallow it, and it has to be produced although the value itself never changed.
         */
        it("YY4 semanticChanged reaches an item with a deadband filter and no value change", async () => {
            const analogNodeId = "ns=2;s=DoubleAnalogDataItem";

            await perform_operation_on_raw_subscription(client, test.endpointUrl, async (session, { subscriptionId }) => {
                const orgEURange = await readEURange(session, analogNodeId);

                const createReq = new CreateMonitoredItemsRequest({
                    subscriptionId,
                    timestampsToReturn: TimestampsToReturn.Both,
                    itemsToCreate: [
                        {
                            itemToMonitor: new ReadValueId({ attributeId: AttributeIds.Value, nodeId: analogNodeId }),
                            monitoringMode: MonitoringMode.Reporting,
                            requestedParameters: new MonitoringParameters({
                                clientHandle: 1001,
                                samplingInterval: 100,
                                queueSize: 10,
                                discardOldest: true,
                                filter: new DataChangeFilter({
                                    trigger: DataChangeTrigger.StatusValue,
                                    deadbandType: DeadbandType.Absolute,
                                    deadbandValue: 10
                                })
                            })
                        }
                    ]
                });
                const createResponse = await (session as RawSession).createMonitoredItems(createReq);
                should(createResponse.results?.[0].statusCode).eql(StatusCodes.Good);

                // consume the initial data change, as the script does
                const firstNotif = await getNextDataChangeNotification(session);
                firstNotif.value.statusCode.hasSemanticChangedBit.should.eql(false);

                await writeEURange(session, analogNodeId, { low: orgEURange.low + 1, high: orgEURange.high - 1 });

                const secondNotif = await getNextDataChangeNotification(session);
                secondNotif.value.statusCode.hasSemanticChangedBit.should.eql(true);

                await writeEURange(session, analogNodeId, orgEURange);
            });
        });

        /**
         * CTT Data Access Semantic Changes 003/004/005/010/013, to the letter: the script creates
         * the monitored item, writes the Property and publishes ONCE - it never consumes the
         * initial data change first, and it reads the bit off MonitoredItems[0]. So the very first
         * notification the client receives, the queued initial value, is the one that has to carry
         * it: OPC 10000-4 7.39's "next notification" is the next one *the client sees*.
         */
        it("YY5 the first notification carries the bit when the initial value is still queued", async () => {
            const analogNodeId = "ns=2;s=ByteAnalogDataItem";

            await perform_operation_on_raw_subscription(client, test.endpointUrl, async (session, { subscriptionId }) => {
                const orgEURange = await readEURange(session, analogNodeId);

                const createResponse = await (session as RawSession).createMonitoredItems(
                    new CreateMonitoredItemsRequest({
                        subscriptionId,
                        timestampsToReturn: TimestampsToReturn.Server,
                        itemsToCreate: [
                            {
                                itemToMonitor: new ReadValueId({ attributeId: AttributeIds.Value, nodeId: analogNodeId }),
                                monitoringMode: MonitoringMode.Reporting,
                                requestedParameters: new MonitoringParameters({
                                    clientHandle: 1002,
                                    samplingInterval: 500,
                                    queueSize: 10,
                                    discardOldest: true,
                                    filter: null
                                })
                            }
                        ]
                    })
                );
                should(createResponse.results?.[0].statusCode).eql(StatusCodes.Good);

                // no initial publish here: the write happens while the initial value is still queued
                await writeEURange(session, analogNodeId, { low: orgEURange.low + 1, high: orgEURange.high - 1 });

                const firstNotif = await getNextDataChangeNotification(session);
                should(firstNotif.value.statusCode.hasSemanticChangedBit).eql(true);

                await writeEURange(session, analogNodeId, orgEURange);
            });
        });

        /**
         * A semantic change stamps one notification; it must not also manufacture a second,
         * bit-less one for a value that never changed. The bit used to be recorded in the item's
         * oldDataValue - the baseline the next sample is compared against - so that sample differed
         * by StatusCode alone and was reported as a data change. CTT Data Access AnalogItemType 008
         * and Semantic Changes 010/013/014-017 read MonitoredItems[0] of the publish that follows,
         * and got that duplicate rather than the stamped notification.
         */
        it("YY6 a semantic change produces exactly one notification, not a bit-less duplicate", async () => {
            const analogNodeId = "ns=2;s=DoubleAnalogDataItem";

            await perform_operation_on_raw_subscription(client, test.endpointUrl, async (session, { subscriptionId }) => {
                const orgEURange = await readEURange(session, analogNodeId);

                const createResponse = await (session as RawSession).createMonitoredItems(
                    new CreateMonitoredItemsRequest({
                        subscriptionId,
                        timestampsToReturn: TimestampsToReturn.Both,
                        itemsToCreate: [
                            {
                                itemToMonitor: new ReadValueId({ attributeId: AttributeIds.Value, nodeId: analogNodeId }),
                                monitoringMode: MonitoringMode.Reporting,
                                requestedParameters: new MonitoringParameters({
                                    clientHandle: 1003,
                                    samplingInterval: 100,
                                    // the queue size the CTT asks for: a duplicate does not merely
                                    // follow the stamped notification, it replaces it
                                    queueSize: 1,
                                    discardOldest: true,
                                    filter: null
                                })
                            }
                        ]
                    })
                );
                should(createResponse.results?.[0].statusCode).eql(StatusCodes.Good);

                // drain the initial value, so the semantic change is the only thing left to report
                const initial = await getNextDataChangeNotification(session);
                should(initial.value.statusCode.hasSemanticChangedBit).eql(false);

                await writeEURange(session, analogNodeId, { low: orgEURange.low + 1, high: orgEURange.high - 1 });

                const stamped = await getNextDataChangeNotification(session);
                should(stamped.value.statusCode.hasSemanticChangedBit).eql(true);

                // the value itself never changed, so nothing more is due
                const extra = await getNextDataChangeNotificationOrKeepAlive(session);
                should(extra).eql(null, "a semantic change must not report a second data change");

                await writeEURange(session, analogNodeId, orgEURange);
            });
        });

        it("YY3 semanticChanged with sampling 1000ms", async () => {
            await checkSemanticChange(1000);
        });
        it("YY1 semanticChanged with sampling 100ms", async () => {
            await checkSemanticChange(100);
        });
        it("YY2 semanticChanged with event-based (0ms) sampling", async () => {
            await checkSemanticChange(0);
        });
    });
}
