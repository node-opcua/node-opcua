import "should";
import {
    ClientSubscription,
    OPCUAClient,
    ClientMonitoredItem,
    AttributeIds,
    TimestampsToReturn,
    ServerSession,
    StatusCodes
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

interface TestHarness { endpointUrl: string; server: any; [k: string]: any }

/**
 * Issue #195 tests
 * A: Client detects server max pending publish requests limit and adapts.
 * B: Client handles session close (simulated here) and can transfer old subscription to new session.
 */
export function t(test: TestHarness) {
    describe("Issue #195 publish request throttling & session recovery", () => {
        it("195-A detects server max pending publish requests", async () => {
            const server = test.server;
            if (!server) return;

            const client = OPCUAClient.create({ requestedSessionTimeout: 120 * 60 * 1000, keepSessionAlive: false });
            const endpointUrl = test.endpointUrl;

            let session: any;
            const oldValue = (ServerSession as any).maxPublishRequestInQueue;
            oldValue.should.be.greaterThan(20);
            (ServerSession as any).maxPublishRequestInQueue = 10; // constrain

            async function createSubscription() {
                // create subscription
                const parameters = {
                    requestedPublishingInterval: 10000,
                    requestedLifetimeCount: 60,
                    requestedMaxKeepAliveCount: 10
                } as any;
                (ClientSubscription as any).ignoreNextWarning = true;
                const subscription = ClientSubscription.create(session, parameters);
                await new Promise<void>((resolve) => subscription.on("started", () => resolve()));
                subscription.on("internal_error", (err: Error) => {
                    // eslint-disable-next-line no-console
                    // console.error("internal_error", err.message);
                });
                subscription.on("keepalive", () => {
                    // console.log("keepalive - pending=", (subscription as any).publish_engine.nbPendingPublishRequests);
                });
                // monitored item to activate publish flow
                const nodeIdToMonitor = "ns=0;i=2257"; // Server_ServerStatus_StartTime
                const mi = ClientMonitoredItem.create(
                    subscription,
                    { nodeId: nodeIdToMonitor, attributeId: AttributeIds.Value },
                    { samplingInterval: 1000, discardOldest: true, queueSize: 100 },
                    TimestampsToReturn.Both
                );
                await new Promise<void>((resolve) => mi.on("initialized", () => resolve()));
                return subscription;
            }

            try {
                await client.connect(endpointUrl);
                session = await client.createSession();
                (session.getPublishEngine() as any).nbMaxPublishRequestsAcceptedByServer.should.be.greaterThan(100);

                await createSubscription();
                await createSubscription();
                await createSubscription();
                await createSubscription();
                await createSubscription();

                // After multiple subscriptions, client should have learned reduced server limit
                (session as any)._publishEngine.nbMaxPublishRequestsAcceptedByServer.should.eql(10);
            } finally {
                (ServerSession as any).maxPublishRequestInQueue = oldValue;
                if (session) {
                    await session.close();
                }
                await client.disconnect();
            }
        });

        it("195-B detects session closed and transfers subscription", async () => {
            const server = test.server; if (!server) return;
            const client = OPCUAClient.create({ requestedSessionTimeout: 2500, keepSessionAlive: false });
            const endpointUrl = test.endpointUrl;

            await client.connect(endpointUrl);
            let session: any = await client.createSession();

            // Create long-lived subscription whose keep-alive exceeds session timeout
            const subParams = {
                requestedPublishingInterval: 1000,
                requestedLifetimeCount: 100000,
                requestedMaxKeepAliveCount: 1000
            } as any;
            (ClientSubscription as any).ignoreNextWarning = true;
            const subscription = ClientSubscription.create(session, subParams);
            await new Promise<void>((resolve) => subscription.on("started", () => resolve()));
            const expectedKeepAliveMillis = subscription.publishingInterval * subscription.maxKeepAliveCount;
            expectedKeepAliveMillis.should.be.greaterThan(session.timeout);

            // Create monitored item
            const mi = ClientMonitoredItem.create(
                subscription,
                { nodeId: "ns=0;i=2257", attributeId: AttributeIds.Value },
                { samplingInterval: 1000, discardOldest: true, queueSize: 100 },
                TimestampsToReturn.Both
            );
            await new Promise<void>((resolve) => mi.on("initialized", () => resolve()));

            const subscriptionId = subscription.subscriptionId;
            (typeof subscriptionId).should.eql("number");

            // Simulate closure (original test actively closed session)
            await new Promise<void>((resolve) => session.close(false, () => resolve()));

            // Re-create session and transfer subscription
            session = await client.createSession();
            const transferResponse: any = await new Promise((resolve, reject) => {
                (session as any).transferSubscriptions({ subscriptionIds: [subscriptionId] }, (err: Error, response: any) => {
                    if (err) return reject(err);
                    resolve(response);
                });
            });
            transferResponse.results[0].statusCode.should.eql(StatusCodes.Good);

            await session.close();
            await client.disconnect();
        });
    });
}
