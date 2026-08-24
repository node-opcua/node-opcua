import "should";
import {
    AttributeIds,
    type ClientMonitoredItem,
    type ClientSession,
    type ClientSubscription,
    type DataValue,
    MonitoringMode,
    type NodeId,
    OPCUAClient,
    resolveNodeId,
    TimestampsToReturn,
    VariableIds
} from "node-opcua";
import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_subscription_async } from "../../test_helpers/perform_operation_on_client_session";
import { pause } from "../discovery/helpers/_helper";
import type { UmbrellaTestContext } from "./_helper_umbrella";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

let sessionCounter = 0;
async function connectAndCreateSession(endpointUrl: string) {
    await pause(100);
    const client = OPCUAClient.create({ clientName: `client${sessionCounter++}` });
    await client.connect(endpointUrl);
    const session = await client.createSession();
    return { client, session };
}

async function closeSessionAndDisconnect({ client, session }: { client: OPCUAClient; session: ClientSession }) {
    await pause(100);
    await session.close();
    await client.disconnect();
}

const currentSessionCountNodeId = resolveNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSessionCount);
const cumulatedSessionCountNodeId = resolveNodeId(
    VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CumulatedSessionCount
);

async function installMonitoredItem(subscription: ClientSubscription, nodeId: NodeId): Promise<[number[], ClientMonitoredItem]> {
    debugLog("installMonitoredItem", nodeId.toString());
    const monitoredItem = await subscription.monitor(
        { nodeId, attributeId: AttributeIds.Value },
        { samplingInterval: 0, discardOldest: true, queueSize: 10 },
        TimestampsToReturn.Both,
        MonitoringMode.Reporting
    );
    const recordedValue: number[] = [];
    if (doDebug) console.log(nodeId.toString(), "sampling interval =", monitoredItem.result?.revisedSamplingInterval);
    monitoredItem.on("changed", (dataValue: DataValue) => {
        recordedValue.push(dataValue.value.value);
        debugLog("change =", recordedValue);
    });
    return await new Promise<[number[], ClientMonitoredItem]>((resolve, reject) => {
        const timer = setTimeout(() => {
            console.log(monitoredItem);
            reject(new Error(`Never received changed for id ${nodeId.toString()}`));
        }, 5000);
        monitoredItem.once("changed", () => {
            clearTimeout(timer);
            resolve([recordedValue, monitoredItem]);
        });
    });
}

async function installCurrentSessionCounter(subscription: ClientSubscription) {
    return await installMonitoredItem(subscription, currentSessionCountNodeId);
}

async function installCumulatedSessionCounter(subscription: ClientSubscription) {
    return await installMonitoredItem(subscription, cumulatedSessionCountNodeId);
}

async function waitSessionCountChange(monitoredItem: ClientMonitoredItem) {
    const mi = monitoredItem;
    assert(mi);
    return await new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => {
            console.log("waitSessionCountChange timed out");
            reject(new Error(`Never received change for ${mi.toString()}`));
        }, 20000);
        mi.once("changed", (dataValue: DataValue) => {
            clearTimeout(timer);
            const newVal = dataValue.value.value;
            debugLog("new currentSessionCount=", dataValue.toString());
            resolve(newVal);
        });
    });
}

const readCurrentSessionCount = async (session: ClientSession) => {
    const dataValue = await session.read({ nodeId: currentSessionCountNodeId, attributeId: AttributeIds.Value });
    return dataValue.value.value as number;
};

async function connectAndWaitCurrentSessionCountChange(
    endpointUrl: string,
    monitoredItem: ClientMonitoredItem
): Promise<[number, { client: OPCUAClient; session: ClientSession }]> {
    const valPromise = waitSessionCountChange(monitoredItem);
    const connPromise = connectAndCreateSession(endpointUrl);
    const results = await Promise.all([valPromise, connPromise]);
    return results;
}

async function disconnectAndWaitCurrentSessionCountChange(
    data: { client: OPCUAClient; session: ClientSession },
    monitoredItem: ClientMonitoredItem
): Promise<[number]> {
    const valPromise = waitSessionCountChange(monitoredItem);
    const discPromise = closeSessionAndDisconnect(data);
    const [val] = await Promise.all([valPromise, discPromise]);
    return [val];
}

export function t(test: UmbrellaTestContext) {
    describe("Testing bug #445 - server.serverDiagnosticsSummary.currentSessionCount", () => {
        it("test that current SessionCount increments and decrements appropriately", async () => {
            const endpointUrl = test.endpointUrl!;
            const client = OPCUAClient.create({});

            await perform_operation_on_subscription_async(client, endpointUrl, async (session, subscription) => {
                const [recordedCurrentSessionCountValues, currentSessionCountMonitoredItem] =
                    await installCurrentSessionCounter(subscription);
                const [recordedCumulatedSessionCountValues] = await installCumulatedSessionCounter(subscription);
                const currentSessionCount = await readCurrentSessionCount(session);

                const [newSessionCount1, data1] = await connectAndWaitCurrentSessionCountChange(
                    endpointUrl,
                    currentSessionCountMonitoredItem
                );
                const [newSessionCount2, data2] = await connectAndWaitCurrentSessionCountChange(
                    endpointUrl,
                    currentSessionCountMonitoredItem
                );
                const [newSessionCount3] = await disconnectAndWaitCurrentSessionCountChange(
                    data1,
                    currentSessionCountMonitoredItem
                );
                const [newSessionCount4] = await disconnectAndWaitCurrentSessionCountChange(
                    data2,
                    currentSessionCountMonitoredItem
                );

                newSessionCount1.should.eql(currentSessionCount + 1);
                newSessionCount2.should.eql(currentSessionCount + 2);
                newSessionCount3.should.eql(currentSessionCount + 1);
                newSessionCount4.should.eql(currentSessionCount + 0);

                const cc = recordedCumulatedSessionCountValues[0];
                recordedCumulatedSessionCountValues.should.eql([cc, cc + 1, cc + 2]);

                const c = currentSessionCount - 1;
                recordedCurrentSessionCountValues.should.eql([c + 1, c + 2, c + 3, c + 2, c + 1]);
            });
        });
    });
}
