// Type definitions for node-opua
// Project: https://github.com/node-opcua/node-opcua
// Definitions by: Etienne Rossignon
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// tslint:disable:max-classes-per-file
export type ErrorCallback = (err?: Error) => void;
export type ResponseCallback<T> = (err?: Error | null, response?: T) => void;

import { AttributeIds } from "node-opcua-data-model";
export { AttributeIds } from "node-opcua-data-model";

import { StatusCode, StatusCodes } from "./StatusCode";
export { StatusCode, StatusCodes } from "./StatusCode";

import { MessageSecurityMode, SecurityPolicy } from "node-opcua-secure-channel";
export { MessageSecurityMode, SecurityPolicy } from "node-opcua-secure-channel";

import {
    ClientMonitoredItem,
    ClientSession,
    ClientSubscription,
    MonitoringParameters,
    OPCUAClientBaseOptions,
    OPCUAClientOptions
} from "node-opcua-client";

export {
    ClientMonitoredItem,
    ClientMonitoredItemGroup,
    ClientSession,
    ClientSubscription,
    MonitoringParameters,
    OPCUAClient,
    ClientBase,
    OPCUAClientBaseOptions,
    OPCUAClientOptions,
}from "node-opcua-client";

export { ApplicationDescription, ApplicationType, EndpointDescription } from "node-opcua-service-endpoints";
import { ApplicationDescription, ApplicationType, EndpointDescription } from "node-opcua-service-endpoints";

import { ServerState } from "node-opcua-common";
export { ServerState } from "node-opcua-common";

import { DataType, Variant, VariantArrayType, VariantLike } from "node-opcua-variant";
export { DataType, Variant, VariantArrayType, VariantLike } from "node-opcua-variant";

export { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { DataValue , TimestampsToReturn} from "node-opcua-data-value";

export { NumericRange } from "node-opcua-numeric-range";
import { NumericRange } from "node-opcua-numeric-range";

export { NodeIdType, NodeId, coerceNodeId, resolveNodeId, makeNodeId } from "node-opcua-nodeid";
import { coerceNodeId, makeNodeId, NodeId, NodeIdType, resolveNodeId } from "node-opcua-nodeid";

export { BrowsePath, makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { BrowsePath, makeBrowsePath } from "node-opcua-service-translate-browse-path";

export { UInt32 } from "node-opcua-basic-types";
import { UInt32 } from "node-opcua-basic-types";

export { ReadValueId, ReadValueIdOptions } from "node-opcua-service-read";
import { ReadValueId, ReadValueIdOptions } from "node-opcua-service-read";

export {
    BrowseResponse,
    BrowseDirection,
    BrowseDescription
} from "node-opcua-service-browse";

import {
    BrowseDescription,
    BrowseDirection,
    BrowseResponse
} from "node-opcua-service-browse";

import { LocalizedText, NodeClass, QualifiedName } from "node-opcua-data-model";

// ---------------------------------------------------------------------------------------------------------------------
export {
    UAProxyBase, UAProxyVariable, UAProxyManager
} from "node-opcua-client-proxy";

export interface UserIdentityInfo {
    userName: string;
    password: string;
}

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

export declare interface AddReferenceOpts {
    referenceType: string | NodeId;
    nodeId: NodeId | string;
}

export declare class UAReference {
}

export declare class BaseNode {
    public browseName: QualifiedName;

    public addReference(options: AddReferenceOpts): UAReference;
}

export declare class UAView extends BaseNode {
}

export declare class UAVariable extends BaseNode {
}

export declare class UAAnalogItem extends UAVariable {
}

export { DiagnosticInfo } from "node-opcua-data-model";

export declare class WriteValue {
    public nodeId: NodeId;
    public attributeId: AttributeIds;
    public indexRange?: any;
    public value: DataValue;
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
    public find(node: NodeId | string): BaseNode;

    public addVariable(options: AddVariableOpts): UAVariable;

    public addAnalogDataItem(options: AddAnalogDataItemOpts): UAAnalogItem;

    public addView(options: AddNodeOptions): UAView;
}

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

export declare class OPCUAServer {

    public bytesWritten: number;
    public bytesRead: number;
    public transactionsCount: number;
    public currentSubscriptionCount: number;
    public rejectedSessionCount: number;
    public sessionAbortCount: number;
    public publishingIntervalCount: number;
    public sessionTimeoutCount: number;
    /**
     * the number of connected channel on all existing end points
     */
    public currentChannelCount: number;
    public buildInfo: any;

    public endpoints: OPCUAServerEndPoint[];

    public secondsTillShutdown: number;

    public serverName: string;
    public serverNameUrn: string;

    public engine: ServerEngine;
    constructor(options?: OPCUAServerOptions);

    public setServerState(serverState: ServerState): void;

    public start(callback: ErrorCallback): void;
    public start(): Promise<void>;

    public shutdown(timeout: number, callback: ErrorCallback): void;
    public shutdown(timeout: number): Promise<void>;

    public initialize(done: () => void): void;

    // "postinitialize" , "session_closed", "create_session"
    public on(event: string, eventHandler: () => void): OPCUAServer;
}
