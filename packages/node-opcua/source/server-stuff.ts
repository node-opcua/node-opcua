// Type definitions for node-opua
// Project: https://github.com/node-opcua/node-opcua
// Definitions by: Etienne Rossignon
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// tslint:disable:max-classes-per-file

import { ServerState } from "node-opcua-common";
import { AttributeIds } from "node-opcua-data-model";
import { LocalizedText, NodeClass, QualifiedName } from "node-opcua-data-model";
import { DataValue , TimestampsToReturn} from "node-opcua-data-value";
import { coerceNodeId, makeNodeId, NodeId, NodeIdType, resolveNodeId } from "node-opcua-nodeid";
import { NumericRange } from "node-opcua-numeric-range";
import { MessageSecurityMode, SecurityPolicy } from "node-opcua-secure-channel";
import {
    BrowseDescription,
    BrowseDirection,
    BrowseResponse
} from "node-opcua-service-browse";
import { ApplicationDescription, ApplicationType, EndpointDescription } from "node-opcua-service-endpoints";
import { ReadValueId, ReadValueIdOptions } from "node-opcua-service-read";
import { BrowsePath, makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { ErrorCallback } from "node-opcua-transport";
import { DataType, Variant, VariantArrayType, VariantLike } from "node-opcua-variant";

// ----------------------------------------------------------------------------------------------------------------
declare type ValidUserFunc = (username: string, password: string) => boolean;

declare type ValidUserAsyncFunc = (username: string, password: string, callback: ErrorCallback) => void;

export declare function generate_address_space(
  addressSpace: AddressSpace,
  xmlFiles: string[]| string,
  callback: ErrorCallback
): void;

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
    isForward: boolean;
}

export declare class UAReference {
}

export declare class BaseNode {

    public browseName: QualifiedName;
    public description: LocalizedText;
    public nodeClass: NodeClass;
    public nodeId: NodeId;
    public addReference(options: AddReferenceOpts): UAReference;
}

export declare class UAView extends BaseNode {
}

export declare class UAVariable extends BaseNode {
}

export declare class UAAnalogItem extends UAVariable {
}

export declare class UAObject extends BaseNode {

}
export declare class UAMethod extends BaseNode {

}

export declare class UADataType extends BaseNode {

}
export declare class UAObjectType extends BaseNode {

}
export declare class UAVariableType extends BaseNode {

}

export declare class UAReferenceType extends BaseNode {

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

export type AddVariableOptions = any;
export type AddObjectOptions = any;
export type AddObjectTypeOptions = any;
export type AddVariableTypeOptions = any;
export type AddReferenceTypeOptions = any;
export type CreateDataTypeOptions = any;
export type CreateNodeOptions = any;


export declare interface Namespace {
    namespaceUri: string;
    addressSpace: AddressSpace;
    index: number;

    findObjectType(objectType: string): UAObjectType;
    findVariableType(variableType: string): UAVariableType;
    findDataType(dataType: string): UADataType;
    findReferenceType(referenceType: string): UAReferenceType;
    findReferenceTypeFromInverseName(referenceType: string): UAReferenceType;

    addAlias(aliasName: string, nodeId: NodeId): void;

    addVariable(options: AddVariableOptions): UAVariable;
    addObject(options: AddObjectOptions): UAObject;

    addObjectType(options: AddObjectTypeOptions): UAObjectType;
    addVariableType(options: AddVariableTypeOptions): UAVariableType;
    addView(options: any): UAView;

    addFolder(parentFolder: UAObject, options: any): UAObject;

    addReferenceType(options: AddReferenceTypeOptions): UAReferenceType;

    createDataType(options: CreateDataTypeOptions): UADataType;

    createNode(options: CreateNodeOptions): BaseNode;

    deleteNode(node: NodeId| BaseNode): void;

///
    toNodeset2XML(): string;

}
export declare class AddressSpace {

    public findNode(node: NodeId | string): BaseNode;
    public findMethod(nodeId: NodeId | string): UAMethod;

    public addVariable(options: AddVariableOpts): UAVariable;

    public addAnalogDataItem(options: AddAnalogDataItemOpts): UAAnalogItem;

    public addView(options: AddNodeOptions): UAView;

    public getDefaultNamespace(): Namespace;
    public getOwnNameSpace(): Namespace;
    public getNamespace(indexOrName: number | string): Namespace;
    public registerNamespace(namespaceUri: string): Namespace;
    public getNamespaceIndex(namespaceUri: string): number;
    public getNamespaceUri(namespaceIndex: number): string;
    public getNamespaceArray(): Namespace[];

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

// tslint:disable:no-empty-interface
export interface ServerSession {

}
// server subscription
export interface Subscription {

}
// server subscription
export interface MonitoredItem {

}

