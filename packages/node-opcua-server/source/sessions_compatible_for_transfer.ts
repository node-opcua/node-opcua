import { assert } from "node-opcua-assert";
import {
    AnonymousIdentityToken,
    type UserIdentityToken,
    UserNameIdentityToken,
    X509IdentityToken
} from "node-opcua-types";
import type { ServerSession } from "./server_session";

/**
 * The subset of a Session's identity that OPC UA Part 4 §5.14.7 (TransferSubscriptions) requires
 * in order to decide whether a Subscription may be transferred to another Session.
 *
 * A snapshot of this identity is retained on the Subscription so that the ownership / user-identity
 * check can still be enforced once the owning Session is no longer available (for example after a
 * Session times out and its Subscriptions are moved to the orphan publish engine).
 */
export interface ITransferSessionIdentity {
    userIdentityToken?: UserIdentityToken;
}

/**
 * Extract the transfer-relevant identity from a Session.
 */
export function getTransferSessionIdentity(session: ServerSession): ITransferSessionIdentity {
    return {
        userIdentityToken: session.userIdentityToken
    };
}

/**
 * Determine whether a Subscription owned by `sourceIdentity` may be transferred to `sessionDest`.
 *
 * OPC UA Part 4 §5.14.7 requires that the Server validate that the Client of the destination Session
 * is operating on behalf of the same user as the Session that owns the Subscription. The identity of
 * the owning Session must therefore be known: when it cannot be established the transfer is refused
 * rather than allowed.
 */
export function sessionsCompatibleForTransfer(
    sourceIdentity: ITransferSessionIdentity | undefined,
    sessionDest: ServerSession
): boolean {
    assert(sessionDest);
    // The identity of the owning Session must be known in order to enforce the ownership check.
    if (!sourceIdentity) {
        return false;
    }
    const srcToken = sourceIdentity.userIdentityToken;
    const destToken = sessionDest.userIdentityToken;

    if (!srcToken && !destToken) {
        return true;
    }
    if (srcToken instanceof AnonymousIdentityToken) {
        if (!(destToken instanceof AnonymousIdentityToken)) {
            return false;
        }
        return true;
    } else if (srcToken instanceof UserNameIdentityToken) {
        if (!(destToken instanceof UserNameIdentityToken)) {
            return false;
        }
        return srcToken.userName === destToken.userName;
    } else if (srcToken instanceof X509IdentityToken) {
        if (!(destToken instanceof X509IdentityToken)) {
            return false;
        }
        return srcToken.certificateData.toString("hex") === destToken.certificateData.toString("hex");
    } else {
        /* c8 ignore next */
        throw new Error("Unsupported Identity token");
    }
}
