import { assert } from "node-opcua-assert";
import { MessageSecurityMode } from "node-opcua-secure-channel";
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
    /** ApplicationUri of the owning client, used for the anonymous-user transfer rule. */
    applicationUri?: string | null;
    /** MessageSecurityMode of the channel the session was operating on, used for the anonymous-user rule. */
    securityMode?: MessageSecurityMode;
}

export interface SessionsCompatibleForTransferOptions {
    /**
     * OPC UA Part 4 §5.14.7 requires that an anonymous user may only transfer a Subscription when the
     * old and the new Session share the same ApplicationUri AND the channel MessageSecurityMode is
     * Sign or SignAndEncrypt. Setting this flag to `true` relaxes that requirement and restores the
     * legacy behaviour of accepting anonymous-to-anonymous transfers over an unsecured channel.
     * @default false
     */
    allowAnonymousTransferOnUnsecuredChannel?: boolean;
}

/**
 * Extract the transfer-relevant identity from a Session.
 */
export function getTransferSessionIdentity(session: ServerSession): ITransferSessionIdentity {
    return {
        userIdentityToken: session.userIdentityToken,
        applicationUri: session.clientDescription ? session.clientDescription.applicationUri : undefined,
        securityMode: session.channel ? session.channel.securityMode : undefined
    };
}

function isSecuredChannel(securityMode: MessageSecurityMode | undefined): boolean {
    return securityMode === MessageSecurityMode.Sign || securityMode === MessageSecurityMode.SignAndEncrypt;
}

/**
 * Determine whether a Subscription owned by `sourceIdentity` may be transferred to `sessionDest`.
 *
 * OPC UA Part 4 §5.14.7 requires that the Server validate that the Client of the destination Session
 * is operating on behalf of the same user as the Session that owns the Subscription:
 *  - for a non-anonymous user, the ClientUserId (UserName / X509 subject / ...) must match;
 *  - for an anonymous user (whose ClientUserId is null), the ApplicationUri must match and the channel
 *    MessageSecurityMode must be Sign or SignAndEncrypt.
 *
 * The identity of the owning Session must therefore be known: when it cannot be established the
 * transfer is refused rather than allowed.
 */
export function sessionsCompatibleForTransfer(
    sourceIdentity: ITransferSessionIdentity | undefined,
    sessionDest: ServerSession,
    options?: SessionsCompatibleForTransferOptions
): boolean {
    assert(sessionDest);
    // The identity of the owning Session must be known in order to enforce the ownership check.
    if (!sourceIdentity) {
        return false;
    }
    const destIdentity = getTransferSessionIdentity(sessionDest);

    const srcToken = sourceIdentity.userIdentityToken;
    const destToken = destIdentity.userIdentityToken;

    if (!srcToken && !destToken) {
        return true;
    }
    if (srcToken instanceof AnonymousIdentityToken) {
        if (!(destToken instanceof AnonymousIdentityToken)) {
            return false;
        }
        // Legacy escape hatch: accept anonymous-to-anonymous transfers over any channel.
        if (options?.allowAnonymousTransferOnUnsecuredChannel) {
            return true;
        }
        // §5.14.7: for anonymous users the ApplicationUri must match and both the old and the new
        // Session must operate on a secured (Sign / SignAndEncrypt) channel, so that the ApplicationUri
        // claim is backed by an authenticated application instance certificate.
        if (!isSecuredChannel(sourceIdentity.securityMode) || !isSecuredChannel(destIdentity.securityMode)) {
            return false;
        }
        if (!sourceIdentity.applicationUri || !destIdentity.applicationUri) {
            return false;
        }
        return sourceIdentity.applicationUri === destIdentity.applicationUri;
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
