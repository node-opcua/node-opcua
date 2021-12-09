/**
 * @module node-opcua-server
 */
// tslint:disable:no-console
import { EventEmitter } from "events";
import * as async from "async";
import * as chalk from "chalk";

import { assert } from "node-opcua-assert";
import { ErrorCallback, UAString } from "node-opcua-basic-types";
import {
    coerceLocalizedText,
    LocalizedTextLike,
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
import { exploreCertificate } from "node-opcua-crypto";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { IRegisterServerManager } from "./i_register_server_manager";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);
const warningLog = make_warningLog(__filename);

export enum RegisterServerManagerStatus {
    INACTIVE = 1,
    INITIALIZING = 2,
    REGISTERING = 3,
    WAITING = 4,
    UNREGISTERING = 5
}

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
    assert(!isOnline || discoveryUrls.length >= 1, "expecting some discoveryUrls if we go online ....");

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

const no_reconnect_connectivity_strategy = {
    initialDelay: 2000,
    maxDelay: 50000,
    maxRetry: 1, // NO RETRY !!!
    randomisationFactor: 0
};
const infinite_connectivity_strategy = {
    initialDelay: 2000,
    maxDelay: 50000,
    maxRetry: 10000000,
    randomisationFactor: 0
};

interface ClientBaseEx extends OPCUAClientBase {
    _serverEndpoints: EndpointDescription[];

    performMessageTransaction(request: RegisterServer2Request, callback: ResponseCallback<RegisterServer2Response>): void;
    performMessageTransaction(request: RegisterServerRequest, callback: ResponseCallback<RegisterServerResponse>): void;
}

function sendRegisterServerRequest(server: IPartialServer, client: ClientBaseEx, isOnline: boolean, callback: ErrorCallback) {
    // try to send a RegisterServer2Request
    const request = constructRegisterServer2Request(server, isOnline);

    client.performMessageTransaction(request, (err: Error | null, response?: RegisterServer2Response) => {
        if (!err) {
            // RegisterServerResponse
            debugLog("RegisterServerManager#_registerServer sendRegisterServer2Request has succeeded (isOnline", isOnline, ")");
            assert(response instanceof RegisterServer2Response);
            callback(err!);
        } else {
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
                    assert(response1 instanceof RegisterServerResponse);
                } else {
                    debugLog(
                        "RegisterServerManager#_registerServer sendRegisterServerRequest " + "has failed (isOnline",
                        isOnline,
                        ")"
                    );
                }
                callback(err1!);
            });
        }
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
/**
 * RegisterServerManager is responsible to Register an opcua server on a LDS or LDS-ME server
 * This class takes in charge :
 *  - the initial registration of a server
 *  - the regular registration renewal (every 8 minutes or so ...)
 *  - dealing with cases where LDS is not up and running when server starts.
 *    ( in this case the connection will be continuously attempted using the infinite
 *    back-off strategy
 *  - the un-registration of the server ( during shutdown for instance)
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
 * @param options
 * @param options.server {OPCUAServer}
 * @param options.discoveryServerEndpointUrl {String}
 * @constructor
 */
export class RegisterServerManager extends EventEmitter implements IRegisterServerManager {
    public discoveryServerEndpointUrl: string;
    public timeout: number;

    private server: IPartialServer | null;
    private _registrationTimerId: NodeJS.Timer | null;
    private state: RegisterServerManagerStatus = RegisterServerManagerStatus.INACTIVE;
    private _registration_client: OPCUAClientBase | null = null;
    private selectedEndpoint?: EndpointDescription;
    private _serverEndpoints: EndpointDescription[] = [];

    constructor(options: RegisterServerManagerOptions) {
        super();

        this.server = options.server;
        this._setState(RegisterServerManagerStatus.INACTIVE);
        this.timeout = g_DefaultRegistrationServerTimeout;
        this.discoveryServerEndpointUrl = options.discoveryServerEndpointUrl || "opc.tcp://localhost:4840";

        assert(typeof this.discoveryServerEndpointUrl === "string");
        this._registrationTimerId = null;
    }

    public dispose(): void {
        this.server = null;
        debugLog("RegisterServerManager#dispose", this.state.toString());
        assert(this.state === RegisterServerManagerStatus.INACTIVE);

        if (this._registrationTimerId) {
            clearTimeout(this._registrationTimerId);
            this._registrationTimerId = null;
        }
        
        assert(this._registrationTimerId === null, "stop has not been called");
        this.removeAllListeners();
    }

    public _emitEvent(eventName: string): void {
        setImmediate(() => {
            this.emit(eventName);
        });
    }

    public _setState(status: RegisterServerManagerStatus): void {
        const previousState = this.state || RegisterServerManagerStatus.INACTIVE;
        debugLog(
            "RegisterServerManager#setState : ",
            RegisterServerManagerStatus[previousState],
            " => ",
            RegisterServerManagerStatus[status]
        );
        this.state = status;
    }

    public start(callback: ErrorCallback): void {
        debugLog("RegisterServerManager#start");
        if (this.state !== RegisterServerManagerStatus.INACTIVE) {
            return callback(new Error("RegisterServer process already started")); // already started
        }

        this.discoveryServerEndpointUrl = resolveFullyQualifiedDomainName(this.discoveryServerEndpointUrl);

        // perform initial registration + automatic renewal
        this._establish_initial_connection((err?: Error | null) => {
            if (err) {
                debugLog("RegisterServerManager#start => _establish_initial_connection has failed");
                return callback(err);
            }
            if (this.state !== RegisterServerManagerStatus.INITIALIZING) {
                debugLog("RegisterServerManager#start => _establish_initial_connection has failed");
                return callback();
            }

            this._registerServer(true, (err1?: Error | null) => {
                if (this.state !== RegisterServerManagerStatus.REGISTERING) {
                    debugLog("RegisterServerManager#start )=> Registration has been cancelled");
                    return callback(new Error("Registration has been cancelled"));
                }

                if (err1) {
                    warningLog(
                        "RegisterServerManager#start - registering server has failed ! \n" +
                            "please check that your server certificate is accepted by the LDS"
                    );
                    this._setState(RegisterServerManagerStatus.INACTIVE);
                    this._emitEvent("serverRegistrationFailure");
                } else {
                    this._emitEvent("serverRegistered");
                    this._setState(RegisterServerManagerStatus.WAITING);
                    this._trigger_next();
                }
                callback();
            });
        });
    }

    private _establish_initial_connection(outer_callback: ErrorCallback) {
        /* istanbul ignore next */
        if (!this.server) {
            throw new Error("Internal Error");
        }
        debugLog("RegisterServerManager#_establish_initial_connection");

        assert(!this._registration_client);
        assert(typeof this.discoveryServerEndpointUrl === "string");
        assert(this.state === RegisterServerManagerStatus.INACTIVE);
        this._setState(RegisterServerManagerStatus.INITIALIZING);
        this.selectedEndpoint = undefined;

        const applicationName = coerceLocalizedText(this.server.serverInfo.applicationName!)?.text || undefined;

        // Retry Strategy must be set
        this.server.serverCertificateManager.referenceCounter++;
        const registrationClient = OPCUAClientBase.create({
            clientName: this.server.serverInfo.applicationUri!,

            applicationName,

            applicationUri: this.server.serverInfo.applicationUri!,

            connectionStrategy: infinite_connectivity_strategy,

            clientCertificateManager: this.server.serverCertificateManager,

            certificateFile: this.server.certificateFile,
            privateKeyFile: this.server.privateKeyFile
        }) as ClientBaseEx;

        this._registration_client = registrationClient;

        registrationClient.on("backoff", (nbRetry: number, delay: number) => {
            debugLog("RegisterServerManager - received backoff");
            warningLog(
                chalk.bgWhite.cyan("contacting discovery server backoff "),
                this.discoveryServerEndpointUrl,
                " attempt #",
                nbRetry,
                " retrying in ",
                delay / 1000.0,
                " seconds"
            );
            this._emitEvent("serverRegistrationPending");
        });

        async.series(
            [
                //  do_initial_connection_with_discovery_server
                (callback: ErrorCallback) => {
                    registrationClient.connect(this.discoveryServerEndpointUrl, (err?: Error) => {
                        if (err) {
                            debugLog(
                                "RegisterServerManager#_establish_initial_connection " + ": initial connection to server has failed"
                            );
                            // xx debugLog(err);
                        }
                        return callback(err);
                    });
                },

                // getEndpoints_on_discovery_server
                (callback: ErrorCallback) => {
                    registrationClient.getEndpoints((err: Error | null, endpoints?: EndpointDescription[]) => {
                        if (!err) {
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
                        } else {
                            debugLog("RegisterServerManager#_establish_initial_connection " + ": getEndpointsRequest has failed");
                            debugLog(err);
                        }
                        callback(err!);
                    });
                },
                // function closing_discovery_server_connection
                (callback: ErrorCallback) => {
                    this._serverEndpoints = registrationClient._serverEndpoints;

                    registrationClient.disconnect((err?: Error) => {
                        this._registration_client = null;
                        callback(err);
                    });
                },
                // function wait_a_little_bit
                (callback: ErrorCallback) => {
                    setTimeout(callback, 10);
                }
            ],
            (err?: Error | null) => {
                debugLog("-------------------------------", !!err);

                if (this.state !== RegisterServerManagerStatus.INITIALIZING) {
                    debugLog(
                        "RegisterServerManager#_establish_initial_connection has been interrupted ",
                        RegisterServerManagerStatus[this.state]
                    );
                    this._setState(RegisterServerManagerStatus.INACTIVE);
                    if (this._registration_client) {
                        this._registration_client.disconnect((err2?: Error) => {
                            this._registration_client = null;
                            outer_callback(new Error("Initialization has been canceled"));
                        });
                    } else {
                        outer_callback(new Error("Initialization has been canceled"));
                    }
                    return;
                }
                if (err) {
                    this._setState(RegisterServerManagerStatus.INACTIVE);
                    if (this._registration_client) {
                        this._registration_client.disconnect((err1?: Error) => {
                            this._registration_client = null;
                            debugLog("#######", !!err1);
                            outer_callback(err);
                        });
                        return;
                    }
                }
                outer_callback();
            }
        );
    }

    public _trigger_next(): void {
        assert(!this._registrationTimerId);
        assert(this.state === RegisterServerManagerStatus.WAITING);
        // from spec 1.04 part 4:
        // The registration process is designed to be platform independent, robust and able to minimize
        // problems created by configuration errors. For that reason, Servers shall register themselves more
        // than once.
        //     Under normal conditions, manually launched Servers shall periodically register with the Discovery
        // Server as long as they are able to receive connections from Clients. If a Server goes offline then it
        // shall register itself once more and indicate that it is going offline. The registration frequency
        // should be configurable; however, the maximum is 10 minutes. If an error occurs during registration
        // (e.g. the Discovery Server is not running) then the Server shall periodically re-attempt registration.
        //     The frequency of these attempts should start at 1 second but gradually increase until the
        // registration frequency is the same as what it would be if no errors occurred. The recommended
        // approach would be to double the period of each attempt until reaching the maximum.
        //     When an automatically launched Server (or its install program) registers with the Discovery Server
        // it shall provide a path to a semaphore file which the Discovery Server can use to determine if the
        //     Server has been uninstalled from the machine. The Discovery Server shall have read access to
        // the file system that contains the file

        // install a registration
        debugLog(
            "RegisterServerManager#_trigger_next " + ": installing timeout to perform registerServer renewal (timeout =",
            this.timeout,
            ")"
        );

        this._registrationTimerId = setTimeout(() => {
            if (!this._registrationTimerId) {
                debugLog("RegisterServerManager => cancelling re registration");
                return;
            }
            this._registrationTimerId = null;

            debugLog("RegisterServerManager#_trigger_next : renewing RegisterServer");
            this._registerServer(true, (err?: Error | null) => {
                if (
                    this.state !== RegisterServerManagerStatus.INACTIVE &&
                    this.state !== RegisterServerManagerStatus.UNREGISTERING
                ) {
                    debugLog("RegisterServerManager#_trigger_next : renewed !", err);
                    this._setState(RegisterServerManagerStatus.WAITING);
                    this._emitEvent("serverRegistrationRenewed");
                    this._trigger_next();
                }
            });
        }, this.timeout);
    }

    public stop(callback: ErrorCallback): void {
        debugLog("RegisterServerManager#stop");

        if (this._registrationTimerId) {
            debugLog("RegisterServerManager#stop :clearing timeout");
            clearTimeout(this._registrationTimerId);
            this._registrationTimerId = null;
        }

        this._cancel_pending_client_if_any(() => {
            debugLog("RegisterServerManager#stop  _cancel_pending_client_if_any done ", this.state);

            if (!this.selectedEndpoint || this.state === RegisterServerManagerStatus.INACTIVE) {
                this.state = RegisterServerManagerStatus.INACTIVE;
                assert(this._registrationTimerId === null);
                return callback();
            }
            this._registerServer(false, () => {
                this._setState(RegisterServerManagerStatus.INACTIVE);
                this._emitEvent("serverUnregistered");
                callback();
            });
        });
    }

    /**
     * @param isOnline
     * @param outer_callback
     * @private
     */
    public _registerServer(isOnline: boolean, outer_callback: ErrorCallback): void {
        assert(typeof outer_callback === "function");

        debugLog(
            "RegisterServerManager#_registerServer isOnline:",
            isOnline,
            "selectedEndpoint: ",
            this.selectedEndpoint?.endpointUrl
        );

        assert(this.selectedEndpoint, "must have a selected endpoint => please call _establish_initial_connection");

        assert(this.server!.serverType !== undefined, " must have a valid server Type");

        // construct connection
        const server = this.server!;
        const selectedEndpoint = this.selectedEndpoint;

        if (!selectedEndpoint) {
            warningLog("Warning : cannot register server - no endpoint available");
            return outer_callback(new Error("Cannot registerServer"));
        }

        server.serverCertificateManager.referenceCounter++;

        const applicationName: string | undefined = coerceLocalizedText(server.serverInfo.applicationName!)?.text || undefined;

        const theStatus = isOnline ? RegisterServerManagerStatus.REGISTERING : RegisterServerManagerStatus.UNREGISTERING;

        if (theStatus === this.state) {
            warningLog(`Warning the server is already in the ${RegisterServerManagerStatus[theStatus]} state`);
            return outer_callback();
        }
        if (!(this.state === RegisterServerManagerStatus.INITIALIZING || this.state === RegisterServerManagerStatus.WAITING)) {
            warningLog("Warning : cannot register server - wrong state " , RegisterServerManagerStatus[this.state]);
            return outer_callback();
        };

        this._setState(theStatus);

        if (this._registration_client) {
            warningLog(
                `Warning there is already a registering/unregistering task taking place:  ${
                    RegisterServerManagerStatus[this.state]
                } state`
            );
        }

        const options: OPCUAClientBaseOptions = {
            securityMode: selectedEndpoint.securityMode,
            securityPolicy: coerceSecurityPolicy(selectedEndpoint.securityPolicyUri),
            serverCertificate: selectedEndpoint.serverCertificate,

            clientCertificateManager: server.serverCertificateManager,

            certificateFile: server.certificateFile,
            privateKeyFile: server.privateKeyFile,

            // xx clientName: server.serverInfo.applicationUri!,

            applicationName,

            applicationUri: server.serverInfo.applicationUri!,

            connectionStrategy: no_reconnect_connectivity_strategy,

            clientName: "server client to LDS " + RegisterServerManagerStatus[theStatus]
        };

        const client = OPCUAClientBase.create(options) as ClientBaseEx;

        const tmp = this._serverEndpoints;
        client._serverEndpoints = tmp;
        this._registration_client = client;

        debugLog("                      lds endpoint uri : ", selectedEndpoint.endpointUrl);
        debugLog("                      securityMode     : ", MessageSecurityMode[selectedEndpoint.securityMode]);
        debugLog("                      securityPolicy   : ", selectedEndpoint.securityPolicyUri);

        async.series(
            [
                // establish_connection_with_lds
                (callback: ErrorCallback) => {
                    client.connect(selectedEndpoint!.endpointUrl!, (err?: Error) => {
                        debugLog("establish_connection_with_lds => err = ", err);
                        if (err) {
                            debugLog("RegisterServerManager#_registerServer connection to client has failed");
                            debugLog(
                                "RegisterServerManager#_registerServer  " +
                                    "=> please check that you server certificate is trusted by the LDS"
                            );
                            warningLog(
                                "RegisterServer to the LDS  has failed during secure connection  " +
                                    "=> please check that you server certificate is trusted by the LDS.",
                                "\nerr: " + err.message,
                                "\nLDS endpoint    :",
                                selectedEndpoint!.endpointUrl!,
                                "\nsecurity mode   :",
                                MessageSecurityMode[selectedEndpoint.securityMode],
                                "\nsecurity policy :",
                                coerceSecurityPolicy(selectedEndpoint.securityPolicyUri)
                            );
                            // xx debugLog(options);
                            client.disconnect(() => {
                                this._registration_client = null;
                                debugLog("RegisterServerManager#_registerServer client disconnected");
                                callback(/* intentionally no error propagation*/);
                            });
                        } else {
                            callback();
                        }
                    });
                },
                (callback: ErrorCallback) => {
                    if (!this._registration_client) {
                        callback();
                        return;
                    }
                    sendRegisterServerRequest(this.server!, client as ClientBaseEx, isOnline, (err?: Error | null) => {
                        callback(/* intentionally no error propagation*/);
                    });
                },
                // close_connection_with_lds
                (callback: ErrorCallback) => {
                    if (!this._registration_client) {
                        callback();
                        return;
                    }
                    client.disconnect(callback);
                }
            ],
            (err?: Error | null) => {
                if (!this._registration_client) {
                    debugLog("RegisterServerManager#_registerServer end (isOnline", isOnline, ") has been interrupted");
                    outer_callback();
                    return;
                }
                this._registration_client.disconnect(() => {
                    debugLog("RegisterServerManager#_registerServer end (isOnline", isOnline, ")");
                    this._registration_client = null;
                    outer_callback(err!);
                });
            }
        );
    }

    private _cancel_pending_client_if_any(callback: () => void) {
        debugLog("RegisterServerManager#_cancel_pending_client_if_any");

        if (this._registration_client) {
            debugLog("RegisterServerManager#_cancel_pending_client_if_any " + "=> wee need to disconnect  _registration_client");

            this._registration_client.disconnect(() => {
                this._registration_client = null;
                this._cancel_pending_client_if_any(callback);
            });
        } else {
            debugLog("RegisterServerManager#_cancel_pending_client_if_any : done");
            callback();
        }
    }
}
