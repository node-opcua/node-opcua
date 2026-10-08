/**
 * @module node-opcua-server
 *
 * TransferSubscriptions (OPC 10000-4 5.13.7) for a Subscription of this thread: what ServerEngine and
 * the session workers of the front threads do the same way, the ownership check first.
 */
import { TransferResult } from "node-opcua-service-subscription";
import { StatusCodes } from "node-opcua-status-code";
import { ServerSidePublishEngine } from "./server_publish_engine.js";
import type { ServerSession } from "./server_session.js";
import type { Subscription } from "./server_subscription.js";
import {
    getTransferSessionIdentity,
    type ITransferSessionIdentity,
    type SessionsCompatibleForTransferOptions,
    sessionsCompatibleForTransfer
} from "./sessions_compatible_for_transfer.js";

/** the identity a Subscription belongs to: its Session's, or the one kept when its Session closed without deleting it */
export function ownerIdentityOf(subscription: Subscription): ITransferSessionIdentity | undefined {
    return subscription.$session ? getTransferSessionIdentity(subscription.$session) : subscription.$transferSessionIdentity;
}

/**
 * moves `subscription` to `session`, both of this thread: refused (BadUserAccessDenied) unless the
 * destination Session acts for the same user, BadNothingToDo when it already is that Session's
 */
export async function transferSubscriptionToSession(
    subscription: Subscription,
    session: ServerSession,
    sendInitialValues: boolean,
    options: SessionsCompatibleForTransferOptions
): Promise<TransferResult> {
    // the destination Session must act for the user of the Session that owns the Subscription; an orphan
    // Subscription keeps the identity its Session had when it closed
    if (!sessionsCompatibleForTransfer(ownerIdentityOf(subscription), session, options)) {
        return new TransferResult({ statusCode: StatusCodes.BadUserAccessDenied });
    }
    subscription.subscriptionDiagnostics.transferRequestCount++;
    if (session.publishEngine === (subscription.publishEngine as unknown) || session === subscription.$session) {
        // already this Session's
        return new TransferResult({ statusCode: StatusCodes.BadNothingToDo });
    }
    // the number of times the subscription has been transferred to an alternate client, and session for the same client
    subscription.subscriptionDiagnostics.transferredToAltClientCount++;
    subscription.subscriptionDiagnostics.transferredToSameClientCount++;
    subscription.$session?._unexposeSubscriptionDiagnostics(subscription);
    subscription.$session = session;
    await ServerSidePublishEngine.transferSubscription(subscription, session.publishEngine, sendInitialValues);
    session._exposeSubscriptionDiagnostics(subscription);
    return new TransferResult({
        availableSequenceNumbers: subscription.getAvailableSequenceNumbers(),
        statusCode: StatusCodes.Good
    });
}
