// Type definitions for node-opua
// Project: https://github.com/node-opcua/node-opcua
// Definitions by: Etienne Rossignon
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// tslint:disable:max-classes-per-file

import { ServerState } from "node-opcua-common";
import { LocalizedText } from "node-opcua-data-model";
import { MessageSecurityMode, SecurityPolicy } from "node-opcua-secure-channel";
import {
    BrowseDescription,
    BrowseDirection,
    BrowseResponse
} from "node-opcua-service-browse";
import { ApplicationDescription, ApplicationType, EndpointDescription } from "node-opcua-service-endpoints";
import { ErrorCallback } from "node-opcua-transport";

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

import {
    AddressSpace
} from "node-opcua-address-space";

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

export * from "node-opcua-certificate-manager";
import { CertificateManager } from "node-opcua-certificate-manager";

export declare class OPCUAServer {

    public bytesWritten: number;
    public bytesRead: number;
    public transactionsCount: number;
    public currentSubscriptionCount: number;
    public rejectedSessionCount: number;
    public sessionAbortCount: number;
    public publishingIntervalCount: number;
    public sessionTimeoutCount: number;


    public userCertificateManager: CertificateManager;
    public certificateManager: CertificateManager;

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
