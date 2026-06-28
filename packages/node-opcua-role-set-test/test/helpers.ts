/**
 * Shared test helpers for building in-process sessions whose SessionContext
 * simulates a user identity and a SecureChannel security mode.
 */
import { type AddressSpace, type IServerBase, type ISessionBase, PseudoSession, SessionContext } from "node-opcua-address-space";
import { MockContinuationPointManager } from "node-opcua-address-space/testHelpers";
import { NodeId } from "node-opcua-nodeid";
import { AnonymousIdentityToken, MessageSecurityMode, type UserIdentityToken, UserNameIdentityToken } from "node-opcua-types";

/** A SessionContext for the given user identity + channel security mode. */
export function makeSessionContext(
    server: IServerBase,
    userIdentityToken: UserIdentityToken,
    securityMode: MessageSecurityMode
): SessionContext {
    const session: ISessionBase = {
        getSessionId: () => NodeId.nullNodeId,
        continuationPointManager: new MockContinuationPointManager(),
        userIdentityToken,
        channel: {
            securityMode,
            securityPolicy: "",
            clientCertificate: null,
            getTransportSettings: () => ({ maxMessageSize: 0 })
        }
    };
    return new SessionContext({ server, session });
}

/** A PseudoSession authenticated as `userName` (SignAndEncrypt by default). */
export function userSession(
    addressSpace: AddressSpace,
    server: IServerBase,
    userName: string,
    securityMode = MessageSecurityMode.SignAndEncrypt
): PseudoSession {
    return new PseudoSession(addressSpace, makeSessionContext(server, new UserNameIdentityToken({ userName }), securityMode));
}

/** A PseudoSession with an anonymous identity (SignAndEncrypt by default). */
export function anonymousSession(
    addressSpace: AddressSpace,
    server: IServerBase,
    securityMode = MessageSecurityMode.SignAndEncrypt
): PseudoSession {
    return new PseudoSession(addressSpace, makeSessionContext(server, new AnonymousIdentityToken(), securityMode));
}
