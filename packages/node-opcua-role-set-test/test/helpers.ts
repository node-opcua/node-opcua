/**
 * Shared test helpers for building in-process sessions whose SessionContext
 * simulates a user identity and a SecureChannel security mode.
 */
import { type AddressSpace, type IServerBase, type ISessionBase, PseudoSession, SessionContext } from "node-opcua-address-space";
import { MockContinuationPointManager } from "node-opcua-address-space/testHelpers";
import { NodeId } from "node-opcua-nodeid";
import { type IIdentityMappingStore, identitiesToBase64, ROLE_SET_ARCHIVE_VERSION, writeArchive } from "node-opcua-role-set-common";
import { AnonymousIdentityToken, MessageSecurityMode, type UserIdentityToken, UserNameIdentityToken } from "node-opcua-types";

/**
 * Seed a consolidated archive with the given identity store, so `installRoleSet`
 * loads it on startup (e.g. to bootstrap an admin -> SecurityAdmin mapping).
 */
export async function bootstrapArchive(persistencePath: string, store: IIdentityMappingStore, secret?: string): Promise<void> {
    await writeArchive(persistencePath, { version: ROLE_SET_ARCHIVE_VERSION, identities: identitiesToBase64(store) }, { secret });
}

/** A SessionContext for the given user identity + channel security mode (+ optional endpoint URL). */
export function makeSessionContext(
    server: IServerBase,
    userIdentityToken: UserIdentityToken,
    securityMode: MessageSecurityMode,
    endpointUrl?: string
): SessionContext {
    const session: ISessionBase = {
        getSessionId: () => NodeId.nullNodeId,
        continuationPointManager: new MockContinuationPointManager(),
        userIdentityToken,
        getEndpointUrl: () => endpointUrl,
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
