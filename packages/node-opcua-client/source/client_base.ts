/**
 * @module node-opcua-client
 */
// tslint:disable:no-unused-expression
import type { LocaleId } from "node-opcua-basic-types";
import type { OPCUACertificateManager } from "node-opcua-certificate-manager";
import type { ICertificateKeyPairProvider, ICertificateStore, OPCUASecureObject } from "node-opcua-common";
import type { Certificate } from "node-opcua-crypto/web";
import { ObjectRegistry } from "node-opcua-object-registry";
import type { ResponseCallback } from "node-opcua-pseudo-session";
import type {
    ClientSecureChannelLayer,
    ConnectionStrategy,
    ConnectionStrategyOptions,
    SecurityPolicy
} from "node-opcua-secure-channel";
import type { FindServersOnNetworkRequestOptions, FindServersRequestOptions, ServerOnNetwork } from "node-opcua-service-discovery";
import type { ApplicationDescription, EndpointDescription } from "node-opcua-service-endpoints";
import type { ChannelSecurityToken, MessageSecurityMode } from "node-opcua-service-secure-channel";
import type { ErrorCallback } from "node-opcua-status-code";
import type { Request, Response } from "./common";

export type FindServersRequestLike = FindServersRequestOptions;
export type FindServersOnNetworkRequestLike = FindServersOnNetworkRequestOptions;
export type CreateSecureChannelCallbackFunc = (err: Error | null, secureChannel?: ClientSecureChannelLayer) => void;

export interface FindEndpointOptions {
    securityMode: MessageSecurityMode;
    securityPolicy: SecurityPolicy;
    connectionStrategy: ConnectionStrategyOptions;
    certificateFile: string;
    privateKeyFile: string;
    applicationName: string;
    applicationUri: string;
    clientCertificateManager: OPCUACertificateManager | ICertificateStore;
}

export interface FindEndpointResult {
    selectedEndpoint: EndpointDescription;
    endpoints: EndpointDescription[];
}

export type FindEndpointCallback = (err: Error | null, result?: FindEndpointResult) => void;

export interface TransportSettings {
    maxChunkCount?: number;
    maxMessageSize?: number;
    sendBufferSize?: number;
    receiveBufferSize?: number;
}

export interface OPCUAClientBaseOptions {
    /**
     * the client application name
     * @default "NodeOPCUA-Client"
     */
    applicationName?: string;

    /**
     * the application Uri
     * @default: `urn:${hostname}:${applicationName}`
     */
    applicationUri?: string;

    connectionStrategy?: ConnectionStrategyOptions;

    /**
     * if not specify or set to 0 , token  renewal will happen
     * around 75% of the defaultSecureTokenLifetime
     */
    tokenRenewalInterval?: number;

    /**
     * if set to true, pending session will not be automatically closed when disconnect is called
     */
    keepPendingSessionsOnDisconnect?: boolean;

    /**
     * the server certificate or certificate chain.
     */
    serverCertificate?: Certificate | Certificate[];

    /**
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
     * When set to true, the session will send a Read request on a regular interval specified by the `keepAliveInterval`.
     *
     * This ensure that the connection will remain active and that the socket will not timeout.
     *
     * When the keepAlive manager is not able to perform the Read operation, then it breaks the connection
     * and force the client to enter a reconnection phase.
     *
     * On some network settings and operating system, it might be quite tricky to detect when the communication
     * as the the
     *
     *
     * Tips:
     *
     * You don't ned to use `keepSessionAlive: true`  when your session have a subscription active.
     * A OPCUA subscription has already a built-in keepAlive mechanism that can replace the regular Read pooling
     * offered by this flag.
     *
     * @default false
     */
    keepSessionAlive?: boolean;
    /**
     * The number of milliseconds that the client should wait until it sends a keep alive message to the server.
     *
     * If not specified, node-opcua will use a suitable default value.
     *
     * Tips:
     *
     * - make sure to tune the value appropriately to be lesser than the sessionTimeOut and the tcp.ip socket
     * timeout.
     */
    keepAliveInterval?: number;

    /**
     * The certificate Manager
     *
     * If not specified your Client will create and use a default Certificate manager.
     *
     * You will have pass your own OPCUACertificateManager if you are in one of the following situation:
     *
     *  - you want to control the location of your PKI
     *  - you want multiple instances of OPCUAClient to share the same OPCUACertificateManager
     *
     */
    clientCertificateManager?: OPCUACertificateManager | ICertificateStore;

    /**
     * The client certificate pem file.
     *
     * Note:
     *   - most of the time, you won't need to overload the certificate PEM fiel
     *   - don't  specify the certificateFile if you are using the PushCertificate built-in feature
     *     provided by NodeOPCUA as it may interfere.
     *
     * @default `${clientCertificateManager/rootFolder}/own/certs/client_certificate.pem"
     */
    certificateFile?: string;

    /**
     * client private key pem file.
     * Note:
     *   - most of the time, you won't need to overload the private key file
     *   - don't  specify the privateKeyFile if you are using the PushCertificate built-in feature
     *     provided by NodeOPCUA as it may interfere.
     *   - ensure that the provided client certificate matches the private pey.
     *
     * @default `${clientCertificateManager/rootFolder}/own/private/private_key.pem"
     */
    privateKeyFile?: string;

    /**
     * a client name string that will be used to generate session names.
     */
    clientName?: string;

    /**
     * discovery url:
     */
    discoveryUrl?: string;

    /**
     * specify some transport settings that will override
     * the default transport settings for the end point.
     */
    transportSettings?: TransportSettings;

    /**
     * transport timeout
     *
     * - the devffault
     * @default
     */
    transportTimeout?: number;
    /**
     * defaultTransactionTimeout
     */
    defaultTransactionTimeout?: number;

    /**
     * An optional in-memory certificate/key provider.
     *
     * When supplied, the client skips disk-based certificate
     * path resolution and uses the provider directly.
     */
    certificateKeyPairProvider?: ICertificateKeyPairProvider;
}

export interface GetEndpointsOptions {
    endpointUrl?: string;
    localeIds?: LocaleId[];
    profileUris?: string[];
}

export interface OPCUAClientBase<Events extends OPCUAClientBaseEvents = OPCUAClientBaseEvents> extends OPCUASecureObject<Events> {
    /**
     * certificate Manager
     */
    readonly clientCertificateManager: ICertificateStore;

    /***
     *
     * @param endpointUrl the endpoint of the server to connect to ( i.e "opc.tcp://machine.name:3434/name" )
     */
    connect(endpointUrl: string): Promise<void>;

    connect(endpointUrl: string, callback: ErrorCallback): void;

    /***
     * causes the client to close and disconnect the communication with server
     *
     * ### note
     * > once the client has disconnected, it cannot reconnect to the server
     *   you'll need to recreate a new Client object to reconnect to the server.
     */
    disconnect(): Promise<void>;
    disconnect(callback: ErrorCallback): void;

    findEndpointForSecurity(securityMode: MessageSecurityMode, securityPolicy: SecurityPolicy): EndpointDescription | undefined;

    getEndpoints(options?: GetEndpointsOptions): Promise<EndpointDescription[]>;

    getEndpoints(options: GetEndpointsOptions, callback: ResponseCallback<EndpointDescription[]>): void;

    getEndpoints(callback: ResponseCallback<EndpointDescription[]>): void;

    findServers(options?: FindServersRequestLike): Promise<ApplicationDescription[]>;

    findServers(options: FindServersRequestLike, callback: ResponseCallback<ApplicationDescription[]>): void;

    findServers(callback: ResponseCallback<ApplicationDescription[]>): void;

    findServersOnNetwork(options?: FindServersOnNetworkRequestLike): Promise<ServerOnNetwork[]>;

    findServersOnNetwork(callback: ResponseCallback<ServerOnNetwork[]>): void;

    findServersOnNetwork(options: FindServersOnNetworkRequestLike, callback: ResponseCallback<ServerOnNetwork[]>): void;
}

// Events -----------------------------------------------------------------------------
export interface OPCUAClientBaseEvents {
    /**
     * this Event is raised when the  initial connection has succeeded
     */
    connected: [];

    /**
     * this Event is raised when the  initial connection has failed
     */
    connection_failed: [err: Error];

    /**
     * this Event is raised when a failing connection is about to be tried again
     */
    backoff: [count: number, delay: number];

    /**
     * this event is raised when the client has encountered a connection failure and
     * and is going to reconnection mode.
     *
     * It notifies the observer that the OPCUA is now trying to reestablish the connection
     * after having received a connection break...
     *
     * You can intercept start_reconnection event to pause your interaction with the remote
     * OPCUA server.
     */
    start_reconnection: [err?: Error];

    /**
     * this event is raised when the client has failed one attempt to reconnect to the server
     * This event will be raised if the socket has successfully being created to the server but
     * if something went wrong during the reconnection process.
     */
    reconnection_attempt_has_failed: [err: Error, message: string];

    /**
     * this event is raised after the client has successfully managed to re-establish the connection with
     * the remote OPCUA Server.
     * You can intercept after_reconnection event to resume your interaction with the remote
     * OPCUA server.
     */
    after_reconnection: [err?: Error | null];

    /**
     * the event is raised when the connection has been aborted by the remote OPCUA Server
     */
    abort: [];

    reconnection_canceled: [];

    startingDelayBeforeReconnection: [duration: number];

    reconnecting: [];

    repairConnectionStarted: [];

    keepalive: [];

    /**
     * this event is raised when the connection is closed
     */
    close: [err?: Error | null];

    /**
     * this event is raised when the client is sending a message chunk to the server
     * (advanced use only)
     */
    send_chunk: [chunk: Buffer];

    /**
     * this event is raised when the client has received a new message chunk from the servers
     * (advanced use only)
     */
    receive_chunk: [chunk: Buffer];

    send_request: [request: Request];

    receive_response: [response: Response];

    /**
     * this event is raised when the current security token has reached 75% of its lifetime and is therefore
     * about to expired.
     */
    lifetime_75: [token: ChannelSecurityToken];

    /**
     * this event is raised after the (about ) security token as been renewed
     * and renegotiated with the server.to expire
     */
    security_token_renewed: [channel: ClientSecureChannelLayer, token: ChannelSecurityToken];

    /**
     * this event is raised when the secure channel has been created
     */
    secure_channel_created: [secureChannel: ClientSecureChannelLayer];

    /**
     * this event is raised when the connection has been broken
     */
    connection_lost: [];

    /**
     * this event is raised when a broken connection with the remote Server has been reestablished
     */
    connection_reestablished: [];

    /**
     * This event is raised when a request sent to the remote OPCUA server has reach it's timeout value without
     * a Response from the server.
     */
    timed_out_request: [request: Request];
}

export interface OPCUAClientBase {
    readonly endpoint?: EndpointDescription;
    readonly isReconnecting: boolean;
    readonly transactionsPerformed: number;
    readonly knowsServerEndpoint: boolean;
    readonly reconnectOnFailure: boolean;
    readonly bytesRead: number;
    readonly bytesWritten: number;

    readonly securityMode: MessageSecurityMode;
    readonly securityPolicy: SecurityPolicy;
    readonly serverCertificate?: Certificate | Certificate[];
    readonly clientName: string;
    readonly protocolVersion: 0;
    readonly defaultSecureTokenLifetime: number;
    readonly tokenRenewalInterval: number;
    readonly connectionStrategy: ConnectionStrategy;
    readonly keepPendingSessionsOnDisconnect: boolean;
    readonly endpointUrl: string;
    readonly applicationName: string;
}

export const OPCUAClientBase = {
    registry: new ObjectRegistry(),
    retryDelay: 1000 * 5,

    create(options: OPCUAClientBaseOptions): OPCUAClientBase {
        /* c8 ignore next*/
        options;
        throw new Error("Not Implemented");
    }
};
