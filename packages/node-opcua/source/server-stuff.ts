/**
 * @module node-opcua
 */
// tslint:disable:no-empty
// tslint:disable:no-empty-interface
// tslint:disable:max-classes-per-file
// tslint:disable:unified-signatures

import { ServerState } from "node-opcua-common";
import { LocalizedText, LocalizedTextLike } from "node-opcua-data-model";
import {
    MessageSecurityMode,
    SecurityPolicy,
    ServerSecureChannelLayer
} from "node-opcua-secure-channel";
import { EndpointDescription } from "node-opcua-service-endpoints";

import {
    AddressSpace,
    EventRaiser,
    PseudoVariantBoolean,
    PseudoVariantByteString,
    PseudoVariantDateTime,
    PseudoVariantDuration,
    PseudoVariantExtensionObject,
    PseudoVariantExtensionObjectArray,
    PseudoVariantLocalizedText,
    PseudoVariantNodeId,
    PseudoVariantString,
    RaiseEventData
} from "node-opcua-address-space";

type ErrorCallback = (err?: Error) => void;

export declare enum RegisterServerMethod {
    HIDDEN = 1, // the server doesn't expose itself to the external world
    MDNS = 2,   // the server publish itself to the mDNS Multicast network directly
    LDS = 3 // the server registers itself to the LDS or LDS-ME (Local Discovery Server)
}

declare type ValidUserFunc = (username: string, password: string) => boolean;
declare type ValidUserAsyncFunc = (username: string, password: string, callback: ErrorCallback) => void;
declare type GetUserRoleFunc = (username: string) => string;

export interface UserManagerOptions {
    /** synchronous function to check the credentials - can be overruled by isValidUserAsync */
    isValidUser?: ValidUserFunc;
    /** asynchronous function to check if the credentials - overrules isValidUser */
    isValidUserAsync?: ValidUserAsyncFunc;
    /**  synchronous function to return the role of the given user */
    getUserRole?: GetUserRoleFunc;
}

import { CertificateManager } from "node-opcua-certificate-manager";

export * from "node-opcua-certificate-manager";

import { Request, Response } from "node-opcua-client";
import { NodeId } from "node-opcua-nodeid";
import { ApplicationDescription } from "node-opcua-types";

export { Request, Response } from "node-opcua-client";

export interface OperationLimitsOptions {
    maxNodesPerRead?: number;
    maxNodesPerBrowse?: number;
    maxNodesPerWrite?: number;
    maxNodesPerMethodCall?: number;
    maxNodesPerRegisterNodes?: number;
    maxNodesPerNodeManagement?: number;
    maxMonitoredItemsPerCall?: number;
    maxNodesPerHistoryReadData?: number;
    maxNodesPerHistoryReadEvents?: number;
    maxNodesPerHistoryUpdateData?: number;
    maxNodesPerHistoryUpdateEvents?: number;
    maxNodesPerTranslateBrowsePathsToNodeIds?: number;
}

export interface ServerCapabilitiesOptions {
    maxBrowseContinuationPoints?: number;
    maxHistoryContinuationPoints?: number;
    maxStringLength?: number;
    maxQueryContinuationPoints?: number;
    operationLimits?: OperationLimitsOptions;
}

export interface OPCUAServerOptions {

    /**
     * the server certificate full path filename
     *
     * the certificate should be in PEM format
     */
    certificateFile?: string;
    /**
     * the server private key full path filename
     *
     * This file should contains the private key that has been used to generate
     * the server certificate file.
     *
     * the private key should be in PEM format
     *
     */
    privateKeyFile?: string;

    /**
     * the default secure token life time in ms.
     */
    defaultSecureTokenLifetime?: number;
    /**
     * the HEL/ACK transaction timeout in ms.
     *
     * Use a large value ( i.e 15000 ms) for slow connections or embedded devices.
     * @default 10000
     */
    timeout?: number;
    /**
     * the TCP port to listen to.
     * @default 26543
     */
    port?: number;
    /**
     * the maximum number of simultaneous sessions allowed.
     * @default 10
     */
    maxAllowedSessionNumber?: number;

    /**
     * the maximum number authorized simultaneous connections per endpoint
     * @default 10
     */
    maxConnectionsPerEndpoint?: number;

    /**
     * the nodeset.xml file(s) to load
     *
     * node-opcua comes with pre-installed node-set files that can be used
     *
     * example:
     *
     * ``` javascript
     *
     * ```
     */
    nodeset_filename?: string[] | string;

    /**
     * the server Info
     *
     * this object contains the value that will populate the
     * Root/ObjectS/Server/ServerInfo OPCUA object in the address space.
     */
    serverInfo?: {
        /**
         * the information used in the end point description
         * @default "urn:NodeOPCUA-Server"
         */
        applicationUri?: string;
        /**
         * @default "NodeOPCUA-Server"
         */
        productUri?: string;
        /**
         * @default "applicationName"
         */
        applicationName?: LocalizedTextLike | string;
        gatewayServerUri?: string | null;
        discoveryProfileUri?: string | null;
        discoveryUrls?: string[];

    };

    buildInfo?: {
        productName?: string;
        productUri?: string | null, // << should be same as default_server_info.productUri?
        manufacturerName?: string,
        softwareVersion?: string,
        buildNumber?: string;
    };

    /**
     * the possible security policies that the server will expose
     * @default  [SecurityPolicy.None, SecurityPolicy.Basic128Rsa15, SecurityPolicy.Basic256Sha256]
     */
    securityPolicies?: SecurityPolicy[];
    /**
     * the possible security mode that the server will expose
     * @default [MessageSecurityMode.None, MessageSecurityMode.Sign, MessageSecurityMode.SignAndEncrypt]
     */
    securityModes?: MessageSecurityMode[];
    /**
     * tells if the server default endpoints should allow anonymous connection.
     * @default true
     */
    allowAnonymous?: boolean;
    /**
     *  an object that implements user authentication methods
     */
    userManager?: UserManagerOptions;

    /** resource Path is a string added at the end of the url such as "/UA/Server" */
    resourcePath?: string;
    /** alternate hostname to use */
    alternateHostname?: string;
    /**
     *
     */
    serverCapabilities?: ServerCapabilitiesOptions;
    /**
     * if server shall raise AuditingEvent
     * @default true
     */
    isAuditing?: boolean;

    /**
     * strategy used by the server to declare itself to a discovery server
     *
     * - HIDDEN: the server doesn't expose itself to the external world
     * - MDNS: the server publish itself to the mDNS Multicast network directly
     * - LDS: the server registers itself to the LDS or LDS-ME (Local Discovery Server)
     *
     *  @default  RegisterServerMethod.HIDDEN - by default the server
     *            will not register itself to the local discovery server
     *
     */
    registerServerMethod?: RegisterServerMethod;
    /**
     *
     * @default "opc.tcp://localhost:4840"]
     */
    discoveryServerEndpointUrl?: string;
    /**
     *
     *  supported server capabilities for the Mutlicast (mDNS)
     *  @default ["NA"]
     *  the possible values are any of node-opcua-discovery.serverCapabilities)
     *
     */
    capabilitiesForMDNS?: string[];

    /**
     * user Certificate Manager
     * this certificate manager holds the X509 certificates used
     * by client that uses X509 certitifact token to impersonate a user
     */
    userCertificateManager?: CertificateManager;
    /**
     * Server Certificate Manager
     *
     * this certificate manager will be used by the server to access
     * and store certificates from the connecting clients
     */
    serverCertificateManager?: CertificateManager;
}


export * from "node-opcua-address-space";

export declare class ServerEngine {
    public addressSpace: AddressSpace;
}

export declare interface OPCUAServerEndPoint {
    port: number;
    defaultSecureTokenLifetime: number;
    timeout: number;
    certificateChain: any;
    privateKey: any;
    serverInfo: any;
    maxConnections: any;

    endpointDescriptions(): EndpointDescription[];
}

export interface Session {
    clientDescription: any;
    sessionName: string;
    sessionTimeout?: number;
    sessionId: any;
}

export interface RaiseEventAuditEventData extends RaiseEventData {

    actionTimeStamp: PseudoVariantDateTime;
    status: PseudoVariantBoolean;
    serverId: PseudoVariantString;
    /**
     * ClientAuditEntryId contains the human-readable AuditEntryId defined in Part 3.
     */
    clientAuditEntryId: PseudoVariantString;
    /**
     * The ClientUserId identifies the user of the client requesting an action. The ClientUserId can be
     * obtained from the UserIdentityToken passed in the ActivateSession call.
     */
    clientUserId: PseudoVariantString;
    sourceName: PseudoVariantString;

}

export interface RaiseEventAuditUpdateMethodEventData extends RaiseEventAuditEventData {
    methodId: PseudoVariantNodeId;
    inputArguments: any;
}

export interface RaiseEventAuditConditionCommentEventData extends RaiseEventAuditUpdateMethodEventData {
    eventId: PseudoVariantByteString;
    comment: PseudoVariantLocalizedText;
}

export interface RaiseEventAuditSessionEventData extends RaiseEventAuditEventData {
    /**
     *  part 5 - 6.4.7 AuditSessionEventType
     */
    sessionId: PseudoVariantNodeId;
}

export interface RaiseEventAuditCreateSessionEventData extends RaiseEventAuditSessionEventData {

    /**
     *  part 5 - 6.4.8 AuditCreateSessionEventType
     *  SecureChannelId shall uniquely identify the SecureChannel.
     *  The application shall use the same identifier in
     *  all AuditEvents related to the Session Service Set (AuditCreateSessionEventType, AuditActivateSessionEventType
     *  and their subtypes) and the SecureChannel Service Set (AuditChannelEventType and its subtype
     */
    secureChannelId: PseudoVariantString;
    revisedSessionTimeout: PseudoVariantDuration;
    clientCertificate: PseudoVariantByteString;
    clientCertificateThumbprint: PseudoVariantByteString;
}

export interface RaiseEventAuditActivateSessionEventData extends RaiseEventAuditSessionEventData {

    /**
     * part 5 - 6.4.10 AuditActivateSessionEventType
     */
    clientSoftwareCertificates: PseudoVariantExtensionObjectArray;
    /**
     * UserIdentityToken reflects the userIdentityToken parameter of the ActivateSession Service call.
     * For Username/Password tokens the password should NOT be included.
     */
    userIdentityToken: PseudoVariantExtensionObject;
    /**
     * SecureChannelId shall uniquely identify the SecureChannel. The application shall use the same identifier
     * in all AuditEvents related to the Session Service Set (AuditCreateSessionEventType,
     * AuditActivateSessionEventType and their subtypes) and the SecureChannel Service Set
     * (AuditChannelEventType and its subtypes).
     */
    secureChannelId: PseudoVariantString;

}

export interface RaiseEventTransitionEventData extends RaiseEventData {
}

export declare class OPCUAServer implements EventRaiser {
    /**
     * total number of bytes written  by the server since startup
     */
    public bytesWritten: number;
    /**
     * total number of bytes read  by the server since startup
     */
    public bytesRead: number;

    /**
     * the total number of transactions processed by he server so far
     */
    public transactionsCount: number;
    /**
     * the number of sessions currently active
     */
    public currentSessionCount: number;
    /**
     * the number of connected channel on all existing end points
     */
    public currentChannelCount: number;

    /**
     * the number of active subscriptions from all sessions
     */
    public currentSubscriptionCount: number;
    /**
     * the number of session activation requests that has been rejected
     */
    public readonly rejectedSessionCount: number;
    /**
     * the number of sessions that have been aborted
     */
    public readonly sessionAbortCount: number;
    /**
     * the
     */
    public readonly publishingIntervalCount: number;
    /**
     * the number of sessions that have reach time out
     */
    public readonly sessionTimeoutCount: number;
    public readonly userCertificateManager: CertificateManager;
    public readonly userManager: any;

    public readonly buildInfo: any;
    public readonly endpoints: OPCUAServerEndPoint[];
    public readonly secondsTillShutdown: number;
    public readonly serverName: string;
    public readonly serverNameUrn: string;
    public readonly engine: ServerEngine;
    public readonly discoveryServerEndpointUrl: string;

    public readonly capabilitiesForMDNS: string [];
    public readonly registerServerMethod: RegisterServerMethod;

    /**
     * is the server initialized yet ?
     */
    public initialized: boolean;

    /**
     * is the server auditing ?
     */
    public isAuditing: boolean;

    /**
     *
     * @param options - the object containing the server configuration
     * @constructor
     */
    constructor(options: OPCUAServerOptions);

    public setServerState(serverState: ServerState): void;

    /**
     *
     * Initiate the server by starting all its endpoints
     */
    public start(callback: ErrorCallback): void;
    public start(): Promise<void>;

    /**
     *  shutdown all server endpoints
     * @param  timepout [=0] the timeout before the server is actually shutdown
     * @example
     *
     * ```javascript
     *    // shutdown immediately
     *    server.shutdown(function(err) {
     *    });
     * ```
     * ```ts
     *   // in typescript with async/await
     *   await server.shutdown();
     * ```
     * ```javascript
     *    // shutdown within 10 seconds
     *    server.shutdown(10000,function(err) {
     *    });
     *   ```
     */
    public shutdown(timeout: number, callback: ErrorCallback): void;
    public shutdown(timeout: number): Promise<void>;

    /**
     * Initialize the server by installing default node set.
     *
     * and instruct the server to listen to its endpoints.
     *
     * ```javascript
     * const server = new OPCUAServer();
     * await server.initialize();
     *
     * // default server namespace is now initialized
     * // it is a good time to create life instance objects
     * const namespace = server.engine.addressSpace.getOwnNamespace();
     * namespace.addObject({
     *     browseName: "SomeObject",
     *     organizedBy: server.engine.addressSpace.rootFolder.objects
     * });
     *
     * // the addressSpace is now complete
     * // let's now start listening to clients
     * await server.start();
     * ```
     */
    public initialize(done: () => void): void;
    public initialize(): Promise<void>;

    /**
     * @internal
     * @param eventType
     * @param options
     */
    public raiseEvent(
      eventType: "AuditSessionEventType", options: RaiseEventAuditSessionEventData): void;
    public raiseEvent(
      eventType: "AuditCreateSessionEventType", options: RaiseEventAuditCreateSessionEventData): void;
    public raiseEvent(
      eventType: "AuditActivateSessionEventType", options: RaiseEventAuditActivateSessionEventData): void;
    public raiseEvent(
      eventType: "AuditCreateSessionEventType", options: RaiseEventData
    ): void;
    public raiseEvent(
      eventType: "AuditConditionCommentEventType", options: RaiseEventAuditConditionCommentEventData): void;
    public raiseEvent(
      eventType: "TransitionEventType", options: RaiseEventTransitionEventData): void;

}

import { EventEmitter } from "events";

export interface OPCUAServer extends EventEmitter {
    on(event: "create_session", eventHandler: (session: Session) => void): this;

    on(event: "session_closed", eventHandler: (session: Session, reason: string) => void): this;

    on(event: "post_initialize", eventHandler: () => void): void;

    /**
     * emitted when the server is trying to registered the LDS
     * but when the connection to the lds has failed
     * serverRegistrationPending is sent when the backoff signal of the
     * connection process is raised
     * @event serverRegistrationPending
     */
    on(event: "serverRegistrationPending", eventHandler: () => void): void;

    /**
     * event raised when server  has been successfully registered on the local discovery server
     * @event serverRegistered
     */
    on(event: "serverRegistered", eventHandler: () => void): void;

    /**
     * event raised when server registration has been successfully renewed on the local discovery server
     * @event serverRegistered
     */
    on(event: "serverRegistrationRenewed", eventHandler: () => void): void;

    /**
     * event raised when server  has been successfully unregistered from the local discovery server
     * @event serverUnregistered
     */
    on(event: "serverUnregistered", eventHandler: () => void): void;

    /**
     * event raised after the server has raised an OPCUA event toward a client
     */
    on(event: "event", eventHandler: (eventData: any) => void): void;

    /**
     * event raised when the server received a request from one of its connected client.
     * useful for trace purpose.
     */
    on(event: "request", eventHandler: (request: Request, channel: ServerSecureChannelLayer) => void): void;

    /**
     * event raised when the server send an response to a request to one of its connected client.
     * useful for trace purpose.
     */
    on(event: "response", eventHandler: (request: Response, channel: ServerSecureChannelLayer) => void): void;

    /**
     * event raised when a new secure channel is opened
     */
    on(event: "newChannel", eventHandler: (channel: ServerSecureChannelLayer) => void): void;

    /**
     * event raised when a new secure channel is closed
     */
    on(event: "closeChannel", eventHandler: (channel: ServerSecureChannelLayer) => void): void;

    on(event: string, eventHandler: (...args: [any?, ...any[]]) => void): this;

}

export interface ServerSession {
    clientDescription: ApplicationDescription;
    sessionName: string;
    sessionTimeout: number;
    sessionId: NodeId;
}

export interface Subscription {
}

export interface MonitoredItem {
}
