import "should";
import { AttributeIds, MonitoringMode, OPCUAClient, resolveNodeId, TimestampsToReturn, VariableIds } from "node-opcua";
import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_subscription_async } from "../../test_helpers/perform_operation_on_client_session.js";
import { pause } from "../discovery/helpers/_helper.js";
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");
let sessionCounter = 0;
async function connectAndCreateSession(endpointUrl) {
    await pause(100);
    const client = OPCUAClient.create({ clientName: `client${sessionCounter++}` });
    await client.connect(endpointUrl);
    const session = await client.createSession();
    return { client, session };
}
async function closeSessionAndDisconnect({ client, session }) {
    await pause(100);
    await session.close();
    await client.disconnect();
}
const currentSessionCountNodeId = resolveNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSessionCount);
const cumulatedSessionCountNodeId = resolveNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CumulatedSessionCount);
async function installMonitoredItem(subscription, nodeId) {
    debugLog("installMonitoredItem", nodeId.toString());
    const monitoredItem = await subscription.monitor({ nodeId, attributeId: AttributeIds.Value }, { samplingInterval: 0, discardOldest: true, queueSize: 10 }, TimestampsToReturn.Both, MonitoringMode.Reporting);
    const recordedValue = [];
    if (doDebug)
        console.log(nodeId.toString(), "sampling interval =", monitoredItem.result?.revisedSamplingInterval);
    monitoredItem.on("changed", (dataValue) => {
        recordedValue.push(dataValue.value.value);
        debugLog("change =", recordedValue);
    });
    return await new Promise((resolve, reject) => {
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
async function installCurrentSessionCounter(subscription) {
    return await installMonitoredItem(subscription, currentSessionCountNodeId);
}
async function installCumulatedSessionCounter(subscription) {
    return await installMonitoredItem(subscription, cumulatedSessionCountNodeId);
}
async function waitSessionCountChange(monitoredItem) {
    const mi = monitoredItem;
    assert(mi);
    return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            console.log("waitSessionCountChange timed out");
            reject(new Error(`Never received change for ${mi.toString()}`));
        }, 20000);
        mi.once("changed", (dataValue) => {
            clearTimeout(timer);
            const newVal = dataValue.value.value;
            debugLog("new currentSessionCount=", dataValue.toString());
            resolve(newVal);
        });
    });
}
const readCurrentSessionCount = async (session) => {
    const dataValue = await session.read({ nodeId: currentSessionCountNodeId, attributeId: AttributeIds.Value });
    return dataValue.value.value;
};
async function connectAndWaitCurrentSessionCountChange(endpointUrl, monitoredItem) {
    const valPromise = waitSessionCountChange(monitoredItem);
    const connPromise = connectAndCreateSession(endpointUrl);
    const results = await Promise.all([valPromise, connPromise]);
    return results;
}
async function disconnectAndWaitCurrentSessionCountChange(data, monitoredItem) {
    const valPromise = waitSessionCountChange(monitoredItem);
    const discPromise = closeSessionAndDisconnect(data);
    const [val] = await Promise.all([valPromise, discPromise]);
    return [val];
}
export function t(test) {
    describe("Testing bug #445 - server.serverDiagnosticsSummary.currentSessionCount", () => {
        it("test that current SessionCount increments and decrements appropriately", async () => {
            const endpointUrl = test.endpointUrl;
            const client = OPCUAClient.create({});
            await perform_operation_on_subscription_async(client, endpointUrl, async (session, subscription) => {
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
//# sourceMappingURL=u_test_e2e_issue_445_currentSessionCount.js.map