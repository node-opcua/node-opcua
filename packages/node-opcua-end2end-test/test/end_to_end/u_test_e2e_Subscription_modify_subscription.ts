// tslint:disable: no-shadowed-variable
// tslint:disable: no-console
import {
    AddressSpace,
    assert,
    AttributeIds,
    ClientMonitoredItem,
    ClientSession,
    ClientSessionRawSubscriptionService,
    ClientSidePublishEngine,
    ClientSubscription,
    ClientSubscriptionOptions,
    coerceNodeId,
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
    MonitoringMode,
    MonitoringParametersOptions,
    Namespace,
    NodeIdLike,
    NotificationMessage,
    OPCUAClient,
    Range,
    ServerSidePublishEngine,
    SetTriggeringRequestOptions,
    StatusCode,
    StatusCodes,
    TimestampsToReturn,
    UAVariable
} from "node-opcua";
import * as sinon from "sinon";
import * as should from "should";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

async function pause(delay: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, delay));
}
export function t(test: any) {
    const options = {};
    const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
    describe("ClientSubscription#modify", function (this: any) {
        it("should modify subscription parameters", async () => {
            const client = OPCUAClient.create({});

            const parameters: ClientSubscriptionOptions = {
                priority: 1,
                publishingEnabled: true,
                requestedLifetimeCount: 1000,
                requestedMaxKeepAliveCount: 10,
                requestedPublishingInterval: 500
            };
            const endpointUrl = test.endpointUrl;

            await client.withSubscriptionAsync(endpointUrl, parameters, async (session, subscription) => {

                const PENDING_SUBSCRIPTION_ID = 0xc0cac01a;
                const TERMINATED_SUBSCRIPTION_ID = 0xc0cac01b;
                const TERMINATING_SUBSCRIPTION_ID = 0xc0cac01c;

                subscription.subscriptionId.should.not.eql(PENDING_SUBSCRIPTION_ID);
                subscription.publishingInterval.should.eql(500);
                subscription.maxKeepAliveCount.should.eql(10);
                subscription.lifetimeCount.should.eql(1000);

                await pause(100);

                const res1 = await subscription.modify({
                   requestedPublishingInterval: 550,
                });
                res1.revisedLifetimeCount.should.eql(1000);
                res1.revisedPublishingInterval.should.eql(550);
                res1.revisedMaxKeepAliveCount.should.eql(10);

                const res2 = await subscription.modify({
                    requestedMaxKeepAliveCount: 25,
                 });
                 res2.revisedLifetimeCount.should.eql(1000);
                 res2.revisedPublishingInterval.should.eql(550);
                 res2.revisedMaxKeepAliveCount.should.eql(25);

                 const res3 = await subscription.modify({
                    requestedLifetimeCount: 1010,
                 });
                 res3.revisedLifetimeCount.should.eql(1010);
                 res3.revisedPublishingInterval.should.eql(550);
                 res3.revisedMaxKeepAliveCount.should.eql(25);

            });
        });
    });
}

