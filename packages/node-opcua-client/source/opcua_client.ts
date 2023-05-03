/**
 * @module node-opcua-client
 */

import { ByteString } from "node-opcua-basic-types";
import { Certificate, PrivateKeyPEM } from "node-opcua-crypto";
import { ConnectionStrategyOptions, Message, SecurityPolicy } from "node-opcua-secure-channel";
import { ApplicationDescription, EndpointDescription, UserTokenType } from "node-opcua-service-endpoints";
import { MessageSecurityMode } from "node-opcua-service-secure-channel";
import { X509IdentityTokenOptions } from "node-opcua-types";
import { CallbackT, ErrorCallback, StatusCode } from "node-opcua-status-code";
import { FindServersRequestLike, GetEndpointsOptions, OPCUAClientBase, OPCUAClientBaseOptions } from "./client_base";

import { ClientSession, ResponseCallback } from "./client_session";
import { ClientSubscription, ClientSubscriptionOptions } from "./client_subscription";
import { OPCUAClientImpl } from "./private/opcua_client_impl";
import { UserIdentityInfo } from "./user_identity_info";

export interface OPCUAClientOptions extends OPCUAClientBaseOptions {
    /**
     * the requested session timeout in CreateSession (ms)
     *
     * Note:
     *    - make sure that this value is large enough, especially larger than the
     *      time between two transactions to the server.
     *
     *    - If your client establishes a subscription with the server, make sure that
     *      (maxKeepAliveCount * publishingInterval) calculated with negotiated values
     *      from the server  stay by large below the session time out, as you make
     *      encountered unexpected behavior.
     *
     * @default 60000 - default value is 60 secondes
     */
    requestedSessionTimeout?: number;

    /**
     *  @deprecated(use endpointMustExist instead)
     */
    endpoint_must_exist?: boolean;
    /**
     * set to false if the client should accept server endpoint mismatch
     * @default true
     */
    endpointMustExist?: boolean;
}

export interface OPCUAClient extends OPCUAClientBase {
    connect(endpointUrl: string): Promise<void>;
    connect(endpointUrl: string, callback: ErrorCallback): void;

    disconnect(): Promise<void>;
    disconnect(callback: ErrorCallback): void;

    getEndpoints(options?: GetEndpointsOptions): Promise<EndpointDescription[]>;

    getEndpoints(options: GetEndpointsOptions, callback: ResponseCallback<EndpointDescription[]>): void;

    getEndpoints(callback: ResponseCallback<EndpointDescription[]>): void;

    findServers(options?: FindServersRequestLike): Promise<ApplicationDescription[]>;

    findServers(options: FindServersRequestLike, callback: ResponseCallback<ApplicationDescription[]>): void;

    findServers(callback: ResponseCallback<ApplicationDescription[]>): void;

    createSession(userIdentityInfo?: UserIdentityInfo): Promise<ClientSession>;

    createSession(userIdentityInfo: UserIdentityInfo, callback: (err: Error | null, session?: ClientSession) => void): void;

    createSession(callback: (err: Error | null, session?: ClientSession) => void): void;

    createSession2(userIdentityInfo?: UserIdentityInfo): Promise<ClientSession>;

    createSession2(userIdentityInfo: UserIdentityInfo, callback: (err: Error | null, session?: ClientSession) => void): void;

    createSession2(callback: (err: Error | null, session?: ClientSession) => void): void;

    /** @deprecated */
    changeSessionIdentity(session: ClientSession, userIdentityInfo: UserIdentityInfo): Promise<StatusCode>;
    changeSessionIdentity(session: ClientSession, userIdentityInfo: UserIdentityInfo, callback: CallbackT<StatusCode>): void;

    closeSession(session: ClientSession, deleteSubscriptions: boolean): Promise<void>;

    closeSession(session: ClientSession, deleteSubscriptions: boolean, callback: (err?: Error) => void): void;

    reactivateSession(session: ClientSession): Promise<void>;

    reactivateSession(session: ClientSession, callback: (err?: Error) => void): void;

    // @private
    createDefaultCertificate(): Promise<void>;
}

export interface EndpointWithUserIdentity {
    endpointUrl: string;
    userIdentity: UserIdentityInfo;
}
export type WithSessionFunc = (session: ClientSession) => Promise<void>;
export type WithSessionFuncP<T> = (session: ClientSession) => Promise<T>;
export type WithSubscriptionFunc = (session: ClientSession, subscription: ClientSubscription) => Promise<void>;
export type WithSubscriptionFuncP<T> = (session: ClientSession, subscription: ClientSubscription) => Promise<T>;

export interface OPCUAClient {
    withSessionAsync<T>(endpointUrl: string | EndpointWithUserIdentity, inner_func: WithSessionFuncP<T>): Promise<T>;

    withSession(
        endpointUrl: string | EndpointWithUserIdentity,
        inner_func: (session: ClientSession, done: (err?: Error) => void) => void,
        callback: (err?: Error) => void
    ): void;

    withSubscriptionAsync<T>(
        endpointUrl: string | EndpointWithUserIdentity,
        parameters: ClientSubscriptionOptions,
        inner_func: WithSubscriptionFuncP<T>
    ): Promise<T>;
}

export class OPCUAClient {
    public static create(options: OPCUAClientOptions): OPCUAClient {
        return new OPCUAClientImpl(options);
    }
    public static async createSession(
        endpointUrl: string,
        userIdentity?: UserIdentityInfo,
        clientOptions?: OPCUAClientOptions
    ): Promise<ClientSession> {
        return OPCUAClientImpl.createSession(endpointUrl, userIdentity, clientOptions);
    }
    public static set minimumRevisedSessionTimeout(minimumRevisedSessionTimeout: number) {
        OPCUAClientImpl.minimumRevisedSessionTimeout = minimumRevisedSessionTimeout;
    }
    public static get minimumRevisedSessionTimeout(): number {
        return OPCUAClientImpl.minimumRevisedSessionTimeout;
    }
}
