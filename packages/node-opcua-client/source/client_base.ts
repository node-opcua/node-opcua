/**
 * @module node-opcua-client
 */
// tslint:disable:no-unused-expression
import { EventEmitter } from "events";
import { LocaleId } from "node-opcua-basic-types";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { OPCUASecureObject } from "node-opcua-common";
import { Certificate } from "node-opcua-crypto";
import { ObjectRegistry } from "node-opcua-object-registry";
import { ClientSecureChannelLayer, ConnectionStrategy, ConnectionStrategyOptions, SecurityPolicy } from "node-opcua-secure-channel";
import { FindServersOnNetworkRequestOptions, FindServersRequestOptions, ServerOnNetwork } from "node-opcua-service-discovery";
import { ApplicationDescription, EndpointDescription } from "node-opcua-service-endpoints";
import { ChannelSecurityToken, MessageSecurityMode } from "node-opcua-service-secure-channel";
import { ErrorCallback } from "node-opcua-status-code";

import { ResponseCallback } from "./client_session";
import { Request, Response } from "./common";

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
    clientCertificateManager: OPCUACertificateManager;
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
     * the server certificate.
     */
    serverCertificate?: Certificate;

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
     * can be set when the client doesn't create subscription. In this case,
     * the client will send a dummy request on a regular basis to keep the
     * connection active.
     * @default false
     */
    keepSessionAlive?: boolean;

    /**
     * certificate Manager
     */
    clientCertificateManager?: OPCUACertificateManager;

    /**
     * client certificate pem file.
     * @default `${clientCertificateManager/rootFolder}/own/certs/client_certificate.pem"
     */
    certificateFile?: string;
    /**
     * client private key pem file.
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
     * @advanced
     */
    transportSettings?: TransportSettings;
}

export interface GetEndpointsOptions {
    endpointUrl?: string;
    localeIds?: LocaleId[];
    profileUris?: string[];
}

export interface OPCUAClientBase extends OPCUASecureObject {
    /**
     * certificate Manager
     */
    readonly clientCertificateManager: OPCUACertificateManager;

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
export interface OPCUAClientBase extends EventEmitter {
    // tslint:disable:unified-signatures

    /**
     * this Event is raised when the  initial connection has succeeded
     */
    on(eventName: "connected", eventHandler: () => void): this;

    /**
     * this Event is raised when the  initial connection has failed
     */
    on(eventName: "connection_failed", eventHandler: (err: Error) => void): this;

    /**
     * this Event is raised when a failing connection is about to be tried again
     */
    on(eventName: "backoff", eventHandler: (count: number, delay: number) => void): this;

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
    on(eventName: "start_reconnection", eventHandler: () => void): this;

    /**
     * this event is raised when the client has failed one attempt to reconnect to the server
     * This event will be raised if the socket has successfully being created to the server but
     * if something went wrong during the reconnection process.
     */
    on(eventName: "reconnection_attempt_has_failed", eventHandler: (err: Error, message: string) => void): this;

    /**
     * this event is raised after the client has successfully managed to re-establish the connection with
     * the remote OPCUA Server.
     * You can intercept after_reconnection event to resume your interaction with the remote
     * OPCUA server.
     */
    on(eventName: "after_reconnection", eventHandler: (err?: Error) => void): this;

    /**
     * the event is raised when the connection has been aborted by the remote OPCUA Server
     * @param event
     * @param eventHandler
     */
    on(eventName: "abort", eventHandler: () => void): this;

    /**
     * this event is raised when the connection is closed
     * @param event
     * @param eventHandler
     */
    on(eventName: "close", eventHandler: () => void): this;

    /**
     * this event is raised when the client is sending a message chunk to the server
     * (advanced use only)
     * @param event
     * @param eventHandler
     */
    on(eventName: "send_chunk", eventHandler: (chunk: Buffer) => void): this;

    /**
     * this event is raised when the client has received a new message chunk from the servers
     * (advanced use only)
     * @param event
     * @param eventHandler
     */
    on(eventName: "receive_chunk", eventHandler: (chunk: Buffer) => void): this;

    on(eventName: "send_request", eventHandler: (request: Request) => void): this;

    on(eventName: "receive_response", eventHandler: (response: Response) => void): this;

    /**
     * this event is raised when the current security token has reached 75% of its lifetime and is therefore
     * about to expired.
     * @param event
     * @param eventHandler
     */
    on(eventName: "lifetime_75", eventHandler: (token: ChannelSecurityToken) => void): this;

    /**
     * this event is raised after the (about ) security token as been renewed
     * and renegotiated with the server.to expire
     * @param event
     * @param eventHandler
     */
    on(eventName: "security_token_renewed", eventHandler: () => void): this;

    /**
     * this event is raised when the connection has been broken
     * @param event
     * @param eventHandler
     */
    on(eventName: "connection_lost", eventHandler: () => void): this;

    /**
     * this event is raised when a broken connection with the remote Server has been reestablished
     * @param event
     * @param eventHandler
     */
    on(eventName: "connection_reestablished", eventHandler: () => void): this;

    /**
     * This event is raised when a request sent to the remote OPCUA server has reach it's timeout value without
     * a Response from the server.
     * @param event
     * @param eventHandler
     */
    on(eventName: "timed_out_request", eventHandler: (request: Request) => void): this;

    on(eventName: string | symbol, listener: (...args: any[]) => void): this;
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
    readonly serverCertificate?: Certificate;
    readonly clientName: string;
    readonly protocolVersion: 0;
    readonly defaultSecureTokenLifetime: number;
    readonly tokenRenewalInterval: number;
    readonly connectionStrategy: ConnectionStrategy;
    readonly keepPendingSessionsOnDisconnect: boolean;
    readonly endpointUrl: string;
    readonly keepSessionAlive: boolean;
    readonly applicationName: string;
}

export class OPCUAClientBase {
    public static registry = new ObjectRegistry();
    public static retryDelay = 1000 * 5;

    public static create(options: OPCUAClientBaseOptions): OPCUAClientBase {
        /* istanbul ignore next*/
        options;
        throw new Error("Not Implemented");
    }
}
