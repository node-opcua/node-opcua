/**
 * @module node-opcua-server
 */
import { EventEmitter } from "node:events";
import type { UAString } from "node-opcua-basic-types";
import { type LocalizedTextOptions } from "node-opcua-client";
import type { ICertificateStore } from "node-opcua-common";
import { type ApplicationType } from "node-opcua-types";
import { type IRegisterServerManager, RegisterServerManagerStatus } from "./i_register_server_manager.js";
export interface IPartialServer {
    serverCertificateManager: ICertificateStore;
    certificateFile: string;
    privateKeyFile: string;
    serverType: ApplicationType;
    serverInfo: {
        applicationUri: UAString;
        applicationName: LocalizedTextOptions;
        productUri: UAString;
    };
    capabilitiesForMDNS: string[];
    getDiscoveryUrls(): string[];
    getCertificate(): Buffer;
}
export interface RegisterServerManagerOptions {
    server: IPartialServer;
    discoveryServerEndpointUrl: string;
}
/**
 * RegisterServerManager is responsible to Register an opcua server on a LDS or LDS-ME server
 * This class takes in charge :
 * - the initial registration of a server
 * - the regular registration renewal (every 8 minutes or so ...)
 * - dealing with cases where LDS is not up and running when server starts.
 * ( in this case the connection will be continuously attempted using the infinite
 * back-off strategy
 * - the un-registration of the server ( during shutdown for instance)
 *
 * Events:
 *
 * Emitted when the server is trying to registered the LDS
 * but when the connection to the lds has failed
 * serverRegistrationPending is sent when the backoff signal of the
 * connection process is rained
 * @event serverRegistrationPending
 *
 * emitted when the server is successfully registered to the LDS
 * @event serverRegistered
 *
 * emitted when the server has successfully renewed its registration to the LDS
 * @event serverRegistrationRenewed
 *
 * emitted when the server is successfully unregistered to the LDS
 * ( for instance during shutdown)
 * @event serverUnregistered
 *
 *
 * (LDS => Local Discovery Server)
 */
export declare class RegisterServerManager extends EventEmitter implements IRegisterServerManager {
    #private;
    discoveryServerEndpointUrl: string;
    timeout: number;
    private server;
    private _registrationTimerId;
    private state;
    private _registration_client;
    private selectedEndpoint?;
    private _serverEndpoints;
    private _backgroundProcessPromise;
    getState(): RegisterServerManagerStatus;
    constructor(options: RegisterServerManagerOptions);
    dispose(): void;
    /**
     * The start method initiates the registration process in a non-blocking way.
     * It immediately returns while the actual work is performed in a background task.
     */
    start(): Promise<void>;
    stop(): Promise<void>;
}
//# sourceMappingURL=register_server_manager.d.ts.map