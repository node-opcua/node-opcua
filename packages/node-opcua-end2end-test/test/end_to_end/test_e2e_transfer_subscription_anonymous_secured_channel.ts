import {
    type ClientSession,
    type ClientSessionRawSubscriptionService,
    MessageSecurityMode,
    OPCUAClient,
    type OPCUAServer,
    SecurityPolicy,
    StatusCodes,
    type TransferSubscriptionsRequestLike,
    type TransferSubscriptionsResponse
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import { build_server_with_temperature_device } from "../../test_helpers/build_server_with_temperature_device.js";

// transferSubscriptions() is declared on the raw subscription service, deliberately
// excluded from the public ClientSession interface. Its optional-callback overload
// wins resolution for a single-arg call, so re-declare the Promise-only form.
type RawSession = Omit<ClientSession & ClientSessionRawSubscriptionService, "transferSubscriptions"> & {
    transferSubscriptions(options: TransferSubscriptionsRequestLike): Promise<TransferSubscriptionsResponse>;
};

// -------------------------------------------------------------------------------------------------
// OPC UA Part 4 5.13.7 (TransferSubscriptions) - the anonymous-session rule.
//
// A Subscription created by an anonymous session may only be transferred to another session when the
// SecureChannel MessageSecurityMode is Sign or SignAndEncrypt and the client certificate's
// ApplicationUri is the one of the original session. The CTT (1.05.513, Subscription Transfer
// Err-017) expects a server to refuse the transfer over a None channel.
//
// node-opcua enforces the rule by default (allowAnonymousSubscriptionTransferOnUnsecuredChannel:
// false) and refuses with Bad_UserAccessDenied; the option set to true restores the relaxed
// behaviour (anonymous transfer accepted over a None endpoint).
// -------------------------------------------------------------------------------------------------

const port = 5801;

interface Security {
    securityMode: MessageSecurityMode;
    securityPolicy: SecurityPolicy;
}
const none: Security = { securityMode: MessageSecurityMode.None, securityPolicy: SecurityPolicy.None };
const sign: Security = { securityMode: MessageSecurityMode.Sign, securityPolicy: SecurityPolicy.Basic256Sha256 };
const signAndEncrypt: Security = {
    securityMode: MessageSecurityMode.SignAndEncrypt,
    securityPolicy: SecurityPolicy.Basic256Sha256
};

async function orphanAnonymousSubscription(endpointUrl: string, security: Security): Promise<number> {
    // an anonymous session creates a subscription, then closes WITHOUT deleting it: the subscription
    // stays on the server, orphaned, the way a reconnecting client leaves it.
    const client = OPCUAClient.create({ endpointMustExist: false, ...security });
    await client.connect(endpointUrl);
    try {
        const session = await client.createSession();
        const subscription = await session.createSubscription2({
            requestedPublishingInterval: 100,
            requestedLifetimeCount: 10 * 60,
            requestedMaxKeepAliveCount: 5,
            maxNotificationsPerPublish: 2,
            publishingEnabled: true,
            priority: 6
        });
        const subscriptionId = subscription.subscriptionId;
        await session.close(/* deleteSubscriptions */ false);
        return subscriptionId;
    } finally {
        await client.disconnect();
    }
}

async function transferAnonymously(endpointUrl: string, security: Security, subscriptionId: number): Promise<StatusCodes> {
    // the same client certificate (the OPCUAClient default) so the ApplicationUri matches the original
    // session: only the channel security mode varies between the scenarios.
    const client = OPCUAClient.create({ endpointMustExist: false, ...security });
    await client.connect(endpointUrl);
    try {
        const session = await client.createSession();
        try {
            const response = await (session as RawSession).transferSubscriptions({
                subscriptionIds: [subscriptionId],
                sendInitialValues: false
            });
            should(response.results).be.an.Array().and.have.length(1);
            const statusCode = response.results?.[0].statusCode ?? StatusCodes.BadInternalError;
            if (statusCode.equals(StatusCodes.Good)) {
                await (session as RawSession).deleteSubscriptions({ subscriptionIds: [subscriptionId] });
            }
            return statusCode;
        } finally {
            await session.close(true);
        }
    } finally {
        await client.disconnect();
    }
}

async function startServer(allowAnonymousSubscriptionTransferOnUnsecuredChannel?: boolean): Promise<OPCUAServer> {
    return await build_server_with_temperature_device({
        port,
        allowAnonymous: true,
        ...(allowAnonymousSubscriptionTransferOnUnsecuredChannel === undefined
            ? {}
            : { allowAnonymousSubscriptionTransferOnUnsecuredChannel })
    });
}

describe("GHTR3 - anonymous TransferSubscriptions and the channel security mode (Part 4 5.13.7)", function (this: Mocha.Context) {
    this.timeout(60_000);

    describe("GHTR3-default - the rule is enforced when the option is not set", () => {
        let server: OPCUAServer;
        let endpointUrl: string;

        before(async () => {
            server = await startServer();
            endpointUrl = server.getEndpointUrl();
        });

        after(async () => {
            await server.shutdown();
        });

        it("GHTR3-A the default is the conformant one", () => {
            should(server.engine.allowAnonymousSubscriptionTransferOnUnsecuredChannel).eql(false);
        });

        it("GHTR3-B an anonymous session on a None endpoint cannot take over an anonymous subscription", async () => {
            const subscriptionId = await orphanAnonymousSubscription(endpointUrl, none);
            const statusCode = await transferAnonymously(endpointUrl, none, subscriptionId);
            should(statusCode).eql(
                StatusCodes.BadUserAccessDenied,
                `the transfer over a None channel must be refused, got ${statusCode.toString()}`
            );
        });

        it("GHTR3-C the transfer succeeds over Sign with the same client certificate", async () => {
            const subscriptionId = await orphanAnonymousSubscription(endpointUrl, sign);
            const statusCode = await transferAnonymously(endpointUrl, sign, subscriptionId);
            should(statusCode).eql(StatusCodes.Good, `the transfer over Sign must succeed, got ${statusCode.toString()}`);
        });

        it("GHTR3-D the transfer succeeds over SignAndEncrypt with the same client certificate", async () => {
            const subscriptionId = await orphanAnonymousSubscription(endpointUrl, signAndEncrypt);
            const statusCode = await transferAnonymously(endpointUrl, signAndEncrypt, subscriptionId);
            should(statusCode).eql(StatusCodes.Good, `the transfer over SignAndEncrypt must succeed, got ${statusCode.toString()}`);
        });

        it("GHTR3-E a subscription created over SignAndEncrypt cannot be taken over from a None channel", async () => {
            const subscriptionId = await orphanAnonymousSubscription(endpointUrl, signAndEncrypt);
            const statusCode = await transferAnonymously(endpointUrl, none, subscriptionId);
            should(statusCode).eql(
                StatusCodes.BadUserAccessDenied,
                `the transfer from a None channel must be refused, got ${statusCode.toString()}`
            );
        });
    });

    describe("GHTR3-relaxed - allowAnonymousSubscriptionTransferOnUnsecuredChannel: true", () => {
        let server: OPCUAServer;
        let endpointUrl: string;

        before(async () => {
            server = await startServer(true);
            endpointUrl = server.getEndpointUrl();
        });

        after(async () => {
            await server.shutdown();
        });

        it("GHTR3-F an anonymous session on a None endpoint takes over an anonymous subscription (pre-2.183 behaviour)", async () => {
            const subscriptionId = await orphanAnonymousSubscription(endpointUrl, none);
            const statusCode = await transferAnonymously(endpointUrl, none, subscriptionId);
            should(statusCode).eql(StatusCodes.Good, `the relaxed server must accept the transfer, got ${statusCode.toString()}`);
        });
    });
});
