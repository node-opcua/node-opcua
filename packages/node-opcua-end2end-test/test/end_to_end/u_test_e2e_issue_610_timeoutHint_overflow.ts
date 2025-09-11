import "should";
import { OPCUAClient, ClientSubscription } from "node-opcua-client";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_client_session } from "../../test_helpers/perform_operation_on_client_session";

export function t(test: any) {

    describe("Testing bug #610 - TimeoutHint overflow", function () {

        it("using a  large value for requestedPublishingInterval should not cause node-opcua to crash", async () => {

            const client = OPCUAClient.create({
                requestedSessionTimeout: 2E9
            });
            const endpointUrl = test.endpointUrl;

            await perform_operation_on_client_session(client, endpointUrl, async (session) => {

                ClientSubscription.ignoreNextWarning = true;

                const subscription = await session.createSubscription2({
                    maxNotificationsPerPublish: 10,
                    requestedLifetimeCount: 10 * 60 * 10,
                    requestedMaxKeepAliveCount: 10,

                    priority: 6,
                    publishingEnabled: true,

                    requestedPublishingInterval: 1E9, // very high !!!!
                });

                subscription.publishingInterval.should.be.lessThan(1E9);
            });
        });
    });
};
