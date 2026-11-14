import "should";
import { CreateMonitoredItemsRequest, CreateMonitoredItemsResponse, CreateSubscriptionRequest, CreateSubscriptionResponse, DeleteMonitoredItemsRequest, DeleteSubscriptionsRequest, DeleteSubscriptionsResponse, MonitoringMode, makeNodeId, PublishRequest, PublishResponse, TimestampsToReturn, VariableIds } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { assertThrow } from "../test_helpers/assert_throw.js";
import { build_client_server_session } from "../test_helpers/build_client_server_session.js";
import { wait } from "../test_helpers/utils.js";
const port = 2020;
describe("testing basic Client Server dealing with subscription at low level", function () {
    this.timeout(Math.max(40000, this.timeout()));
    let g_session;
    let client_server;
    before(async () => {
        client_server = await build_client_server_session({ port });
        g_session = client_server.g_session;
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
        const subscriptionId = response.subscriptionId;
        await wait(0);
        const request2 = new DeleteSubscriptionsRequest({
            subscriptionIds: [subscriptionId]
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
        const subscriptionId = response.subscriptionId;
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
            const _response = await g_session.deleteMonitoredItems(request);
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
//# sourceMappingURL=test_subscriptions.js.map