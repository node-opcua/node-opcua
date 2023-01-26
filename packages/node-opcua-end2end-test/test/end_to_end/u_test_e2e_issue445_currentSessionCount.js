const should = require("should");
const chalk = require("chalk");
const {
    AttributeIds,
    VariableIds,
    OPCUAClient,
    resolveNodeId,
    TimestampsToReturn,
    MonitoringMode
} = require("node-opcua");
const { make_debugLog, checkDebugFlag } = require("node-opcua-debug");
const { perform_operation_on_subscription_async } = require("../../test_helpers/perform_operation_on_client_session");
const { pause } = require("../discovery/_helper");
const { assert } = require("console");

function f(func) {
    return function (callback) {
        console.log("       * " + func.name.replace(/_/g, " ").replace(/(given|when|then)/, chalk.green("**$1**")));
        return func(callback);
    };
}

const debugLog = make_debugLog("TEST");
const errorLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

let sessionCounter = 0;
async function connectAndCreateSession(endpointUrl) {

    await pause(100);

    const client = OPCUAClient.create({
        name: "client" + sessionCounter++,
    });
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
const cumulatedSessionCountNodeId = resolveNodeId(
    VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CumulatedSessionCount
);

async function installMonitoredItem(subscription, nodeId) {
    debugLog("installMonitoredItem", nodeId.toString());
    const monitoredItem = await subscription.monitor(
        { nodeId, attributeId: AttributeIds.Value },
        {
            samplingInterval: 0, // reports immediately
            discardOldest: true,
            queueSize: 10
        },
        TimestampsToReturn.Both,
        MonitoringMode.Reporting
    );
    const recordedValue = [];

    console.log(nodeId.toString(), "sampling interval =", monitoredItem.result.revisedSamplingInterval);

    monitoredItem.on("changed", function (dataValue) {
        recordedValue.push(dataValue.value.value);
        debugLog("change =", recordedValue);
    });
    return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            console.log(monitoredItem);
            reject(new Error("Never received changedx for id" + nodeId.toString()));
        }, 5000);

        monitoredItem.once("changed", function (dataValue) {
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

async function waitSessionCountChange(_monitoredItem) {
    console.log("waitSessionCountChange");

    const monitoredItem = _monitoredItem;
    assert(monitoredItem);

    return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            console.log(" waitSessionCountChange has timed out");
            reject(new Error("Never received ", monitoredItem.toString()));
        }, 20000);

        monitoredItem.once("changed", function (dataValue) {
            clearTimeout(timer);
            const new_currentSessionCount = dataValue.value.value;
            debugLog("new currentSessionCount=", dataValue.toString());
            resolve(new_currentSessionCount);
        });

    });
}

const readCurrentSessionCount = async (session) => {
    const dataValue = await session.read({ nodeId: currentSessionCountNodeId, attributeId: AttributeIds.Value })
    return dataValue.value.value;
}
async function connectAndWaitCurrentSessionCountChange(endpointUrl, currentSessionCountMonitoredItem) {
    const promises = [waitSessionCountChange(currentSessionCountMonitoredItem), connectAndCreateSession(endpointUrl)];
    return await Promise.all(promises);
}

async function disconnectAndWaitCurrentSessionCountChange({ client, session }, currentSessionCountMonitoredItem) {
    const promises = [waitSessionCountChange(currentSessionCountMonitoredItem), closeSessionAndDisconnect({ client, session })];
    return await Promise.all(promises);
}

module.exports = function (test) {
    describe("Testing bug #445 - server.serverDiagnosticsSummary.currentSessionCount", function () {
        it("test that current SessionCount increments and decrements appropriately", async () => {
            const endpointUrl = test.endpointUrl;
            const client = OPCUAClient.create({});

            await perform_operation_on_subscription_async(client, endpointUrl, async (session, subscription) => {

                const [
                    recordedCurrentSessionCountValues,
                    currentSessionCountMonitoredItem
                ] = await installCurrentSessionCounter(subscription);

                const [recordedCumulatedSessionCountValues] = await installCumulatedSessionCounter(subscription);

                let currentSessionCount = await readCurrentSessionCount(session);

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
};
