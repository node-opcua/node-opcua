import "should";
import {
    PublishRequest,
    PublishResponse,
    CreateMonitoredItemsRequest,
    CreateMonitoredItemsResponse,
    TimestampsToReturn,
    MonitoringMode,
    VariableIds,
    makeNodeId,
    CreateSubscriptionRequest,
    CreateSubscriptionResponse,
    DeleteMonitoredItemsRequest,
    DeleteMonitoredItemsResponse,
    DeleteSubscriptionsRequest,
    DeleteSubscriptionsResponse,
    ClientSession,
    SubscriptionId,
    StatusCode
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { build_client_server_session, ClientServerSession } from "../test_helpers/build_client_server_session";
import { wait } from "../test_helpers/utils";
import { assertThrow } from "../test_helpers/assert_throw";

const port = 2020;
// eslint-disable-next-line import/order
describe("testing basic Client Server dealing with subscription at low level", function (this: Mocha.Runnable) {
    this.timeout(Math.max(40000, this.timeout()));

    let g_session: ClientSession & {
        createSubscription: (request: CreateSubscriptionRequest) => Promise<CreateSubscriptionResponse>;
        deleteSubscriptions: (request: DeleteSubscriptionsRequest) => Promise<DeleteSubscriptionsRequest>;
        createMonitoredItems: (request: CreateMonitoredItemsRequest) => Promise<CreateMonitoredItemsResponse>;
        deleteMonitoredItems: (request: DeleteMonitoredItemsRequest) => Promise<DeleteMonitoredItemsResponse>;
        publish: (request: PublishRequest) => Promise<PublishResponse>;
        setPublishingMode(publishingEnabled: boolean, subscriptionIds: SubscriptionId[]): Promise<StatusCode[]>;

    };
    let client_server: ClientServerSession;

    before(async () => {
        client_server = await build_client_server_session({ port });
        g_session = client_server.g_session as any;
    });

    after(async () => {
        await client_server.shutdown();
    });

    it("server should create a subscription (CreateSubscriptionRequest)", async () => {

        // CreateSubscriptionRequest
        const request = new CreateSubscriptionRequest({
            requestedPublishingInterval: 100,
            requestedLifetimeCount: 100 * 60 * 10,
            requestedMaxKeepAliveCount: 20,
            maxNotificationsPerPublish: 10,
            publishingEnabled: true,
            priority: 6
        });

        const response = await g_session.createSubscription(request);
        response.should.be.instanceof(CreateSubscriptionResponse);
        let subscriptionId = response.subscriptionId;

        await wait(0);
        const request2 = new DeleteSubscriptionsRequest({
            subscriptionIds: [subscriptionId!]
        });

        const response2 = await g_session.deleteSubscriptions(request2);
        response2.should.be.instanceof(DeleteSubscriptionsResponse);


    });

    it("server should create a monitored item  (CreateMonitoredItems)", async () => {


        // CreateSubscriptionRequest
        const request = new CreateSubscriptionRequest({
            requestedPublishingInterval: 100,
            requestedLifetimeCount: 100 * 60 * 10,
            requestedMaxKeepAliveCount: 20,
            maxNotificationsPerPublish: 10,
            publishingEnabled: true,
            priority: 6
        });

        const response = await g_session.createSubscription(request);
        response.should.be.instanceof(CreateSubscriptionResponse);
        let subscriptionId = response.subscriptionId;

        // CreateMonitoredItemsRequest
        const request2 = new CreateMonitoredItemsRequest({
            subscriptionId: subscriptionId,
            timestampsToReturn: TimestampsToReturn.Both,
            itemsToCreate: [
                {
                    itemToMonitor: {
                        nodeId: makeNodeId(VariableIds.Server_ServerStatus_CurrentTime)
                    },
                    monitoringMode: MonitoringMode.Sampling,
                    requestedParameters: {
                        clientHandle: 26,
                        samplingInterval: 100,
                        filter: null,
                        queueSize: 100,
                        discardOldest: true
                    }
                }
            ]
        });
        const response2 = await g_session.createMonitoredItems(request2);
        response2.should.be.instanceof(CreateMonitoredItemsResponse);

    });

    it("server should handle Publish request", async () => {

        // CreateSubscriptionRequest
        const request = new CreateSubscriptionRequest({
            requestedPublishingInterval: 100,
            requestedLifetimeCount: 100 * 60 * 10,
            requestedMaxKeepAliveCount: 20,

            maxNotificationsPerPublish: 10,
            publishingEnabled: true,
            priority: 6
        });
        const response = await g_session.createSubscription(request);
        const subscriptionId = response.subscriptionId;
        // publish request now requires a subscriptions
        const request2 = new PublishRequest({
            subscriptionAcknowledgements: []
        });

        const response2 = await g_session.publish(request2);

        response2.should.be.instanceof(PublishResponse);

        response2.should.have.ownProperty("subscriptionId"); // IntegerId
        response2.should.have.ownProperty("availableSequenceNumbers"); // Array,Counter,
        response2.should.have.ownProperty("moreNotifications"); // Boolean
        response2.should.have.ownProperty("notificationMessage");
        response2.should.have.ownProperty("results");
        response2.should.have.ownProperty("diagnosticInfos");

        const request3 = new DeleteSubscriptionsRequest({
            subscriptionIds: [subscriptionId]
        });
        const result3 = await g_session.deleteSubscriptions(request3);
        result3.should.be.instanceOf(DeleteSubscriptionsResponse);

    });

    it("server should handle DeleteMonitoredItems  request", async () => {
        const request = new DeleteMonitoredItemsRequest({});
        await assertThrow(async () => {
            const response = await g_session.deleteMonitoredItems(request)
        }, /BadSubscriptionIdInvalid/);
    });

    it("server should handle SetPublishingMode request", async () => {
        const results = await g_session.setPublishingMode(true, [1]);
        results.should.be.instanceOf(Array);
    });

    it("server should handle DeleteSubscriptionsRequest", async () => {
        const request = new DeleteSubscriptionsRequest({
            subscriptionIds: [1, 2]
        });
        const response = await g_session.deleteSubscriptions(request);
        response.should.be.instanceOf(DeleteSubscriptionsResponse);
    });
});
