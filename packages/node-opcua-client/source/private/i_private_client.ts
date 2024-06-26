import { ClientSecureChannelLayer } from "node-opcua-secure-channel";
import { EndpointDescription } from "node-opcua-service-endpoints";
import { IBasicTransportSettings, ResponseCallback } from "node-opcua-pseudo-session";

import { ClientSession } from "../client_session";
import { Request, Response } from "../common";
import { UserIdentityInfo } from "../user_identity_info";
import { ClientSessionImpl } from "./client_session_impl";

export interface IClientBase {
    __createSession_step2(session: ClientSessionImpl, callback: (err: Error | null, session?: ClientSessionImpl) => void): void;
    _activateSession(
        session: ClientSessionImpl,
        userIdentity: UserIdentityInfo,
        callback: (err: Error | null, session?: ClientSessionImpl) => void
    ): void;
    _removeSession(session: ClientSessionImpl): void;
    closeSession(session: ClientSession, deleteSubscription: any, arg2: (err?: Error | undefined) => void): void;

    performMessageTransaction(request: Request, callback: ResponseCallback<Response>): void;
    endpoint?: EndpointDescription;
    readonly isReconnecting: boolean;
    _secureChannel: ClientSecureChannelLayer | null;
    getSessions(): ClientSession[];
    endpointUrl: string;
    _sessions: ClientSessionImpl[];

    getTransportSettings(): IBasicTransportSettings;

    isUnusable(): boolean;

    beforeSubscriptionRecreate?: (session: ClientSession) => Promise<Error | undefined>
}
