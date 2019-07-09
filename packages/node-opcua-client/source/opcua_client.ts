/**
 * @module node-opcua-client
 */

// tslint:disable:variable-name
import { EventEmitter } from "events";
import {
    Certificate,
    exploreCertificate,
    extractPublicKeyFromCertificateSync,
    Nonce,
    PrivateKey,
    PrivateKeyPEM,
    toPem
} from "node-opcua-crypto";
import {
    ConnectionStrategyOptions,
    ErrorCallback,
    SecurityPolicy
} from "node-opcua-secure-channel";
import {
    ApplicationDescription,
    ApplicationDescriptionOptions,
    ApplicationType,
    EndpointDescription,
    UserTokenType
} from "node-opcua-service-endpoints";
import { MessageSecurityMode } from "node-opcua-service-secure-channel";
import { X509IdentityTokenOptions } from "node-opcua-types";
import {
    FindServersRequestLike,
    GetEndpointsOptions,
    OPCUAClientBase,
    OPCUAClientBaseOptions
} from "./client_base";

import { ByteString } from "node-opcua-basic-types";
import { ClientSession, ResponseCallback } from "./client_session";
import { ClientSubscription } from "./client_subscription";
import { OPCUAClientImpl } from "./private/opcua_client_impl";

export interface UserIdentityInfoUserName {
    type: UserTokenType.UserName;
    userName: string;
    password: string;
}

export interface UserIdentityInfoX509 extends X509IdentityTokenOptions {
    type: UserTokenType.Certificate;
    certificateData: ByteString;
    privateKey: PrivateKeyPEM;
}
export interface AnonymousIdentity {
    type: UserTokenType.Anonymous;
}

export type UserIdentityInfo = AnonymousIdentity | UserIdentityInfoX509 | UserIdentityInfoUserName;

export interface OPCUAClientOptions extends OPCUAClientBaseOptions {

    /**
     * the requested session timeout in CreateSession (ms)
     * @default 60000
     */

    requestedSessionTimeout?: number;
    /**
     * set to false if the client should accept server endpoint mismatch
     * @default true
     */
    endpoint_must_exist?: boolean;

// --------------------------------------------------------------------
    connectionStrategy?: ConnectionStrategyOptions;

    /** the server certificate. */
    serverCertificate?: Certificate;

    /***
     * default secure token lifetime in ms
     */
    defaultSecureTokenLifetime?: number;

    /**
     * the security mode
     * @default MessageSecurityMode.None
     */
    securityMode?: MessageSecurityMode | string;

    /**
     * the security policy
     * @default SecurityPolicy.None
     */
    securityPolicy?: SecurityPolicy | string;

    /**
     * @default false
     */
    keepSessionAlive?: boolean;

    /**
     * client certificate pem file.
     * @default "certificates/client_self-signed_cert_2048.pem"
     */
    certificateFile?: string;

    /**
     * client private key pem file.
     * @default "certificates/client_key_2048.pem"
     */
    privateKeyFile?: string;

    /**
     * a client name string that will be used to generate session names.
     */
    clientName?: string;
}

export interface OPCUAClient extends OPCUAClientBase  {

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

    createSession(
      userIdentityInfo: UserIdentityInfo,
      callback: (err: Error | null, session?: ClientSession) => void): void;

    createSession(callback: (err: Error | null, session?: ClientSession) => void): void;

    changeSessionIdentity(
      session: ClientSession,
      userIdentityInfo: UserIdentityInfo
    ): Promise<void>;

    changeSessionIdentity(
      session: ClientSession,
      userIdentityInfo: UserIdentityInfo,
      callback: (err?: Error) => void
    ): void;

    closeSession(session: ClientSession, deleteSubscriptions: boolean): Promise<void>;

    closeSession(session: ClientSession, deleteSubscriptions: boolean, callback: (err?: Error) => void): void;

    reactivateSession(session: ClientSession): Promise<void>;

    reactivateSession(session: ClientSession, callback: (err?: Error) => void): void;

    withSessionAsync<T>(
      endpointUrl: string,
      inner_func: (session: ClientSession) => Promise<T>
    ): Promise<T>;

    withSession(endpointUrl: string,
                inner_func: (session: ClientSession, done: (err?: Error) => void) => void,
                callback: (err?: Error) => void): void;
}

export type WithSessionFunc = (session: ClientSession) => Promise<void>;
export type WithSessionFuncP<T> = (session: ClientSession) => Promise<T>;
export type WithSubscriptionFunc = (session: ClientSession, subscription: ClientSubscription) => Promise<void>;
export type WithSubscriptionFuncP<T> = (session: ClientSession, subscription: ClientSubscription) => Promise<T>;

export class OPCUAClient {
    public static create(options: OPCUAClientOptions): OPCUAClient {
        return new OPCUAClientImpl(options);
    }
}
