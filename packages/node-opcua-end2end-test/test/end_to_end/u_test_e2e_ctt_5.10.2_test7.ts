import "should";
import { type ClientSessionRawSubscriptionService, OPCUAClient } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_subscription_async } from "../../test_helpers/perform_operation_on_client_session";
import type { UmbrellaTestContext } from "./_helper_umbrella";

/**
 * CTT Test 5.10.2 - Test case 7
 * Modify subscription with extreme RequestedPublishingInterval values; server should revise.
 */
export function t(test: UmbrellaTestContext) {
    describe("Testing ctt - Test 5.10.2 Test case 7 - SubscriptionBasic - 029.js", () => {
        async function performTestWithValue(maxValue: number) {
            const client = OPCUAClient.create({});
            const endpointUrl = test.endpointUrl!;
            await perform_operation_on_subscription_async(client, endpointUrl, async (session, subscription) => {
                const request = { subscriptionId: subscription.subscriptionId, requestedPublishingInterval: maxValue };
                const response = await (session as unknown as ClientSessionRawSubscriptionService).modifySubscription(request);
                (typeof response.revisedPublishingInterval === "number").should.eql(true);
                response.revisedPublishingInterval.should.not.eql(maxValue);
            });
        }

        it("1. revises PublishingInterval when RequestedPublishingInterval is NaN", async () => {
            Number.isNaN(NaN).should.eql(true);
            await performTestWithValue(NaN);
        });
        it("2. revises PublishingInterval when RequestedPublishingInterval is Infinity", async () => {
            await performTestWithValue(Infinity);
        });
        it("3. revises PublishingInterval when RequestedPublishingInterval is MaxFloat (MAX_SAFE_INTEGER)", async () => {
            const MAX = Number.MAX_SAFE_INTEGER; // 2^53 -1
            await performTestWithValue(MAX);
        });
    });
}
