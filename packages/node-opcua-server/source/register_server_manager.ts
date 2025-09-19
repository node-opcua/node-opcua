/**
 * @module node-opcua-server
 */
// tslint:disable:no-console
import { EventEmitter } from "events";
import chalk from "chalk";

import { assert } from "node-opcua-assert";
import { UAString } from "node-opcua-basic-types";
import {
    coerceLocalizedText,
    LocalizedTextOptions,
    OPCUAClientBase,
    OPCUAClientBaseOptions,
    ResponseCallback
} from "node-opcua-client";
import { make_debugLog, checkDebugFlag, make_warningLog } from "node-opcua-debug";
import { resolveFullyQualifiedDomainName } from "node-opcua-hostname";
import { coerceSecurityPolicy, MessageSecurityMode, SecurityPolicy } from "node-opcua-secure-channel";
import {
    RegisterServer2Request,
    RegisterServer2Response,
    RegisterServerRequest,
    RegisterServerResponse
} from "node-opcua-service-discovery";
import { ApplicationType, EndpointDescription, MdnsDiscoveryConfiguration, RegisteredServerOptions } from "node-opcua-types";
import { exploreCertificate } from "node-opcua-crypto/web";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { IRegisterServerManager, RegisterServerManagerStatus } from "./i_register_server_manager";

const doDebug = checkDebugFlag("REGISTER_LDS");
const debugLog = make_debugLog("REGISTER_LDS");
const warningLog = make_warningLog("REGISTER_LDS");


const g_DefaultRegistrationServerTimeout = 8 * 60 * 1000; // 8 minutes

function securityPolicyLevel(securityPolicy: UAString): number {
    switch (securityPolicy) {
        case SecurityPolicy.None:
            return 0;
        case SecurityPolicy.Basic128:
            return 1;
        case SecurityPolicy.Basic128Rsa15:
            return 2;
        case SecurityPolicy.Basic192:
            return 3;
        case SecurityPolicy.Basic192Rsa15:
            return 4;
        case SecurityPolicy.Basic256:
            return 5;
        case SecurityPolicy.Basic256Rsa15:
            return 6;
        case SecurityPolicy.Aes128_Sha256_RsaOaep:
            return 7;
        case SecurityPolicy.Basic256Sha256:
            return 8;
        case SecurityPolicy.Aes256_Sha256_RsaPss:
            return 9;
        default:
            return 0;
    }
}

function sortEndpointBySecurityLevel(endpoints: EndpointDescription[]): EndpointDescription[] {
    endpoints.sort((a: EndpointDescription, b: EndpointDescription) => {
        if (a.securityMode === b.securityMode) {
            if (a.securityPolicyUri === b.securityPolicyUri) {
                const sa = a.securityLevel;
                const sb = b.securityLevel;
                return sa < sb ? 1 : sa > sb ? -1 : 0;
            } else {
                const sa = securityPolicyLevel(a.securityPolicyUri);
                const sb = securityPolicyLevel(b.securityPolicyUri);
                return sa < sb ? 1 : sa > sb ? -1 : 0;
            }
        } else {
            return a.securityMode < b.securityMode ? 1 : 0;
        }
    });
    return endpoints;
}

function findSecureEndpoint(endpoints: EndpointDescription[]): EndpointDescription | null {
    // we only care about binary tcp transport endpoint
    endpoints = endpoints.filter((e: EndpointDescription) => {
        return e.transportProfileUri === "http://opcfoundation.org/UA-Profile/Transport/uatcp-uasc-uabinary";
    });

    endpoints = endpoints.filter((e: EndpointDescription) => {
        return e.securityMode === MessageSecurityMode.SignAndEncrypt;
    });

    if (endpoints.length === 0) {
        endpoints = endpoints.filter((e: EndpointDescription) => {
            return e.securityMode === MessageSecurityMode.Sign;
        });
    }
    if (endpoints.length === 0) {
        endpoints = endpoints.filter((e: EndpointDescription) => {
            return e.securityMode === MessageSecurityMode.None;
        });
    }
    endpoints = sortEndpointBySecurityLevel(endpoints);
    return endpoints[0];
}

function constructRegisteredServer(server: IPartialServer, isOnline: boolean): RegisteredServerOptions {
    const discoveryUrls = server.getDiscoveryUrls();
    assert(!isOnline || discoveryUrls.length >= 1, "expecting some discoveryUrls if we go online .... ");

    const info = exploreCertificate(server.getCertificate());
    const commonName = info.tbsCertificate.subject.commonName!;

    const serverUri = info.tbsCertificate.extensions?.subjectAltName.uniformResourceIdentifier[0];
    // istanbul ignore next
    if (serverUri !== server.serverInfo.applicationUri) {
        warningLog(
            chalk.yellow("Warning certificate uniformResourceIdentifier doesn't match serverInfo.applicationUri"),
            "\n subjectKeyIdentifier      : ",
            info.tbsCertificate.extensions?.subjectKeyIdentifier,
            "\n subjectAltName            : ",
            info.tbsCertificate.extensions?.subjectAltName,
            "\n commonName                : ",
            info.tbsCertificate.subject.commonName!,
            "\n serverInfo.applicationUri : ",
            server.serverInfo.applicationUri
        );
    }

    // istanbul ignore next
    if (!server.serverInfo.applicationName.text) {
        debugLog("warning: application name is missing");
    }
    // The globally unique identifier for the Server instance. The serverUri matches
    // the applicationUri from the ApplicationDescription defined in 7.1.
    const s = {
        serverUri: server.serverInfo.applicationUri,

        // The globally unique identifier for the Server product.
        productUri: server.serverInfo.productUri,

        serverNames: [
            {
                locale: "en-US",
                text: server.serverInfo.applicationName.text
            }
        ],
        serverType: server.serverType,

        discoveryUrls,
        gatewayServerUri: null,
        isOnline,
        semaphoreFilePath: null
    };
    return s;
}
function constructRegisterServerRequest(serverB: IPartialServer, isOnline: boolean): RegisterServerRequest {
    const server = constructRegisteredServer(serverB, isOnline);
    return new RegisterServerRequest({
        server
    });
}

function constructRegisterServer2Request(serverB: IPartialServer, isOnline: boolean): RegisterServer2Request {
    const server = constructRegisteredServer(serverB, isOnline);

    return new RegisterServer2Request({
        discoveryConfiguration: [
            new MdnsDiscoveryConfiguration({
                mdnsServerName: serverB.serverInfo.applicationUri,
                serverCapabilities: serverB.capabilitiesForMDNS
            })
        ],
        server
    });
}

const no_retry_connectivity_strategy = {
    initialDelay: 1000,
    maxDelay: 2000,
    maxRetry: 1, // NO RETRY !!!
    randomisationFactor: 0
};
const infinite_connectivity_strategy = {
    initialDelay: 2000,
    maxDelay: 50000,
    maxRetry: 10000000,
    randomisationFactor: 0
};

const pause = async (duration: number) => await new Promise<void>((resolve) => setTimeout(resolve, duration));

interface ClientBaseEx extends OPCUAClientBase {
    _serverEndpoints: EndpointDescription[];

    performMessageTransaction(request: RegisterServer2Request, callback: ResponseCallback<RegisterServer2Response>): void;
    performMessageTransaction(request: RegisterServerRequest, callback: ResponseCallback<RegisterServerResponse>): void;
}

async function sendRegisterServerRequest(server: IPartialServer, client: ClientBaseEx, isOnline: boolean) {
    // try to send a RegisterServer2Request
    const request = constructRegisterServer2Request(server, isOnline);

    await new Promise<void>((resolve, reject) => {
        client.performMessageTransaction(request, (err: Error | null, response?: RegisterServer2Response) => {
            if (!err) {
                // RegisterServerResponse
                debugLog("RegisterServerManager#_registerServer sendRegisterServer2Request has succeeded (isOnline", isOnline, ")");
                return resolve();
            }
            debugLog("RegisterServerManager#_registerServer sendRegisterServer2Request has failed " + "(isOnline", isOnline, ")");
            debugLog("RegisterServerManager#_registerServer" + " falling back to using sendRegisterServerRequest instead");
            // fall back to
            const request1 = constructRegisterServerRequest(server, isOnline);
            client.performMessageTransaction(request1, (err1: Error | null, response1?: RegisterServerResponse) => {
                if (!err1) {
                    debugLog(
                        "RegisterServerManager#_registerServer sendRegisterServerRequest " + "has succeeded (isOnline",
                        isOnline,
                        ")"
                    );
                    return resolve();
                }
                debugLog(
                    "RegisterServerManager#_registerServer sendRegisterServerRequest " + "has failed (isOnline",
                    isOnline,
                    ")"
                );
                reject(err1!)
            });
        });

    });
}

export interface IPartialServer {
    serverCertificateManager: OPCUACertificateManager;
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

let g_registeringClientCounter = 0;
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
export class RegisterServerManager extends EventEmitter implements IRegisterServerManager {
    public discoveryServerEndpointUrl: string;
    public timeout: number;

    private server: IPartialServer | null;
    private _registrationTimerId: NodeJS.Timeout | null;
    private state: RegisterServerManagerStatus = RegisterServerManagerStatus.INACTIVE;
    private _registration_client: OPCUAClientBase | null = null;
    private selectedEndpoint?: EndpointDescription;
    private _serverEndpoints: EndpointDescription[] = [];

    getState(): RegisterServerManagerStatus {
        return this.state;
    }
    constructor(options: RegisterServerManagerOptions) {
        super();

        this.server = options.server;
        this.#_setState(RegisterServerManagerStatus.INACTIVE);
        this.timeout = g_DefaultRegistrationServerTimeout;
        this.discoveryServerEndpointUrl = options.discoveryServerEndpointUrl || "opc.tcp://localhost:4840";

        assert(typeof this.discoveryServerEndpointUrl === "string");
        this._registrationTimerId = null;
    }

    public dispose(): void {
        this.server = null;
        debugLog("RegisterServerManager#dispose", this.state.toString());

        if (this._registrationTimerId) {
            clearTimeout(this._registrationTimerId);
            this._registrationTimerId = null;
        }

        assert(this._registrationTimerId === null, "stop has not been called");
        this.removeAllListeners();
    }

    #_emitEvent(eventName: string): void {
        setImmediate(() => {
            debugLog("emiting event", eventName);
            this.emit(eventName);
        });
    }

    #_setState(status: RegisterServerManagerStatus): void {
        const previousState = this.state || RegisterServerManagerStatus.INACTIVE;
        debugLog(
            "RegisterServerManager#setState : ",
            RegisterServerManagerStatus[previousState],
            " => ",
            RegisterServerManagerStatus[status]
        );
        this.state = status;
    }

    /**
     * The start method initiates the registration process in a non-blocking way.
     * It immediately returns while the actual work is performed in a background task.
     */
    public async start(): Promise<void> {
        debugLog("RegisterServerManager#start");
        if (this.state !== RegisterServerManagerStatus.INACTIVE) {
            throw new Error("RegisterServer process already started: " + RegisterServerManagerStatus[this.state]);
        }
        this.discoveryServerEndpointUrl = resolveFullyQualifiedDomainName(this.discoveryServerEndpointUrl);

        // Immediately set the state to INITIALIZING and run the process in the background.
        this.#_setState(RegisterServerManagerStatus.INITIALIZING);

        // This method is called without await to ensure it is non-blocking.
        // The catch block handles any synchronous errors.
        this.#_runRegistrationProcess().catch((err) => {
            warningLog("Synchronous error in #_runRegistrationProcess: ", (err?.message));
        });
    }

    /**
     * Private method to run the entire registration process in the background.
     * It handles the state machine transitions and re-connection logic.
     * @private
     */
    async #_runRegistrationProcess(): Promise<void> {
        while (this.getState() !== RegisterServerManagerStatus.WAITING && !this.#_isTerminating()) {
            debugLog("RegisterServerManager#_runRegistrationProcess - state =", RegisterServerManagerStatus[this.state], "isTerminating =", this.#_isTerminating());
            try {
                if (this.getState() === RegisterServerManagerStatus.INACTIVE) {
                    this.#_setState(RegisterServerManagerStatus.INITIALIZING);
                }
                await this.#_establish_initial_connection();

                if (this.getState() !== RegisterServerManagerStatus.INITIALIZING) {
                    debugLog("RegisterServerManager#_runRegistrationProcess: aborted during initialization");
                    return;
                }

                this.#_setState(RegisterServerManagerStatus.INITIALIZED);
                this.#_setState(RegisterServerManagerStatus.REGISTERING);
                this.#_emitEvent("serverRegistrationPending");

                await this.#_registerOrUnregisterServer(true);

                if (this.getState() !== RegisterServerManagerStatus.REGISTERING) {
                    debugLog("RegisterServerManager#_runRegistrationProcess: aborted during registration");
                    return;
                }

                this.#_setState(RegisterServerManagerStatus.REGISTERED);
                this.#_emitEvent("serverRegistered");
                this.#_setState(RegisterServerManagerStatus.WAITING);
                this.#_trigger_next();
                return;
            } catch (err) {
                debugLog("RegisterServerManager#_runRegistrationProcess - operation failed!", ((err as Error).message));
                if (!this.#_isTerminating()) {
                    this.#_setState(RegisterServerManagerStatus.INACTIVE);
                    this.#_emitEvent("serverRegistrationFailure");
                    await pause(Math.min(5000, this.timeout));
                }
            }
        }
    }
    #_isTerminating(): boolean {
        return this.getState() === RegisterServerManagerStatus.UNREGISTERING || this.getState() === RegisterServerManagerStatus.DISPOSING
    }

    /**
     * Establish the initial connection with the Discovery Server to extract best endpoint to use.
     * @private
     */
    async #_establish_initial_connection(): Promise<void> {
        if (!this.server) {
            this.#_setState(RegisterServerManagerStatus.DISPOSING);
            return;
        }
        if (this.state !== RegisterServerManagerStatus.INITIALIZING) {
            debugLog("RegisterServerManager#_establish_initial_connection: aborting due to state change");
            return;
        }
        debugLog("RegisterServerManager#_establish_initial_connection");

        assert(!this._registration_client);
        assert(typeof this.discoveryServerEndpointUrl === "string");
        assert(this.state === RegisterServerManagerStatus.INITIALIZING);


        this.selectedEndpoint = undefined;

        const applicationName = coerceLocalizedText(this.server.serverInfo.applicationName!)?.text || undefined;
        this.server.serverCertificateManager.referenceCounter++;

        const server = this.server;
        const prefix = `Client-${g_registeringClientCounter++}`;
        const action = "initializing";
        const ldsInfo = this.discoveryServerEndpointUrl;
        const serverInfo = this.server?.serverInfo.applicationUri!;
        const clientName = `${prefix} for server ${serverInfo} to LDS ${ldsInfo} for ${action}`;

        const registrationClient = OPCUAClientBase.create({
            clientName,
            applicationName,
            applicationUri: server.serverInfo.applicationUri!,
            connectionStrategy: infinite_connectivity_strategy,
            clientCertificateManager: server.serverCertificateManager,
            certificateFile: server.certificateFile,
            privateKeyFile: server.privateKeyFile
        }) as ClientBaseEx;


        registrationClient.on("backoff", (nbRetry: number, delay: number) => {
            if (this.state !== RegisterServerManagerStatus.INITIALIZING) return; // Ignore event if state has changed
            debugLog("RegisterServerManager - received backoff");
            debugLog(
                registrationClient.clientName,
                chalk.bgWhite.cyan("contacting discovery server backoff "),
                this.discoveryServerEndpointUrl,
                " attempt #",
                nbRetry,
                " retrying in ",
                delay / 1000.0,
                " seconds"
            );
            this.#_emitEvent("serverRegistrationPending");
        });

        // Keep track of the client to allow cancellation during connect()
        this._registration_client = registrationClient;

        try {
            await registrationClient.connect(this.discoveryServerEndpointUrl);

            if (!this._registration_client) return;

            // Re-check state after the long-running connect operation
            if (this.state !== RegisterServerManagerStatus.INITIALIZING) {
                debugLog("RegisterServerManager#_establish_initial_connection: aborted after connection");
                return;
            }


            const endpoints: EndpointDescription[] | undefined = await registrationClient.getEndpoints();
            const endpoint = findSecureEndpoint(endpoints!);
            if (!endpoint) {
                throw new Error("Cannot find Secure endpoint");
            }

            if (endpoint.serverCertificate) {
                assert(endpoint.serverCertificate);
                this.selectedEndpoint = endpoint;
            } else {
                this.selectedEndpoint = undefined;
            }

            this._serverEndpoints = registrationClient._serverEndpoints;
        } catch (err) {
            // Do not set state to INACTIVE or rethrow here, let the caller handle it.
            throw err;
        } finally {
            if (this._registration_client) {
                const tmp = this._registration_client;
                this._registration_client = null;
                try {
                    await tmp.disconnect();
                } catch (err) {
                    warningLog("RegisterServerManager#_establish_initial_connection: error disconnecting client", err);
                }
            }
        }
    }

    #_trigger_next(): void {
        assert(!this._registrationTimerId);
        assert(this.state === RegisterServerManagerStatus.WAITING);

        debugLog(
            "RegisterServerManager#_trigger_next " + ": installing timeout to perform registerServer renewal (timeout =",
            this.timeout,
            ")"
        );
        if (this._registrationTimerId) clearTimeout(this._registrationTimerId);
        this._registrationTimerId = setTimeout(() => {
            if (!this._registrationTimerId) {
                debugLog("RegisterServerManager => cancelling re registration");
                return;
            }
            this._registrationTimerId = null;

            if (this.#_isTerminating()) {
                debugLog("RegisterServerManager#_trigger_next : cancelling re registration");
                return;
            }
            debugLog("RegisterServerManager#_trigger_next : renewing RegisterServer");

            const after_register = (err?: Error) => {
                if (!this.#_isTerminating()) {
                    debugLog("RegisterServerManager#_trigger_next : renewed ! err:", err?.message);
                    this.#_setState(RegisterServerManagerStatus.WAITING);
                    this.#_emitEvent("serverRegistrationRenewed");
                    this.#_trigger_next();
                }
            };

            // State transition before the call
            this.#_setState(RegisterServerManagerStatus.REGISTERING);
            this.#_emitEvent("serverRegistrationPending");

            this.#_registerOrUnregisterServer(/*isOnline=*/true)
                .then(() => after_register())
                .catch((err) => after_register(err));
        }, this.timeout);
    }

    public async stop(): Promise<void> {
        debugLog("RegisterServerManager#stop");
        if (this.#_isTerminating()) {
            debugLog("Already stopping  or stopped...");
            return;
        }

        // make sure we don't have any timer running
        // so a registration renewal won't happen while we are stopping
        if (this._registrationTimerId) {
            clearTimeout(this._registrationTimerId);
            this._registrationTimerId = null;
        }


        // Immediately set state to signal a stop
        this.#_setState(RegisterServerManagerStatus.UNREGISTERING);

        // Cancel any pending client connections
        await this.#_cancel_pending_client_if_any();

        if (this.selectedEndpoint) {
            try {
                await this.#_registerOrUnregisterServer(/* isOnline= */false);
                this.#_setState(RegisterServerManagerStatus.UNREGISTERED);
                this.#_emitEvent("serverUnregistered");
            } catch (err) {
                warningLog(err);
                warningLog("RegisterServerManager#stop: Unregistration failed.", (err as Error).message);
            }
        }

        // Final state transition to INACTIVE
        this.#_setState(RegisterServerManagerStatus.DISPOSING);
    }

    /**
     * Handles the actual registration/unregistration request.
     * It is designed to be interruptible by checking the state.
     * @param isOnline - true for registration, false for unregistration
     * @private
     */
    async #_registerOrUnregisterServer(isOnline: boolean): Promise<void> {
        const expectedState = isOnline ? RegisterServerManagerStatus.REGISTERING : RegisterServerManagerStatus.UNREGISTERING;
        if (this.getState() !== expectedState) {
            debugLog("RegisterServerManager#_registerServer: aborting due to state change");
            return;
        }

        debugLog("RegisterServerManager#_registerServer isOnline:", isOnline);

        assert(this.selectedEndpoint, "must have a selected endpoint");
        assert(this.server!.serverType !== undefined, " must have a valid server Type");

        const server = this.server!;
        const selectedEndpoint = this.selectedEndpoint;
        if (!selectedEndpoint) {
            warningLog("Warning: cannot register server - no endpoint available");
            // Do not rethrow here, let the caller handle it.
            return;
        }

        server.serverCertificateManager.referenceCounter++;
        const applicationName: string | undefined = coerceLocalizedText(server.serverInfo.applicationName!)?.text || undefined;

        const prefix = `Client-${g_registeringClientCounter++}`;
        const action = isOnline ? "registering" : "unregistering";
        const ldsInfo = this.discoveryServerEndpointUrl;
        const serverInfo = server.serverInfo.applicationUri!;
        const clientName = `${prefix} for server ${serverInfo} to LDS ${ldsInfo} for ${action}`;

        const client = OPCUAClientBase.create({
            clientName,
            applicationName,
            applicationUri: server.serverInfo.applicationUri!,
            connectionStrategy: no_retry_connectivity_strategy,
            clientCertificateManager: server.serverCertificateManager,

            securityMode: selectedEndpoint.securityMode,
            securityPolicy: coerceSecurityPolicy(selectedEndpoint.securityPolicyUri),
            serverCertificate: selectedEndpoint.serverCertificate,
            certificateFile: server.certificateFile,
            privateKeyFile: server.privateKeyFile,

        }) as ClientBaseEx;
        client.on("backoff", (nbRetry, delay) => {
            debugLog(client.clientCertificateManager, "backoff trying to connect to the LDS has failed", nbRetry, delay);
        });

        this._registration_client = client;

        debugLog("lds endpoint uri : ", selectedEndpoint.endpointUrl);

        const state = isOnline ? "UnRegisterServer" : "RegisterServer";
        try {
            await client.connect(selectedEndpoint!.endpointUrl!);

            // Check state again after connection is established
            if (this.getState() === expectedState) {
                try {
                    await sendRegisterServerRequest(server, client as ClientBaseEx, isOnline)
                } catch (err) {
                    if (this.getState() !== expectedState) {
                        warningLog(`${state} '${this.server!.serverInfo.applicationUri}' to the LDS has failed during secure connection to the LDS server`);
                        warningLog(chalk.red("  Error message:"), (err as Error).message);                // Do not rethrow here, let the caller 
                    }
                }
            } else {
                debugLog("RegisterServerManager#_registerServer: aborted ");
            }

        } catch (err) {
            if (this.getState() !== expectedState) {

                warningLog(`${state} '${this.server!.serverInfo.applicationUri}' cannot connect to LDS at endpoint ${client.clientName}, ${selectedEndpoint.endpointUrl} :`);
                warningLog(chalk.red("  Error message:"), (err as Error).message);
            }
        } finally {
            if (this._registration_client) {
                const tmp = this._registration_client;
                this._registration_client = null;
                await tmp.disconnect();
            }
        }
    }

    /**
     * Cancels any pending client connections.
     * This is crucial for a clean shutdown.
     * @private
     */
    async #_cancel_pending_client_if_any(): Promise<void> {
        debugLog("RegisterServerManager#_cancel_pending_client_if_any");
        if (this._registration_client) {
            const client = this._registration_client;
            this._registration_client = null;
            debugLog("RegisterServerManager#_cancel_pending_client_if_any "
                + "=> wee need to disconnect_registration_client");
            try {
                await client.disconnect();
            } catch (err) {
                warningLog("Error disconnecting registration client:", (err as Error).message);
            }
            await this.#_cancel_pending_client_if_any(); // Recursive call to ensure all are handled
        } else {
            debugLog("RegisterServerManager#_cancel_pending_client_if_any : done (nothing to do)");
        }
    }
}
