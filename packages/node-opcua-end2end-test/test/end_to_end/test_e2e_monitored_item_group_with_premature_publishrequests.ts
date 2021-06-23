import {
    AttributeIds,
    ClientSubscription,
    ErrorCallback,
    Message,
    OPCUAClient,
    OPCUAServer,
    ReadValueIdOptions,
    ServerSecureChannelLayer,
    TimestampsToReturn,
    Response,
    SecurityPolicy,
    MessageSecurityMode,
    ClientMonitoredItemGroup
} from "node-opcua";
import "should";

async function pause(ms: number) {
    return await new Promise((resolve) => setTimeout(resolve, ms));
}
const port = 2234;
const publishingInterval = 50;
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("[CLIENT] monitoredItem group when NotificationChange arrive before CreateMonitoredItemsResponse", () => {
    let server: OPCUAServer;

    async function startServer() {
        server = new OPCUAServer({
            port,
            securityPolicies: [SecurityPolicy.None],
            securityModes: [MessageSecurityMode.None]
        });
        await server.initialize();
        const addressSpace = server.engine.addressSpace!;
        const namespace = addressSpace.getOwnNamespace();
        const v = namespace.addVariable({
            nodeId: "ns=1;s=Variable",
            browseName: "Variable",
            dataType: "Float",
            value: { dataType: "Float", value: 3.14 }
        });
        await server.start();

        return server;
    }
    let old: any;

    function makeCreateMonitoredItemsResponseLate() {
        ServerSecureChannelLayer.prototype.send_response = function send_response(
            this: ServerSecureChannelLayer,
            msgType: string,
            response: Response,
            message: Message,
            callback?: ErrorCallback
        ): void {
            if (response.constructor.name === "CreateMonitoredItemsResponse") {
                console.log("delaying CreateMonitoredItemsResponse");
                setTimeout(() => {
                    old.call(this, msgType, response, message, callback);
                }, publishingInterval * 1.2);
            } else {
                old.call(this, msgType, response, message, callback);
            }
        };
    }
    async function withServer(makeLate: boolean, f: () => Promise<void>): Promise<void> {
        old = ServerSecureChannelLayer.prototype.send_response;
        if (makeLate) {
            makeCreateMonitoredItemsResponseLate();
        }
        let _err: Error | undefined;
        try {
            await f();
        } catch (err) {
            _err = err;
        }
        ServerSecureChannelLayer.prototype.send_response = old;
        if (_err) throw _err;
    }
    async function withClient(f: (subscription: ClientSubscription) => Promise<void>): Promise<void> {
        // Given a server with a small maxMonitoredItemsPerCall value
        const endpointUrl = server.getEndpointUrl();

        // Given a client with a large number of monitoredItem
        const client = OPCUAClient.create({});
        client.on("backoff", () => console.log("backoff"));
        client.on("connection_failed", () => console.log("connection has failed"));
        client.on("after_reconnection", () => console.log("after reconnection"));
        client.on("connection_lost", () => console.log("connection lost"));

        client.on("send_request", (request) => {});

        await client.connect(endpointUrl);

        const session = await client.createSession();
        const subscription = await session.createSubscription2({
            requestedLifetimeCount: 10,
            requestedPublishingInterval: publishingInterval,
            requestedMaxKeepAliveCount: 5,
            publishingEnabled: true
        });
        subscription.on("raw_notification", (notificationMessage: any) => {
            // console.log(notificationMessage.toString());
        });

        let _err: Error | undefined;
        try {
            await f(subscription);
        } catch (err) {
            _err = err;
        }
        await subscription.terminate();
        await session.close();
        await client.disconnect();

        if (_err) {
            throw _err;
        }
    }
    async function untilSubscriptionKeepAlive(subscription: ClientSubscription) {
        await new Promise<void>((resolve) => {
            subscription.once("keepalive", () => {
                resolve();
            });
        });
    }

    const itemsToMonitor1: ReadValueIdOptions[] = [
        {
            nodeId: "ns=1;s=Variable",
            attributeId: AttributeIds.Value
        },
        {
            nodeId: "ns=1;s=Variable",
            attributeId: AttributeIds.Value
        }
    ];
    const requestedParameters = {
        samplingInterval: 10,
        queueSize: 1,
        discardOldest: true
    };
    async function testRun_subscription_monitorItems(makeLate: boolean) {
        await withServer(makeLate, async () => {
            await withClient(async (subscription: ClientSubscription) => {
                let counter = 0;
                const group = await subscription.monitorItems(itemsToMonitor1, requestedParameters, TimestampsToReturn.Both);
                group.on("err", () => {
                    console.log("err");
                });
                group.on("changed", (monitoredIem, dataValue, index) => {
                  //  console.log("received changes");
                    counter++;
                });

                await untilSubscriptionKeepAlive(subscription);
                counter.should.eql(2);
            });
        });
    }
    async function testRunClientMonitoredItemGroup_createForm(makeLate: boolean) {
        await withServer(makeLate, async () => {
            await withClient(async (subscription: ClientSubscription) => {
                let counter = 0;

                const group = ClientMonitoredItemGroup.create(
                    subscription,
                    itemsToMonitor1,
                    requestedParameters,
                    TimestampsToReturn.Both
                );
                group.on("err", () => {
                    console.log("err");
                });
                group.on("changed", (monitoredIem, dataValue, index) => {
                //    console.log("received changes");
                    counter++;
                });

                await untilSubscriptionKeepAlive(subscription);
                await untilSubscriptionKeepAlive(subscription);
                counter.should.eql(2);
            });
        });
    }

    before(async()=>{
        await startServer();
    });
    after(async ()=>{
        await server.shutdown();
    })
    describe("if PublishRequests are sent with notification AFTER CreateMonitoredItemsResponse is received", () => {
        it("Form1 ClientMonitoredItemGroup.create -  should not miss any notification changes", async () => {
            await testRunClientMonitoredItemGroup_createForm(false);
        });
        it("Form3 testRun_subscription_monitorItems - should not miss any notification changes", async () => {
            await testRun_subscription_monitorItems(false);
        });
    });

    describe("if PublishRequests are sent with notification BEFORE CreateMonitoredItemsResponse is received", () => {
        it("Form2 ClientMonitoredItemGroup.create -  should not miss any notification change", async () => {
            await testRunClientMonitoredItemGroup_createForm(true);
        });
        it("Form4 testRun_subscription_monitorItems - should not miss any notification change", async () => {
            await testRun_subscription_monitorItems(true);
        });
    });
});
