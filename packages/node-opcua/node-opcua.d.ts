// Type definitions for node-opua
// Project: https://github.com/node-opcua/node-opcua
// Definitions by: Etienne Rossignon
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
import { AttributeIds } from "node-opcua-data-model";

export { AttributeIds } from "node-opcua-data-model";
import { StatusCode, StatusCodes } from "./StatusCode";

export { StatusCode, StatusCodes } from "./StatusCode";

export type ErrorCallback = (err?: Error) => void;
export type ResponseCallback<T> = (err?: Error | null, response?: T) => void;

import { MessageSecurityMode, SecurityPolicy } from "node-opcua-secure-channel";

export { MessageSecurityMode, SecurityPolicy } from "node-opcua-secure-channel";


import {
    OPCUAClient,
    OPCUAClientBase,
    OPCUAClientBaseOptions,
    OPCUAClientOptions,
    ClientSession
} from "node-opcua-client";

export {
    OPCUAClient, OPCUAClientBase, OPCUAClientBaseOptions, OPCUAClientOptions, ClientSession
}from "node-opcua-client";

import { ApplicationType, ApplicationDescription } from "node-opcua-service-endpoints";

export { ApplicationType, ApplicationDescription } from "node-opcua-service-endpoints";

import { ServerState } from "node-opcua-common";
import { DataType, VariantArrayType } from "node-opcua-variant";

export { DataType, VariantArrayType } from "node-opcua-variant";


export { NodeIdType, NodeId, coerceNodeId, resolveNodeId, makeNodeId } from "node-opcua-nodeid";
import { NodeIdType, NodeId, coerceNodeId, resolveNodeId, makeNodeId } from "node-opcua-nodeid";

export { BrowsePath } from "node-opcua-service-translate-browse-path";
import { BrowsePath } from "node-opcua-service-translate-browse-path";

export { UInt32 } from "node-opcua-basic-types";
import { UInt32 } from "node-opcua-basic-types";

export {
    BrowseResponse,
    BrowseDirection,
    BrowseDescription
} from "node-opcua-service-browse";

import {
    BrowseResponse,
    BrowseDirection,
    BrowseDescription
} from "node-opcua-service-browse";

import { QualifiedName, LocalizedText, NodeClass } from "node-opcua-data-model";


export declare interface UAProxyBase {
    nodeId: NodeId;
    browseName: QualifiedName;
    description: LocalizedText;
    nodeClass: NodeClass;
    typeDefinition: string | null;

    on(event: string, eventHandler: () => void): UAProxyBase;
}

export declare interface UAProxyVariable extends UAProxyBase {
    dataValue: DataValue;
    userAccessLevel: any;
    accessLevel: any;
}

export declare class UAProxyManager {
    constructor(session: ClientSession);

    start(callback: ErrorCallback): void;
    start(): Promise<void>;

    stop(callback: ErrorCallback): void;
    stop(): Promise<void>;

    getObject(nodeId: NodeId, callback: (object: any) => void): void;
    getObject(nodeId: NodeId): Promise<UAProxyBase>;
}

export interface UserIdentityInfo {
    userName: string;
    password: string;
}


/**
 *  @class OPCUAClient
 *  @extends OPCUAClientBase
 */
// export declare class OPCUAClient extends OPCUAClientBase {
//     /**
//      */
//     constructor(options: OPCUAClientOptions);
//
//     // async with callback methods
//
//     createSession(callback: ResponseCallback<ClientSession>): void;
//     createSession(userIdentityInfo: UserIdentityInfo, callback: ResponseCallback<ClientSession>): void;
//     createSession(userIdentityInfo?: UserIdentityInfo): Promise<ClientSession>;
//
//
//     withSession(
//         endpointUrl: string,
//         innerFunction: (session: ClientSession, done: () => void) => void,
//         callback: ErrorCallback
//     ): void;
//
//     // ---- async with promise methods
//     withSessionAsync(endpointUrl: string, innerFunction: (session: ClientSession) => Promise<any>): Promise<any>;
//
//     withSubscription(
//         endpointUrl: string,
//         subscriptionParameters: any,
//         innerFunction: (session: ClientSession, subscription: ClientSubscription, done: () => void) => void,
//         callback: ErrorCallback
//     ): void;
//
//     withSubscriptionAsync(
//         endpointUrl: string,
//         subscriptionParameters: any,
//         innerFunction: (session: ClientSession, subscription: ClientSubscription) => Promise<any>
//     ): Promise<any>;
//
//
//     closeSession(session: ClientSession, deleteSubscriptions: boolean): Promise<void>;
//     closeSession(session: ClientSession, deleteSubscriptions: boolean, callback: (err: Error | null) => void): void;
// }

// ----------------------------------------------------------------------------------------------------------------
declare type ValidUserFunc = (username: string, password: string) => boolean;

declare type ValidUserAsyncFunc = (username: string, password: string, callback: ErrorCallback) => void;

export interface OPCUAServerOptions {
    /** the default secure token life time in ms. */
    defaultSecureTokenLifetime?: number;
    /**
     * the HEL/ACK transaction timeout in ms. Use a large value
     * ( i.e 15000 ms) for slow connections or embedded devices.
     * @default 10000
     */
    timeout?: number;
    /**
     * the TCP port to listen to.
     * @default 26543
     */
    port?: number;
    /**
     * the maximum number of concurrent sessions allowed.
     * @default 10
     */
    maxAllowedSessionNumber?: number;

    /** the nodeset.xml file(s) to load */
    nodeset_filename?: string[] | string;
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
        applicationName?: LocalizedText | string;
        gatewayServerUri?: string;
        discoveryProfileUri?: string;
        discoveryUrls?: string[];
    };
    /**
     * @default [SecurityPolicy.None, SecurityPolicy.Basic128Rsa15, SecurityPolicy.Basic256Sha256]
     */
    securityPolicies?: SecurityPolicy[];
    /**
     * @default [MessageSecurityMode.None, MessageSecurityMode.Sign, MessageSecurityMode.SignAndEncrypt]
     */
    securityModes?: MessageSecurityMode[];
    /**
     * tells if the server default endpoints should allow anonymous connection.
     * @default true
     */
    allowAnonymous?: boolean;
    /* an object that implements user authentication methods */
    userManager?: {
        /** synchronous function to check the credentials - can be overruled by isValidUserAsync */
        isValidUser?: ValidUserFunc;
        /** asynchronous function to check if the credentials - overrules isValidUser */
        isValidUserAsync?: ValidUserAsyncFunc;
    };
    /** resource Path is a string added at the end of the url such as "/UA/Server" */
    resourcePath?: string;
    /** alternate hostname to use */
    alternateHostname?: string;
    /**
     * if server shall raise AuditingEvent
     * @default true
     */
    isAuditing?: boolean;
}


export declare class BrowseName {
    name: string;
    namespace: number;
}


export declare interface AddReferenceOpts {
    referenceType: string | NodeId;
    nodeId: NodeId | string;
}

export declare class UAReference {
}

export declare class BaseNode {
    browseName: BrowseName;

    addReference(options: AddReferenceOpts): UAReference;
}

export declare class UAView extends BaseNode {
}

export declare class UAVariable extends BaseNode {
}

export declare class UAAnalogItem extends UAVariable {
}

export interface VariantOpts {
    dataType?: DataType;
    value?: any;
    arrayType?: VariantArrayType;
    dimensions?: number[];
}

export declare class Variant {
    constructor(options: VariantOpts);

    dataType: DataType;
    value: any;
    arrayType: VariantArrayType;
    dimensions: null | number[];
}

declare interface DataValueOpts {
    value?: Variant;
    sourceTimestamp?: Date;
    serverTimestamp?: Date;
    sourcePicoseconds?: number;
    serverPicoseconds?: number;
    statusCode?: StatusCode;
}

export declare class DataValue {
    constructor(options: DataValueOpts);

    value: Variant;
    sourceTimestamp: Date;
    serverTimestamp: Date;
    sourcePicoseconds: number;
    serverPicoseconds: number;
    statusCode: StatusCode;
}

type CoercibleToDataValue = DataValue | DataValueOpts;

export declare class WriteValue {
    nodeId: NodeId;
    attributeId: AttributeIds;
    indexRange?: any;
    value: DataValue;
}

type NodeIdLike = string | NodeId;

type CoercibleToWriteValue =
    | {
    nodeId: NodeIdLike;
    attributeId: AttributeIds;
    indexRange?: any;
    value: CoercibleToDataValue;
}
    | WriteValue;

export declare class DiagnosticInfo {
    namespaceUri: number;
    symbolicId: number;
    locale: number;
    localizedText: number;
    additionalInfo: string;
    innerStatusCode: StatusCode;
    innerDiagnosticInfo: DiagnosticInfo;
}

export interface AddNodeOptions {
    browseName: string;
    displayName?: string | LocalizedText | LocalizedText[];
    description?: string;

    organizedBy?: NodeId | BaseNode;
    componentOf?: NodeId | BaseNode;
    nodeId?: string | NodeId;
}

export interface AddVariableOpts extends AddNodeOptions {
    dataType: string | DataType;
    value?: {
        get?: () => Variant;
        timestamp_get?: () => DataValue;
        refreshFunc?: (err: null | Error, dataValue?: DataValue) => void;
    };
}

export enum EUEngineeringUnit {
    degree_celsius
    // to be continued
}

export interface AddAnalogDataItemOpts extends AddNodeOptions {
    /** @example  "(tempA -25) + tempB" */
    definition: string;
    /** @example 0.5 */
    valuePrecision: number;
    engineeringUnitsRange: {
        low: number;
        high: number;
    };
    instrumentRange: {
        low: number;
        high: number;
    };
    engineeringUnits: EUEngineeringUnit;
}

export declare class AddressSpace {
    find(node: NodeId | string): BaseNode;

    addVariable(options: AddVariableOpts): UAVariable;

    addAnalogDataItem(options: AddAnalogDataItemOpts): UAAnalogItem;

    addView(options: AddNodeOptions): UAView;
}

export declare class ServerEngine {
    addressSpace: AddressSpace;
}

export declare interface EndpointDescription {
    securityPolicies: any;
    securityModes: any;
    allowAnonymous: boolean;
    disableDiscovery: boolean;
    resourcePath: string;
    hostname: string;
    endpointUrl: string;
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

export declare class OPCUAServer {
    constructor(options?: OPCUAServerOptions);

    bytesWritten: number;
    bytesRead: number;
    transactionsCount: number;
    currentSubscriptionCount: number;
    rejectedSessionCount: number;
    sessionAbortCount: number;
    publishingIntervalCount: number;
    sessionTimeoutCount: number;
    /**
     * the number of connected channel on all existing end points
     */
    currentChannelCount: number;
    buildInfo: any;

    endpoints: OPCUAServerEndPoint[];

    secondsTillShutdown: number;

    serverName: string;
    serverNameUrn: string;

    engine: ServerEngine;

    setServerState(serverState: ServerState): void;

    start(callback: ErrorCallback): void;
    start(): Promise<void>;

    shutdown(timeout: number, callback: ErrorCallback): void;
    shutdown(timeout: number): Promise<void>;

    initialize(done: () => void): void;

    // "postinitialize" , "session_closed", "create_session"
    on(event: string, eventHandler: () => void): OPCUAServer;
}

export declare interface MonitoringParameters {
    readonly clientHandle: number;
    readonly samplingInterval: number;
    readonly filter: any;
    readonly queueSize: number;
    readonly discardOldest: boolean;
}
export declare class ClientMonitoredItem {
    terminate(callback: ErrorCallback): void;
    terminate(): Promise<void>;

    public monitoringParameters: MonitoringParameters;

    /**
     * @method on
     * @param {string} event
     * @param {() => void} eventHandler
     * @chainable
     */
    on(event: "changed", eventHandler: (dataValue: DataValue)  => void): this;
    on(event: "initialized"| "terminated", eventHandler: ()  => void): this;
    on(event: "err", eventHandler: (err: Error)  => void): this;


}

export interface TimestampsToReturn {
    Invalid: -1;
    Source: 0;
    Server: 1;
    Both: 2;
    Neither: 3;
}

// export declare class read_service {
//   static TimestampsToReturn: TimestampsToReturn;
// }

type NumericRange = string;

export interface ReadValueId {
    nodeId: NodeId;
    attributeId: AttributeIds;
    indexRange?: NumericRange;
    // TODO: figure out how to represent indexRange (NumericRange) and dataEncoding (unknown)
}

type ReadValueIdLike =
    | {
    nodeId: string | NodeId;
    attributeId: AttributeIds;
}
    | ReadValueId;

export interface ItemToMonitorRequestedParameters {
    samplingInterval: number;
    discardOldest: boolean;
    queueSize: number;
    // TODO: add filter parameter (extension object)
}

type CoercibleToItemToMonitorRequestedParameters =
    | {
    samplingInterval: number;
    discardOldest?: boolean;
    queueSize?: number;
}
    | ItemToMonitorRequestedParameters;

export interface ClientSubscriptionOptions {
    requestedPublishingInterval: number;
    requestedLifetimeCount: number;
    requestedMaxKeepAliveCount: number;
    maxNotificationsPerPublish: number;
    publishingEnabled: boolean;
    priority: number;
}

export declare class ClientSubscription {
    constructor(session: ClientSession, options: ClientSubscriptionOptions);

    subscriptionId: number;

    monitor(
        itemToMonitor: ReadValueId,
        requestedParameters: CoercibleToItemToMonitorRequestedParameters,
        timestampsToReturn?: number,
        done?: () => void,
    ): ClientMonitoredItem;

    monitor(
        itemToMonitor: ReadValueId,
        requestedParameters: CoercibleToItemToMonitorRequestedParameters,
        timestampsToReturn?: number
    ): Promise<ClientMonitoredItem>;

    on(event: string, eventHandler: () => void): ClientSubscription;

    terminate(callback: ErrorCallback): void;

    terminate(): Promise<void>;
}


export declare function makeBrowsePath(rootNode: NodeId, relativePath: string): BrowsePath;
