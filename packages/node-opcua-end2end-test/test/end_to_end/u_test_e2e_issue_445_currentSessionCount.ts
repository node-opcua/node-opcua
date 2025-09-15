import "should";
import {
    AttributeIds,
    VariableIds,
    OPCUAClient,
    resolveNodeId,
    TimestampsToReturn,
    MonitoringMode
} from "node-opcua";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
import { perform_operation_on_subscription_async } from "../../test_helpers/perform_operation_on_client_session";
import { pause } from "../discovery/helpers/_helper";
import { assert } from "node-opcua-assert";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

interface TestHarness { endpointUrl: string; server: any; [k: string]: any }

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

let sessionCounter = 0;
async function connectAndCreateSession(endpointUrl: string) {
    await pause(100);
    // note: OPCUAClientOptions doesn't expose a 'name' property; omit it to satisfy typings
    const client = OPCUAClient.create({});
    (client as any).clientName = "client" + sessionCounter++; // preserve diagnostic intent
    await client.connect(endpointUrl);
    const session = await client.createSession();
    return { client, session };
}

async function closeSessionAndDisconnect({ client, session }: { client: OPCUAClient; session: any }) {
    await pause(100);
    await session.close();
    await client.disconnect();
}

const currentSessionCountNodeId = resolveNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSessionCount);
const cumulatedSessionCountNodeId = resolveNodeId(
    VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CumulatedSessionCount
);

async function installMonitoredItem(subscription: any, nodeId: any): Promise<[number[], any]> {
    debugLog("installMonitoredItem", nodeId.toString());
    const monitoredItem = await subscription.monitor(
        { nodeId, attributeId: AttributeIds.Value },
        { samplingInterval: 0, discardOldest: true, queueSize: 10 },
        TimestampsToReturn.Both,
        MonitoringMode.Reporting
    );
    const recordedValue: number[] = [];
    if (doDebug) console.log(nodeId.toString(), "sampling interval =", monitoredItem.result.revisedSamplingInterval);
    monitoredItem.on("changed", (dataValue: any) => {
        recordedValue.push(dataValue.value.value);
        debugLog("change =", recordedValue);
    });
    return await new Promise<[number[], any]>((resolve, reject) => {
        const timer = setTimeout(() => {
            console.log(monitoredItem);
            reject(new Error("Never received changed for id " + nodeId.toString()));
        }, 5000);
        monitoredItem.once("changed", () => {
            clearTimeout(timer);
            resolve([recordedValue, monitoredItem]);
        });
    });
}

async function installCurrentSessionCounter(subscription: any) {
    return await installMonitoredItem(subscription, currentSessionCountNodeId);
}

async function installCumulatedSessionCounter(subscription: any) {
    return await installMonitoredItem(subscription, cumulatedSessionCountNodeId);
}

async function waitSessionCountChange(monitoredItem: any) {
    const mi = monitoredItem; assert(mi);
    return await new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => {
            console.log("waitSessionCountChange timed out");
            reject(new Error("Never received change for " + mi.toString()));
        }, 20000);
        mi.once("changed", (dataValue: any) => {
            clearTimeout(timer);
            const newVal = dataValue.value.value;
            debugLog("new currentSessionCount=", dataValue.toString());
            resolve(newVal);
        });
    });
}

const readCurrentSessionCount = async (session: any) => {
    const dataValue = await session.read({ nodeId: currentSessionCountNodeId, attributeId: AttributeIds.Value });
    return dataValue.value.value as number;
};

async function connectAndWaitCurrentSessionCountChange(endpointUrl: string, monitoredItem: any): Promise<[number, { client: OPCUAClient; session: any }]> {
    const valPromise = waitSessionCountChange(monitoredItem) as Promise<number>;
    const connPromise = connectAndCreateSession(endpointUrl);
    const results = await Promise.all([valPromise, connPromise]);
    return results as [number, { client: OPCUAClient; session: any }];
}

async function disconnectAndWaitCurrentSessionCountChange(data: { client: OPCUAClient; session: any }, monitoredItem: any): Promise<[number]> {
    const valPromise = waitSessionCountChange(monitoredItem) as Promise<number>;
    const discPromise = closeSessionAndDisconnect(data) as Promise<void>;
    const [val] = await Promise.all([valPromise, discPromise]);
    return [val];
}

export function t(test: TestHarness) {
    describe("Testing bug #445 - server.serverDiagnosticsSummary.currentSessionCount", () => {
        it("test that current SessionCount increments and decrements appropriately", async () => {
            const endpointUrl = test.endpointUrl;
            const client = OPCUAClient.create({});

            await perform_operation_on_subscription_async(client, endpointUrl, async (session: any, subscription: any) => {
                const [recordedCurrentSessionCountValues, currentSessionCountMonitoredItem] = await installCurrentSessionCounter(subscription);
                const [recordedCumulatedSessionCountValues] = await installCumulatedSessionCounter(subscription);
                const currentSessionCount = await readCurrentSessionCount(session);

                const [newSessionCount1, data1] = await connectAndWaitCurrentSessionCountChange(endpointUrl, currentSessionCountMonitoredItem);
                const [newSessionCount2, data2] = await connectAndWaitCurrentSessionCountChange(endpointUrl, currentSessionCountMonitoredItem);
                const [newSessionCount3] = await disconnectAndWaitCurrentSessionCountChange(data1, currentSessionCountMonitoredItem);
                const [newSessionCount4] = await disconnectAndWaitCurrentSessionCountChange(data2, currentSessionCountMonitoredItem);

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
