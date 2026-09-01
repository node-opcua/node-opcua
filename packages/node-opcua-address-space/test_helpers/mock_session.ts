import type {
    ContinuationData,
    IChannelBase,
    IContinuationPointInfo,
    IContinuationPointManager,
    ISessionBase,
    UAObject,
    UAObjectType
} from "node-opcua-address-space-base";
import type { Certificate } from "node-opcua-crypto/web";
import type { DataValue } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import type { ReferenceDescription } from "node-opcua-service-browse";
import { AnonymousIdentityToken, MessageSecurityMode, UserNameIdentityToken } from "node-opcua-types";
import { type AnyUserIdentityToken, type IServerBase, SessionContext } from "../dist/api/index.js";

export class MockContinuationPointManager implements IContinuationPointManager {
    public registerHistoryReadRaw(
        _maxElements: number,
        _dataValues: DataValue[],
        _cnt: ContinuationData
    ): IContinuationPointInfo<DataValue> {
        throw new Error("Method not implemented.");
    }
    public getNextHistoryReadRaw(_numValues: number, _cnt: ContinuationData): IContinuationPointInfo<DataValue> {
        throw new Error("Method not implemented.");
    }
    public registerReferences(
        _maxElements: number,
        _values: ReferenceDescription[],
        _cnt: ContinuationData
    ): IContinuationPointInfo<ReferenceDescription> {
        throw new Error("Method not implemented.");
    }
    public getNextReferences(_numValue: number, _cnt: ContinuationData): IContinuationPointInfo<ReferenceDescription> {
        throw new Error("Method not implemented.");
    }
    public dispose(): void {
        // do nothing
    }
}

export const mockSession: ISessionBase = {
    getSessionId() {
        return new NodeId();
    },
    continuationPointManager: new MockContinuationPointManager()
};

export interface MockSessionContextOptions {
    /**
     * user name carried by the Session's UserIdentityToken.
     * `"anonymous"` produces an AnonymousIdentityToken; omitting it produces a Session
     * with no token at all, i.e. one that was never activated. Either way the Session
     * exists, which is what distinguishes this from SessionContext.defaultContext.
     */
    userName?: string;
    /**
     * the UserIdentityToken itself, when `userName` cannot express it — an X509IdentityToken,
     * or a UserNameIdentityToken carrying a policyId. Takes precedence over `userName`.
     */
    userIdentityToken?: AnyUserIdentityToken;
    /**
     * SecureChannel security mode seen by isAccessRestricted().
     *
     * Leaving this undefined is the trap this helper exists to avoid: a node carrying
     * AccessRestrictions SigningRequired then fails with BadSecurityModeInsufficient,
     * because a hand-written mock that omits `channel` reads back securityMode ===
     * undefined rather than "no restriction".
     * @default MessageSecurityMode.None
     */
    securityMode?: MessageSecurityMode;
    /** @default "" */
    securityPolicy?: string;
    /** client application-instance certificate, for the X509 / applicationUri paths */
    clientCertificate?: Certificate | null;
    /**
     * pass `null` to attach no SecureChannel at all — a Session created but not yet bound
     * to a channel. Otherwise a channel is synthesized from securityMode / securityPolicy /
     * clientCertificate, or you may supply a complete one.
     */
    channel?: IChannelBase | null;
    /**
     * the Session's continuation point manager. The default throws on use, which is what
     * you want unless the code under test really browses or reads history through it.
     */
    continuationPointManager?: IContinuationPointManager;
    /** the server whose userManager / roleResolvers resolve this user's Roles */
    server?: IServerBase;
    /** the object a Method is being called on */
    object?: UAObject | UAObjectType;
    /** endpoint URL the Session was created on */
    endpointUrl?: string;
}

/**
 * Build a SessionContext that simulates a remote Session on a SecureChannel.
 *
 * Writing this by hand means assembling an ISessionBase and an IChannelBase and casting
 * through `any`; every field omitted silently reads back as undefined, which is not the
 * same as a permissive default. Use this instead:
 *
 * ```ts
 * const context = makeMockSessionContext({
 *     userName: "admin",
 *     securityMode: MessageSecurityMode.SignAndEncrypt,
 *     server
 * });
 * ```
 *
 * For an in-process caller with no Session at all, use SessionContext.defaultContext —
 * that one is granted every permission by design.
 */
export function makeMockSessionContext(options?: MockSessionContextOptions): SessionContext {
    const {
        userName,
        userIdentityToken,
        securityMode = MessageSecurityMode.None,
        securityPolicy = "",
        clientCertificate = null,
        channel,
        continuationPointManager = new MockContinuationPointManager(),
        server,
        object,
        endpointUrl
    } = options || {};

    const makeChannel = (): IChannelBase | undefined => {
        if (channel !== undefined) {
            return channel ?? undefined; // null means: no SecureChannel at all
        }
        return {
            clientCertificate,
            securityMode,
            securityPolicy,
            getTransportSettings() {
                return { maxMessageSize: 0 };
            }
        };
    };

    const makeIdentityToken = (): AnyUserIdentityToken | undefined => {
        if (userIdentityToken !== undefined) {
            return userIdentityToken;
        }
        if (userName === undefined) {
            return undefined; // a Session that was never activated
        }
        return userName === "anonymous" ? new AnonymousIdentityToken() : new UserNameIdentityToken({ userName });
    };

    const session: ISessionBase = {
        getSessionId() {
            return NodeId.nullNodeId;
        },
        continuationPointManager,
        userIdentityToken: makeIdentityToken(),
        channel: makeChannel(),
        getEndpointUrl() {
            return endpointUrl;
        }
    };

    return new SessionContext({ session, server, object });
}
