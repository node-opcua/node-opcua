import "should";
import {
    OPCUAClient,
    AttributeIds,
    DataType,
    DataValue,
    Range,
    makeBrowsePath,
    StatusCodes,
    ReadValueId,
    MonitoringMode,
    MonitoringParameters,
    TimestampsToReturn,
    CreateMonitoredItemsRequest,
    PublishRequest
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_raw_subscription } from "../../test_helpers/perform_operation_on_client_session";

interface TestHarness { endpointUrl: string;[k: string]: any }

const doDebug = false;

async function translateBrowsePathToFirstTarget(session: any, nodeId: string, relativePath: string) {
    const browsePath = [makeBrowsePath(nodeId, relativePath)];
    const results = await session.translateBrowsePath(browsePath);
    return results[0].targets[0].targetId;
}

async function getEURangeNodeId(session: any, nodeId: string) {
    return await translateBrowsePathToFirstTarget(session, nodeId, ".EURange");
}

async function readValue(session: any, nodeId: string) {
    const dv = await session.read({ nodeId, attributeId: AttributeIds.Value });
    return dv.value.value;
}

async function writeValue(session: any, nodeId: string, value: any, dataType = DataType.Double) {
    const statusCode = await session.write({
        nodeId,
        attributeId: AttributeIds.Value,
        value: new DataValue({ value: { dataType, value } })
    });
    statusCode.should.eql(StatusCodes.Good);
}

async function readEURange(session: any, nodeId: string) {
    const euRangeNodeId = await getEURangeNodeId(session, nodeId);
    const dv = await session.read({ nodeId: euRangeNodeId, attributeId: AttributeIds.Value });
    return dv.value.value;
}

async function writeEURange(session: any, nodeId: string, euRange: { low: number; high: number }) {
    const euRangeNodeId = await getEURangeNodeId(session, nodeId);
    await writeValue(session, euRangeNodeId, new Range(euRange), DataType.ExtensionObject);
}

async function incrementAnalog(session: any, nodeId: string) {
    const current = await readValue(session, nodeId);
    await writeValue(session, nodeId, current + 1, DataType.Double);
}

async function getNextDataChangeNotification(session: any) {
    const request = new PublishRequest({ requestHeader: { timeoutHint: 100000 }, subscriptionAcknowledgements: [] });
    return await new Promise<any>((resolve, reject) => {
        session.publish(request, (err: Error, response: any) => {
            if (err) return reject(err);
            try {
                const monitoredData = response.notificationMessage.notificationData[0].monitoredItems[0];
                if (doDebug) console.log(monitoredData.toString());
                resolve(monitoredData);
            } catch (e) {
                reject(e);
            }
        });
    });
}

export function t(test: TestHarness) {
    describe("SemanticChanged bit behaviour", () => {

        let client: OPCUAClient;

        let endpointUrl = test.endpointUrl;

        beforeEach(() => {
            client = OPCUAClient.create({});
            endpointUrl = test.endpointUrl;
        });
        afterEach(async () => {
            if (client) await client.disconnect();
        });

        async function checkSemanticChange(samplingInterval: number) {

            const analogNodeId = "ns=2;s=DoubleAnalogDataItem";

            await perform_operation_on_raw_subscription(
                client, test.endpointUrl,

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


                    const createMonitoredItemResponse = await (session as any).createMonitoredItems(createReq);
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
                });
        }

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