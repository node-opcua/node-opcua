import {
    AttributeIds,
    ClientSession,
    ClientSubscription,
    MonitoredItemBase,
    NodeId,
    nodesets,
    OPCUAClient,
    OPCUAServer,
    StatusCode,
    StatusCodes,
    Subscription,
    TimestampsToReturn
} from "node-opcua";
import * as sinon from "sinon";
import "should";
import { get_mini_nodeset_filename } from "node-opcua-address-space/testHelpers";

const onCreateMonitoredItem = sinon.spy(async function _onCreateMonitoredItem(
    subscription: Subscription,
    monitoredItem: MonitoredItemBase
) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return StatusCodes.Good;
});

const onDeleteMonitoredItem = sinon.spy(async function _onDeleteMonitoredItem(
    subscription: Subscription,
    monitoredItem: MonitoredItemBase
) {
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

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Test server monitored Item hooks", () => {
    let server: OPCUAServer;
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
    async function withSubscription(
        b: boolean,
        functor: (subscription: ClientSubscription, session: ClientSession) => Promise<void>
    ): Promise<void> {
        const client = OPCUAClient.create({});
        await client.connect(server.getEndpointUrl());

        const session = await client.createSession();

        const subscription = await session.createSubscription2({
            publishingEnabled: true,
            requestedLifetimeCount: 100,
            requestedMaxKeepAliveCount: 3,
            requestedPublishingInterval: 100
        });
        try {
            await functor(subscription, session);
        } catch (err) {
            // tslint:disable-next-line: no-console
            console.log(err);
            throw err;
        } finally {
            if (b) {
                await subscription.terminate();
            }
            await session.close();
            await client.disconnect();
        }
    }
    it("HK1- should call onCreateMonitoredItemHook/onDeleteMonitoredItemHook - terminating subscription", async () => {
        await withSubscription(true, async (subscription) => {
            await subscription.monitor(
                {
                    attributeId: AttributeIds.Value,
                    nodeId: "i=2258" // CurrentTime
                },
                {
                    discardOldest: true,
                    queueSize: 100,
                    samplingInterval: 40
                },
                TimestampsToReturn.Both
            );
        });

        onCreateMonitoredItem.callCount.should.eql(1);
        onDeleteMonitoredItem.callCount.should.eql(1);
    });
    it("HK2- should call onCreateMonitoredItemHook/onDeleteMonitoredItemHook - not terminating subscription", async () => {
        await withSubscription(false, async (subscription) => {
            await subscription.monitor(
                {
                    attributeId: AttributeIds.Value,
                    nodeId: "i=2258" // CurrentTime
                },
                {
                    discardOldest: true,
                    queueSize: 100,
                    samplingInterval: 40
                },
                TimestampsToReturn.Both
            );
        });

        onCreateMonitoredItem.callCount.should.eql(1);
        onDeleteMonitoredItem.callCount.should.eql(1);
    });
    it("HK3- should call onCreateMonitoredItemHook/onDeleteMonitoredItemHook", async () => {
        await withSubscription(true, async (subscription) => {
            const m1 = await subscription.monitor(
                {
                    attributeId: AttributeIds.Value,
                    nodeId: "i=2258" // CurrentTime
                },
                {
                    discardOldest: true,
                    queueSize: 100,
                    samplingInterval: 40
                },
                TimestampsToReturn.Both
            );
            const m2 = await subscription.monitor(
                {
                    attributeId: AttributeIds.Value,
                    nodeId: "i=2258" // CurrentTime
                },
                {
                    discardOldest: true,
                    queueSize: 100,
                    samplingInterval: 40
                },
                TimestampsToReturn.Both
            );
        });

        onCreateMonitoredItem.callCount.should.eql(2);
        onDeleteMonitoredItem.callCount.should.eql(2);
    });
    it("HK4- should call onCreateMonitoredItemHook/onDeleteMonitoredItemHook  when terminating individual monitoredItem", async () => {
        await withSubscription(true, async (subscription, session: ClientSession) => {
            const m1 = await subscription.monitor(
                {
                    attributeId: AttributeIds.Value,
                    nodeId: "i=2258" // CurrentTime
                },
                {
                    discardOldest: true,
                    queueSize: 100,
                    samplingInterval: 40
                },
                TimestampsToReturn.Both
            );
            const m2 = await subscription.monitor(
                {
                    attributeId: AttributeIds.Value,
                    nodeId: "i=2258" // CurrentTime
                },
                {
                    discardOldest: true,
                    queueSize: 100,
                    samplingInterval: 40
                },
                TimestampsToReturn.Both
            );

            await m2.terminate();

            session.getArgumentDefinition
        });

        onCreateMonitoredItem.callCount.should.eql(2);
        onDeleteMonitoredItem.callCount.should.eql(2);
    });
});
