/**
 * @module node-opcua
 */
// tslint:disable:no-empty
// tslint:disable:no-empty-interface
// tslint:disable:max-classes-per-file
// tslint:disable:unified-signatures

import { Request, Response } from "node-opcua-client";
export { Request, Response } from "node-opcua-client";
export * from "node-opcua-certificate-manager";
export * from "node-opcua-address-space";
export * from "node-opcua-server";


// export declare class OPCUAServer implements EventRaiser {
//     /**
//      * total number of bytes written  by the server since startup
//      */
//     public bytesWritten: number;
//     /**
//      * total number of bytes read  by the server since startup
//      */
//     public bytesRead: number;
//
//     /**
//      * the total number of transactions processed by he server so far
//      */
//     public transactionsCount: number;
//     /**
//      * the number of sessions currently active
//      */
//     public currentSessionCount: number;
//     /**
//      * the number of connected channel on all existing end points
//      */
//     public currentChannelCount: number;
//
//     /**
//      * the number of active subscriptions from all sessions
//      */
//     public currentSubscriptionCount: number;
//     /**
//      * the number of session activation requests that has been rejected
//      */
//     public readonly rejectedSessionCount: number;
//     /**
//      * the number of sessions that have been aborted
//      */
//     public readonly sessionAbortCount: number;
//     /**
//      * the
//      */
//     public readonly publishingIntervalCount: number;
//     /**
//      * the number of sessions that have reach time out
//      */
//     public readonly sessionTimeoutCount: number;
//     public readonly userCertificateManager: CertificateManager;
//     public readonly userManager: any;
//
//     public readonly buildInfo: any;
//     public readonly endpoints: OPCUAServerEndPoint[];
//     public readonly secondsTillShutdown: number;
//     public readonly serverName: string;
//     public readonly serverNameUrn: string;
//     public readonly engine: ServerEngine;
//     public readonly discoveryServerEndpointUrl: string;
//
//     public readonly capabilitiesForMDNS: string [];
//     public readonly registerServerMethod: RegisterServerMethod;
//
//     /**
//      * is the server initialized yet ?
//      */
//     public initialized: boolean;
//
//     /**
//      * is the server auditing ?
//      */
//     public isAuditing: boolean;
//
//     /**
//      *
//      * @param options - the object containing the server configuration
//      * @constructor
//      */
//     constructor(options: OPCUAServerOptions);
//
//     public setServerState(serverState: ServerState): void;
//
//     /**
//      *
//      * Initiate the server by starting all its endpoints
//      */
//     public start(callback: ErrorCallback): void;
//     public start(): Promise<void>;
//
//     /**
//      *  shutdown all server endpoints
//      * @param  timepout [=0] the timeout before the server is actually shutdown
//      * @example
//      *
//      * ```javascript
//      *    // shutdown immediately
//      *    server.shutdown(function(err) {
//      *    });
//      * ```
//      * ```ts
//      *   // in typescript with async/await
//      *   await server.shutdown();
//      * ```
//      * ```javascript
//      *    // shutdown within 10 seconds
//      *    server.shutdown(10000,function(err) {
//      *    });
//      *   ```
//      */
//     public shutdown(timeout: number, callback: ErrorCallback): void;
//     public shutdown(timeout: number): Promise<void>;
//
//     /**
//      * Initialize the server by installing default node set.
//      *
//      * and instruct the server to listen to its endpoints.
//      *
//      * ```javascript
//      * const server = new OPCUAServer();
//      * await server.initialize();
//      *
//      * // default server namespace is now initialized
//      * // it is a good time to create life instance objects
//      * const namespace = server.engine.addressSpace.getOwnNamespace();
//      * namespace.addObject({
//      *     browseName: "SomeObject",
//      *     organizedBy: server.engine.addressSpace.rootFolder.objects
//      * });
//      *
//      * // the addressSpace is now complete
//      * // let's now start listening to clients
//      * await server.start();
//      * ```
//      */
//     public initialize(done: () => void): void;
//     public initialize(): Promise<void>;
// }

// export interface ServerSession {
//     clientDescription: ApplicationDescription;
//     sessionName: string;
//     sessionTimeout: number;
//     sessionId: NodeId;
// }
//
// export interface Subscription {
// }
//
// export interface MonitoredItem {
// }
