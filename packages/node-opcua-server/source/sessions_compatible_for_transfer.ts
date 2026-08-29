import { assert } from "node-opcua-assert";
import { makeSHA1Thumbprint } from "node-opcua-crypto";
import { MessageSecurityMode } from "node-opcua-secure-channel";
import { AnonymousIdentityToken, type UserIdentityToken, UserNameIdentityToken, X509IdentityToken } from "node-opcua-types";
import type { ServerSession } from "./server_session.js";

/**
 * Discriminates a session's user identity for the purpose of the TransferSubscriptions ownership
 * check. `unsupported` covers any token type we cannot safely represent (e.g. IssuedIdentityToken) and
 * always results in the transfer being refused.
 */
export type TransferUserIdentityKind = "none" | "anonymous" | "username" | "x509" | "unsupported";

/**
 * The subset of a Session's identity that OPC UA Part 4 §5.14.7 (TransferSubscriptions) requires in
 * order to decide whether a Subscription may be transferred to another Session.
 *
 * A snapshot of this identity is retained on the Subscription so that the ownership / user-identity
 * check can still be enforced once the owning Session is no longer available (for example after a
 * Session times out and its Subscriptions are moved to the orphan publish engine).
 *
 * Only a minimal, non-secret identity key is kept: it never stores the raw UserIdentityToken, which for
 * UserNameIdentityToken / IssuedIdentityToken would carry sensitive bytes (Password / TokenData).
 */
export interface ITransferSessionIdentity {
    kind: TransferUserIdentityKind;
    /** set when kind === "username" */
    userName?: string;
    /** set when kind === "x509": SHA1 thumbprint (hex) of the user certificate (a certificate is public) */
    certificateThumbprint?: string;
    /** ApplicationUri of the owning client, used for the anonymous-user transfer rule. */
    applicationUri?: string | null;
    /** MessageSecurityMode of the channel the session was operating on, used for the anonymous-user rule. */
    securityMode?: MessageSecurityMode;
}

export interface SessionsCompatibleForTransferOptions {
    /**
     * OPC UA Part 4 §5.14.7 requires that an anonymous user may only transfer a Subscription when the
     * old and the new Session share the same ApplicationUri AND the channel MessageSecurityMode is Sign
     * or SignAndEncrypt. Setting this flag to `true` relaxes that requirement and accepts
     * anonymous-to-anonymous transfers over an unsecured channel.
     * @default false
     */
    allowAnonymousTransferOnUnsecuredChannel?: boolean;
}

function classifyUserIdentity(
    token: UserIdentityToken | undefined
): Pick<ITransferSessionIdentity, "kind" | "userName" | "certificateThumbprint"> {
    if (!token) {
        return { kind: "none" };
    }
    if (token instanceof AnonymousIdentityToken) {
        return { kind: "anonymous" };
    }
    if (token instanceof UserNameIdentityToken) {
        return { kind: "username", userName: token.userName || "" };
    }
    if (token instanceof X509IdentityToken) {
        return { kind: "x509", certificateThumbprint: makeSHA1Thumbprint(token.certificateData).toString("hex") };
    }
    // IssuedIdentityToken or any unknown/unsupported token: we cannot derive a safe, non-secret key,
    // so treat it as unsupported and let the transfer fail closed.
    return { kind: "unsupported" };
}

/**
 * Extract the (non-secret) transfer-relevant identity from a Session.
 */
export function getTransferSessionIdentity(session: ServerSession): ITransferSessionIdentity {
    const { kind, userName, certificateThumbprint } = classifyUserIdentity(session.userIdentityToken);
    return {
        kind,
        userName,
        certificateThumbprint,
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
 * The identity of the owning Session must therefore be known: when it cannot be established (missing or
 * unsupported identity token) the transfer is refused rather than allowed - and never raises.
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
    const dest = getTransferSessionIdentity(sessionDest);

    // An identity token we cannot safely represent -> we cannot validate ownership -> fail closed.
    if (sourceIdentity.kind === "unsupported" || dest.kind === "unsupported") {
        return false;
    }
    // Both sessions must be operating with the same kind of identity (also covers "one side missing").
    if (sourceIdentity.kind !== dest.kind) {
        return false;
    }
    switch (sourceIdentity.kind) {
        case "none":
            // neither session carries a user identity token
            return true;
        case "anonymous": {
            // Legacy escape hatch: accept anonymous-to-anonymous transfers over any channel.
            if (options?.allowAnonymousTransferOnUnsecuredChannel) {
                return true;
            }
            // §5.14.7: for anonymous users the ApplicationUri must match and both the old and the new
            // Session must operate on a secured (Sign / SignAndEncrypt) channel.
            if (!isSecuredChannel(sourceIdentity.securityMode) || !isSecuredChannel(dest.securityMode)) {
                return false;
            }
            if (!sourceIdentity.applicationUri || !dest.applicationUri) {
                return false;
            }
            return sourceIdentity.applicationUri === dest.applicationUri;
        }
        case "username":
            return !!sourceIdentity.userName && sourceIdentity.userName === dest.userName;
        case "x509":
            return !!sourceIdentity.certificateThumbprint && sourceIdentity.certificateThumbprint === dest.certificateThumbprint;
        default:
            /* c8 ignore next */
            return false;
    }
}
