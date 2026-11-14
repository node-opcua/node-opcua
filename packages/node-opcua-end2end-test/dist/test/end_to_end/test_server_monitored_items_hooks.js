import { AttributeIds, OPCUAClient, OPCUAServer, StatusCodes, TimestampsToReturn } from "node-opcua";
import sinon from "sinon";
import "should";
import { get_mini_nodeset_filename } from "node-opcua-address-space/testHelpers.js";
const onCreateMonitoredItem = sinon.spy(async function _onCreateMonitoredItem(_subscription, _monitoredItem) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return StatusCodes.Good;
});
const onDeleteMonitoredItem = sinon.spy(async function _onDeleteMonitoredItem(_subscription, _monitoredItem) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return StatusCodes.Good;
});
const port = 2030;
async function createServer() {
    const server = new OPCUAServer({
        nodeset_filename: [get_mini_nodeset_filename()],
        port,
        onCreateMonitoredItem,
        onDeleteMonitoredItem
    });
    await server.start();
    return server;
}
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
describe("Test server monitored Item hooks", () => {
    let server;
    before(async () => {
        server = await createServer();
    });
    after(async () => {
        await server.shutdown();
    });
    beforeEach(() => {
        onDeleteMonitoredItem.resetHistory();
        onCreateMonitoredItem.resetHistory();
    });
    async function doWithSubscriptionAsync(b, functor) {
        const _endpointUrl = server.getEndpointUrl();
        const client = OPCUAClient.create({});
        const subscriptionParameters = {
            publishingEnabled: true,
            requestedLifetimeCount: 100,
            requestedMaxKeepAliveCount: 3,
            requestedPublishingInterval: 100
        };
        await client.connect(server.getEndpointUrl());
        const session = await client.createSession();
        const subscription = await session.createSubscription2(subscriptionParameters);
        try {
            await functor(subscription, session);
        }
        catch (err) {
            console.log(err);
            throw err;
        }
        finally {
            if (b) {
                await subscription.terminate();
            }
            await session.close();
            await client.disconnect();
        }
    }
    it("HK1- should call onCreateMonitoredItemHook/onDeleteMonitoredItemHook - terminating subscription", async () => {
        await doWithSubscriptionAsync(true, async (subscription) => {
            await subscription.monitor({
                attributeId: AttributeIds.Value,
                nodeId: "i=2258" // CurrentTime
            }, {
                discardOldest: true,
                queueSize: 100,
                samplingInterval: 40
            }, TimestampsToReturn.Both);
        });
        onCreateMonitoredItem.callCount.should.eql(1);
        onDeleteMonitoredItem.callCount.should.eql(1);
    });
    it("HK2- should call onCreateMonitoredItemHook/onDeleteMonitoredItemHook - not terminating subscription", async () => {
        await doWithSubscriptionAsync(false, async (subscription) => {
            await subscription.monitor({
                attributeId: AttributeIds.Value,
                nodeId: "i=2258" // CurrentTime
            }, {
                discardOldest: true,
                queueSize: 100,
                samplingInterval: 40
            }, TimestampsToReturn.Both);
        });
        onCreateMonitoredItem.callCount.should.eql(1);
        onDeleteMonitoredItem.callCount.should.eql(1);
    });
    it("HK3- should call onCreateMonitoredItemHook/onDeleteMonitoredItemHook", async () => {
        await doWithSubscriptionAsync(true, async (subscription) => {
            const _m1 = await subscription.monitor({
                attributeId: AttributeIds.Value,
                nodeId: "i=2258" // CurrentTime
            }, {
                discardOldest: true,
                queueSize: 100,
                samplingInterval: 40
            }, TimestampsToReturn.Both);
            const _m2 = await subscription.monitor({
                attributeId: AttributeIds.Value,
                nodeId: "i=2258" // CurrentTime
            }, {
                discardOldest: true,
                queueSize: 100,
                samplingInterval: 40
            }, TimestampsToReturn.Both);
        });
        onCreateMonitoredItem.callCount.should.eql(2);
        onDeleteMonitoredItem.callCount.should.eql(2);
    });
    it("HK4- should call onCreateMonitoredItemHook/onDeleteMonitoredItemHook  when terminating individual monitoredItem", async () => {
        await doWithSubscriptionAsync(true, async (subscription, session) => {
            const _m1 = await subscription.monitor({
                attributeId: AttributeIds.Value,
                nodeId: "i=2258" // CurrentTime
            }, {
                discardOldest: true,
                queueSize: 100,
                samplingInterval: 40
            }, TimestampsToReturn.Both);
            const m2 = await subscription.monitor({
                attributeId: AttributeIds.Value,
                nodeId: "i=2258" // CurrentTime
            }, {
                discardOldest: true,
                queueSize: 100,
                samplingInterval: 40
            }, TimestampsToReturn.Both);
            await m2.terminate();
            session.getArgumentDefinition;
        });
        onCreateMonitoredItem.callCount.should.eql(2);
        onDeleteMonitoredItem.callCount.should.eql(2);
    });
});
//# sourceMappingURL=test_server_monitored_items_hooks.js.map