import "should";
import {
    AttributeIds,
    ClientMonitoredItem,
    ClientSubscription,
    OPCUAClient,
    type OPCUAServer,
    StatusCodes,
    TimestampsToReturn,
    UserTokenType
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { build_server_with_temperature_device } from "../../test_helpers/build_server_with_temperature_device";

// -------------------------------------------------------------------------------------------------
// OPC UA Part 4 §5.14.7 - ownership check for TransferSubscriptions.
//
// A Subscription may only be transferred to a Session operating on behalf of the SAME user as the
// session that owns it. This must hold even after the owning session is gone (the subscription has
// been orphaned) - which is precisely the situation an attacker would try to exploit.
//
// The protection is keyed on the USER identity, not on the channel security, so it is fully effective
// even over an unsecured (SecurityPolicy #None) channel. This test authenticates two different users
// with username/password over an unsecured channel and verifies that:
//   * a DIFFERENT user (user2) cannot take over user1's orphaned subscription  -> Bad_UserAccessDenied
//   * the SAME user (user1) can reclaim its own orphaned subscription           -> Good
// -------------------------------------------------------------------------------------------------

const port = 20558;
const monitoredNodeId = "ns=0;i=2258"; // Server_ServerStatus_CurrentTime

async function orphanSubscriptionAs(endpointUrl: string, userName: string, password: string): Promise<number> {
    // create a session as `userName`, create a subscription, then close the session WITHOUT deleting
    // its subscriptions so that the subscription is left orphaned on the server.
    const client = OPCUAClient.create({ endpointMustExist: false });
    await client.connect(endpointUrl);
    try {
        const session = await client.createSession({ type: UserTokenType.UserName, userName, password });

        const subscription = ClientSubscription.create(session, {
            requestedPublishingInterval: 1000,
            requestedLifetimeCount: 1000,
            requestedMaxKeepAliveCount: 20,
            maxNotificationsPerPublish: 10,
            publishingEnabled: true,
            priority: 1
        });
        await new Promise<void>((resolve) => subscription.on("started", () => resolve()));

        const monitoredItem = ClientMonitoredItem.create(
            subscription,
            { nodeId: monitoredNodeId, attributeId: AttributeIds.Value },
            { samplingInterval: 500, discardOldest: true, queueSize: 10 },
            TimestampsToReturn.Both
        );
        await new Promise<void>((resolve) => monitoredItem.on("initialized", () => resolve()));

        const subscriptionId = subscription.subscriptionId;

        // close the session but keep the subscription alive (orphaned)
        await new Promise<void>((resolve) => session.close(/*deleteSubscriptions=*/ false, () => resolve()));
        return subscriptionId;
    } finally {
        await client.disconnect();
    }
}

async function transferAs(
    endpointUrl: string,
    userName: string,
    password: string,
    subscriptionId: number
): Promise<StatusCodes> {
    const client = OPCUAClient.create({ endpointMustExist: false });
    await client.connect(endpointUrl);
    try {
        const session = await client.createSession({ type: UserTokenType.UserName, userName, password });
        const response: any = await (session as any).transferSubscriptions({
            subscriptionIds: [subscriptionId],
            sendInitialValues: false
        });
        const statusCode = response.results[0].statusCode;
        await session.close();
        return statusCode;
    } finally {
        await client.disconnect();
    }
}

describe("GHTR2 - cross-user TransferSubscriptions is denied over an unsecured channel (Part 4 §5.14.7)", function (this: Mocha.Context) {
    this.timeout(60_000);

    let server: OPCUAServer;
    let endpointUrl: string;

    before(async () => {
        server = await build_server_with_temperature_device({ port, allowAnonymous: true });
        endpointUrl = server.getEndpointUrl();
    });

    after(async () => {
        await server.shutdown();
    });

    it("GHTR2-A a different user must NOT take over an orphaned subscription", async () => {
        const subscriptionId = await orphanSubscriptionAs(endpointUrl, "user1", "password1");

        const statusCode = await transferAs(endpointUrl, "user2", "password2", subscriptionId);

        statusCode.should.eql(
            StatusCodes.BadUserAccessDenied,
            `user2 must not be able to transfer user1's orphaned subscription, got ${statusCode.toString()}`
        );
    });

    it("GHTR2-B the same user can reclaim its own orphaned subscription", async () => {
        const subscriptionId = await orphanSubscriptionAs(endpointUrl, "user1", "password1");

        const statusCode = await transferAs(endpointUrl, "user1", "password1", subscriptionId);

        statusCode.should.eql(
            StatusCodes.Good,
            `user1 must be able to reclaim its own orphaned subscription, got ${statusCode.toString()}`
        );
    });
});
