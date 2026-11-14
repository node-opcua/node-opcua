import { clearTimeout } from "node:timers";
import { ClientSubscription, OPCUAClient, TimestampsToReturn } from "node-opcua";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import { itemsToMonitor1 } from "./_helpers_items_to_monitor.js";
const debugLog = make_debugLog("TEST");
const _doDebug = checkDebugFlag("TEST");
function getInternalPublishEngine(session) {
    const s = session.getPublishEngine();
    return s;
}
export function t(test) {
    const options = {
        requestedSessionTimeout: 10000000
    };
    async function createSession() {
        const client = OPCUAClient.create(options);
        const endpointUrl = test.endpointUrl;
        await client.connect(endpointUrl);
        const session = await client.createSession();
        const publishEngine = getInternalPublishEngine(session);
        publishEngine.timeoutHint = 100000000; // for debugging with ease !
        // make sure we control how PublishRequest are send
        // xx publishEngine.suspend(true);
        // create a subscriptions
        const subscription = ClientSubscription.create(session, {
            publishingEnabled: true,
            requestedLifetimeCount: 200000,
            requestedMaxKeepAliveCount: 100,
            requestedPublishingInterval: 2000
        });
        return { client, session, subscription, publishEngine };
    }
    let s;
    async function waitForRawNotifications() {
        const { publishEngine, subscription } = s;
        publishEngine.internalSendPublishRequest();
        return await new Promise((resolve) => {
            // wait for fist notification
            subscription.once("raw_notification", (notificationMessage) => {
                debugLog("got notification message ", notificationMessage.toString());
                resolve((notificationMessage.notificationData ?? []));
            });
        });
    }
    async function _waitForNotificationsValues() {
        while (true) {
            const notificationData1 = await waitForRawNotifications();
            if (notificationData1.length > 0) {
                const dcn = notificationData1[0];
                const r = dcn.monitoredItems?.map((item) => ({
                    statusCode: item.value.statusCode,
                    value: item.value.value.value
                })) ?? [];
                return r;
            }
            debugLog(" ------- skipping empty publish response");
            return [];
        }
    }
    describe("Monitoring Large number of node", function () {
        this.timeout(Math.max(200000, this.timeout()));
        before(() => {
            const _addressSpace = test.server.engine.addressSpace;
            const _namespace = test.server.engine.addressSpace.getOwnNamespace();
        });
        beforeEach(async () => {
            const _addressSpace = test.server.engine.addressSpace;
            s = await createSession();
        });
        afterEach(async () => {
            await s.subscription.terminate();
            await s.session.close();
            await s.client.disconnect();
        });
        it("Should monitor a large number of node efficiently", async () => {
            const { session, subscription } = s;
            session.on("session_closed", () => {
                console.log("session_closed");
            });
            const namespaceArray = await session.readNamespaceArray();
            const simulationNamespaceIndex = namespaceArray.indexOf("urn://node-opcua-simulator");
            console.log("simulationNamespaceIndex = ", simulationNamespaceIndex);
            let itemToMonitors = itemsToMonitor1;
            while (itemToMonitors.length + itemsToMonitor1.length < 2200) {
                itemToMonitors = itemToMonitors.concat([...itemsToMonitor1]);
            }
            const dataValues = await session.read(itemToMonitors);
            console.log(dataValues
                .map((x) => x.statusCode.toString())
                .filter((_x, index) => index % 1000 === 0)
                .join(" "));
            const requesterParameters = {
                discardOldest: true,
                queueSize: 100,
                samplingInterval: 1000
            };
            subscription.on("raw_notification", (_notificationMessage) => {
                // console.log("row Notification = ", notificationMessage.toString());
            });
            let counter = 0;
            let _err;
            try {
                console.time("A");
                const group = await subscription.monitorItems(itemToMonitors, requesterParameters, TimestampsToReturn.Both);
                console.timeEnd("A");
                console.log("set event handler on group");
                console.time("B");
                await new Promise((resolve) => {
                    const timerId = setTimeout(() => resolve(), 5000);
                    group.on("changed", (_monitoredItem, _dataValue, index) => {
                        counter++;
                        if (counter === itemToMonitors.length) {
                            clearTimeout(timerId);
                            resolve();
                        }
                        if ((index + 1) % 5000 === 0) {
                            console.log("index ", index + 1);
                        }
                    });
                });
                console.timeEnd("B");
                //   await new Promise((resolve) => setTimeout(resolve, 10000));
            }
            catch (err) {
                _err = err;
            }
            should.not.exist(_err, "not expecting any exception");
            counter.should.eql(itemToMonitors.length);
        });
    });
}
//# sourceMappingURL=u_test_e2e_monitoring_larger_number2.js.map