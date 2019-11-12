/**
 * @module node-opcua-server
 */
// tslint:disable:no-console
import * as async from "async";
import * as chalk from "chalk";
import { EventEmitter } from "events";
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { UAString } from "node-opcua-basic-types";
import { OPCUAClientBase } from "node-opcua-client";
import { make_debugLog } from "node-opcua-debug";
import { resolveFullyQualifiedDomainName } from "node-opcua-hostname";
import {
    coerceSecurityPolicy,
    MessageSecurityMode,
    SecurityPolicy
} from "node-opcua-secure-channel";
import {
    RegisterServer2Request,
    RegisterServer2Response,
    RegisterServerRequest,
    RegisterServerResponse
} from "node-opcua-service-discovery";
import { EndpointDescription, MdnsDiscoveryConfiguration } from "node-opcua-types";
import { OPCUABaseServer } from "./base_server";
import { IRegisterServerManager } from "./I_register_server_manager";

export type EmptyCallback = (err?: Error) => void;

const debugLog = make_debugLog(__filename);

export enum RegisterServerManagerStatus {
    INACTIVE = 1,
    INITIALIZING = 2,
    REGISTERING = 3,
    WAITING = 4,
    UNREGISTERING = 5,
}

const g_DefaultRegistrationServerTimeout = 8 * 60 * 1000; // 8 minutes

function securityPolicyLevel(securityPolicy: UAString): number {
    switch (securityPolicy) {
        case SecurityPolicy.None:
            return 0;
        case SecurityPolicy.Basic128:
            return 0;
        case SecurityPolicy.Basic128Rsa15:
            return 0;
        case SecurityPolicy.Basic192:
            return 1;
        case SecurityPolicy.Basic192Rsa15:
            return 2;
        case SecurityPolicy.Basic256:
            return 3;
        case SecurityPolicy.Basic256Rsa15:
            return 3;
        case SecurityPolicy.Basic256Sha256:
            return 3;
        default:
            return 0;
    }
}

function sortEndpointBySecurityLevel(
  endpoints: EndpointDescription[]
): EndpointDescription[] {

    endpoints.sort((a: EndpointDescription, b: EndpointDescription) => {
        if (a.securityMode === b.securityMode) {
            if (a.securityPolicyUri === b.securityPolicyUri) {
                return a.securityLevel < b.securityLevel ? 1 : 0;
            } else {
                return securityPolicyLevel(a.securityPolicyUri) < securityPolicyLevel(b.securityPolicyUri) ? 1 : 0;
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

function constructRegisterServerRequest(
  server: any,
  isOnline: boolean
): RegisterServerRequest {

    const discoveryUrls = server.getDiscoveryUrls();
    assert(!isOnline || discoveryUrls.length >= 1, "expecting some discoveryUrls if we go online ....");

    return new RegisterServerRequest({

        server: {
            // The globally unique identifier for the Server instance. The serverUri matches
            // the applicationUri from the ApplicationDescription defined in 7.1.
            serverUri: server.serverInfo.applicationUri,

            // The globally unique identifier for the Server product.
            productUri: server.serverInfo.productUri,
            serverNames: [
                { locale: "en", text: server.serverInfo.productName }
            ],
            serverType: server.serverType,

            discoveryUrls,
            gatewayServerUri: null,
            isOnline,
            semaphoreFilePath: null
        }
    });
}

function constructRegisterServer2Request(
  server: any,
  isOnline: boolean
): RegisterServer2Request {

    const discoveryUrls = server.getDiscoveryUrls();
    assert(!isOnline || discoveryUrls.length >= 1, "expecting some discoveryUrls if we go online ....");

    return new RegisterServer2Request({

        server: {
            // The globally unique identifier for the Server instance. The serverUri matches
            // the applicationUri from the ApplicationDescription defined in 7.1.
            serverUri: server.serverInfo.applicationUri,

            // The globally unique identifier for the Server product.
            productUri: server.serverInfo.productUri,
            serverNames: [
                { locale: "en", text: server.serverInfo.productName }
            ],
            serverType: server.serverType,

            discoveryUrls,
            gatewayServerUri: null,
            isOnline,
            semaphoreFilePath: null
        },

        discoveryConfiguration: [
            new MdnsDiscoveryConfiguration({
                mdnsServerName: server.serverInfo.applicationUri,
                serverCapabilities: server.capabilitiesForMDNS
            })
        ]
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

function sendRegisterServerRequest(
  self: any,
  client: any,
  isOnline: boolean,
  callback: EmptyCallback
) {

    // try to send a RegisterServer2Request
    const request = constructRegisterServer2Request(self.server, isOnline);

    client.performMessageTransaction(request, (err: Error | null, response: RegisterServer2Response) => {
        if (!err) {
            // RegisterServerResponse
            debugLog("RegisterServerManager#_registerServer sendRegisterServer2Request has succeeded (isOnline",
              isOnline, ")");
            assert(response instanceof RegisterServer2Response);
            callback(err!);
        } else {
            debugLog("RegisterServerManager#_registerServer sendRegisterServer2Request has failed " +
              "(isOnline", isOnline, ")");
            debugLog("RegisterServerManager#_registerServer" +
              " falling back to using sendRegisterServerRequest instead");
            // fall back to
            const request1 = constructRegisterServerRequest(self.server, isOnline);
            // xx console.log("request",request.toString());
            client.performMessageTransaction(request1, (err1: Error | null, response1: RegisterServerResponse) => {
                if (!err1) {
                    debugLog("RegisterServerManager#_registerServer sendRegisterServerRequest " +
                      "has succeeded (isOnline", isOnline, ")");
                    assert(response1 instanceof RegisterServerResponse);
                } else {
                    debugLog("RegisterServerManager#_registerServer sendRegisterServerRequest " +
                      "has failed (isOnline", isOnline, ")");
                }
                callback(err1!);
            });
        }
    });
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
export class RegisterServerManager
  extends EventEmitter
  implements IRegisterServerManager {

    public discoveryServerEndpointUrl: string;
    private server: OPCUABaseServer | null;
    private readonly timeout: number;
    private _registrationTimerId: NodeJS.Timer | null;
    private state: RegisterServerManagerStatus = RegisterServerManagerStatus.INACTIVE;
    private _registration_client: OPCUAClientBase | null = null;
    private selectedEndpoint: any;
    private _serverEndpoints: any;

    constructor(options: any) {

        super();

        this.server = options.server;
        this._setState(RegisterServerManagerStatus.INACTIVE);
        this.timeout = g_DefaultRegistrationServerTimeout;
        this.discoveryServerEndpointUrl = options.discoveryServerEndpointUrl
          || "opc.tcp://localhost:4840";

        assert(typeof this.discoveryServerEndpointUrl === "string");
        this._registrationTimerId = null;
    }

    public dispose() {
        this.server = null;
        debugLog("RegisterServerManager#dispose", this.state.toString());
        assert(this.state === RegisterServerManagerStatus.INACTIVE);
        assert(this._registrationTimerId === null, "stop has not been called");
        this.removeAllListeners();
    }

    public _emitEvent(eventName: string) {
        setImmediate(() => {
            this.emit(eventName);
        });
    }

    public _setState(status: RegisterServerManagerStatus) {
        const previousState = this.state || "";
        debugLog("RegisterServerManager#setState : => ", status.toString(), " was ", previousState.toString());
        this.state = status;
    }

    public start(callback: (err?: Error) => void) {

        debugLog("RegisterServerManager#start");
        if (this.state !== RegisterServerManagerStatus.INACTIVE) {
            return callback(new Error("RegisterServer process already started")); // already started
        }

        this.discoveryServerEndpointUrl  = resolveFullyQualifiedDomainName(this.discoveryServerEndpointUrl);

        // perform initial registration + automatic renewal
        this._establish_initial_connection((err?: Error) => {

            if (err) {
                debugLog("RegisterServerManager#start => _establish_initial_connection has failed");
                return callback(err);
            }

            this._setState(RegisterServerManagerStatus.REGISTERING);

            this._registerServer(true, (err1?: Error) => {

                if (this.state !== RegisterServerManagerStatus.REGISTERING) {
                    debugLog("RegisterServerManager#start )=> Registration has been cancelled");
                    return callback(new Error("Registration has been cancelled"));
                }

                if (err1) {
                    debugLog("RegisterServerManager#start - registering server has failed ! " +
                      "please check that your server certificate is accepted by the LDS");
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

    public _establish_initial_connection(outer_callback: EmptyCallback) {

        if (!this.server) {
            throw  new Error("Internal Error");
        }
        debugLog("RegisterServerManager#_establish_initial_connection");

        assert(!this._registration_client);
        assert(typeof this.discoveryServerEndpointUrl === "string");
        assert(this.state === RegisterServerManagerStatus.INACTIVE);
        this._setState(RegisterServerManagerStatus.INITIALIZING);
        this.selectedEndpoint = null;

        // Retry Strategy must be set
        const client = OPCUAClientBase.create({
            certificateFile: this.server.certificateFile,
            clientName: "RegistrationClient-1",
            connectionStrategy: infinite_connectivity_strategy,
            privateKeyFile: this.server.privateKeyFile
        });

        this._registration_client = client;

        client.on("backoff", (nretry: number, delay: number) => {
            debugLog("RegisterServerManager - received backoff");
            console.log(
              chalk.bgWhite.yellow("contacting discovery server backoff "),
              this.discoveryServerEndpointUrl, " attempt #",
              nretry, " retrying in ", delay / 1000.0, " seconds");
            this._emitEvent("serverRegistrationPending");
        });

        async.series([

            //  do_initial_connection_with_discovery_server
            (callback: EmptyCallback) => {
                client.connect(this.discoveryServerEndpointUrl, (err?: Error) => {
                    if (err) {
                        debugLog("RegisterServerManager#_establish_initial_connection " +
                          ": initial connection to server has failed");
                        // xx debugLog(err);
                    }
                    return callback(err);
                });
            },

            // getEndpoints_on_discovery_server
            (callback: EmptyCallback) => {
                client.getEndpoints((err: Error | null, endpoints?: EndpointDescription[]) => {
                    if (!err) {
                        const endpoint = findSecureEndpoint(endpoints!);

                        if (!endpoint) {
                            throw new Error("Cannot find Secure endpoint");
                        }

                        if (endpoint.serverCertificate) {
                            assert(endpoint.serverCertificate);
                            this.selectedEndpoint = endpoint;
                        } else {
                            this.selectedEndpoint = null;
                        }
                    } else {
                        debugLog("RegisterServerManager#_establish_initial_connection " +
                          ": getEndpointsRequest has failed");
                        debugLog(err);
                    }
                    callback(err!);
                });
            },
            // function closing_discovery_server_connection
            (callback: EmptyCallback) => {

                this._serverEndpoints = (client as any)._serverEndpoints;

                client.disconnect((err?: Error) => {
                    // client = null;
                    callback(err);
                });
            },
            // function wait_a_little_bit
            (callback: EmptyCallback) => {
                setTimeout(callback, 100);
            }
        ], (err?: Error | null) => {

            debugLog("-------------------------------", !!err);

            this._registration_client = null;
            if (this.state !== RegisterServerManagerStatus.INITIALIZING) {
                debugLog("RegisterServerManager#_establish_initial_connection has been interrupted");
                this._setState(RegisterServerManagerStatus.INACTIVE);
                if (client) {
                    client.disconnect((err2?: Error) => {
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
                client.disconnect((err1?: Error) => {
                    this._registration_client = null;
                    debugLog("#######", !!err1);
                    outer_callback(err);
                });
            } else {
                outer_callback();
            }
        });
    }

    public _trigger_next() {

        assert(!this._registrationTimerId);
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
        debugLog("RegisterServerManager#_trigger_next " +
          ": installing timeout to perform registerServer renewal (timeout =", this.timeout, ")");

        this._registrationTimerId = setTimeout(() => {

            if (!this._registrationTimerId) {
                debugLog("RegisterServerManager => cancelling re registration");
                return;
            }
            this._registrationTimerId = null;

            debugLog("RegisterServerManager#_trigger_next : renewing RegisterServer");
            this._registerServer(true, (err?: Error) => {
                if (this.state !== RegisterServerManagerStatus.INACTIVE
                  && this.state !== RegisterServerManagerStatus.UNREGISTERING) {
                    debugLog("RegisterServerManager#_trigger_next : renewed !", err);
                    this._setState(RegisterServerManagerStatus.WAITING);
                    this._emitEvent("serverRegistrationRenewed");
                    this._trigger_next();
                }
            });
        }, this.timeout);

    }

    public stop(outer_callback: EmptyCallback) {

        debugLog("RegisterServerManager#stop");

        if (this._registrationTimerId) {
            debugLog("RegisterServerManager#stop :clearing timeout");
            clearTimeout(this._registrationTimerId);
            this._registrationTimerId = null;
        }

        this._cancel_pending_client_if_any((err?: Error) => {
            debugLog("RegisterServerManager#stop  _cancel_pending_client_if_any done ", this.state);

            if (!this.selectedEndpoint || this.state === RegisterServerManagerStatus.INACTIVE) {
                this.state = RegisterServerManagerStatus.INACTIVE;
                assert(this._registrationTimerId === null);
                return outer_callback();
            }

            if (err) {
                this._setState(RegisterServerManagerStatus.INACTIVE);
                return outer_callback(err);
            }
            this._registerServer(false, () => {
                this._setState(RegisterServerManagerStatus.INACTIVE);
                this._emitEvent("serverUnregistered");
                outer_callback(err);
            });
        });
    }

    /**
     * @param isOnline
     * @param outer_callback
     * @private
     */
    public _registerServer(isOnline: boolean, outer_callback: EmptyCallback) {
        assert(_.isFunction(outer_callback));

        debugLog("RegisterServerManager#_registerServer isOnline:",
          isOnline, "seleectedEndpoint: ", this.selectedEndpoint.endpointUrl);

        assert(this.selectedEndpoint,
          "must have a selected endpoint => please call _establish_initial_connection");

        assert(this.server!.serverType !== undefined,
          " must have a valid server Type");

        // construct connection
        const server = this.server!;
        const selectedEndpoint = this.selectedEndpoint;

        if (!selectedEndpoint) {
            console.log("Warning : cannot register server - no endpoint available");
            return outer_callback(new Error("Cannot registerServer"));
        }

        const options = {
            securityMode: selectedEndpoint.securityMode,
            securityPolicy: coerceSecurityPolicy(selectedEndpoint.securityPolicyUri),
            serverCertificate: selectedEndpoint.serverCertificate,

            certificateFile: server.certificateFile,
            privateKeyFile: server.privateKeyFile,

            clientName: "RegistrationClient-2",
            connectionStrategy: no_reconnect_connectivity_strategy
        };

        const client = OPCUAClientBase.create(options);

        const tmp = this._serverEndpoints;
        (client as any)._serverEndpoints = tmp;
        (server as any)._registration_client = client;

        const theStatus = isOnline
          ? RegisterServerManagerStatus.REGISTERING
          : RegisterServerManagerStatus.UNREGISTERING;
        this._setState(theStatus);

        debugLog("                      lds endpoint uri : ", selectedEndpoint.endpointUrl);

        async.series([
            // establish_connection_with_lds
            (callback: EmptyCallback) => {

                client.connect(selectedEndpoint.endpointUrl, (err?: Error) => {
                    debugLog("establish_connection_with_lds => err = ", err);
                    if (err) {
                        debugLog("RegisterServerManager#_registerServer connection to client has failed");
                        debugLog("RegisterServerManager#_registerServer  " +
                          "=> please check that you server certificate is trusted by the LDS");
                        console.log("RegisterServer to the LDS  has failed during secure connection  " +
                          "=> please check that you server certificate is trusted by the LDS. err: " + err.message);
                        // xx debugLog(options);
                        client.disconnect(() => {
                            debugLog("RegisterServerManager#_registerServer client disconnected");
                            callback(err);
                        });

                        //     if (false) {
                        //
                        //         // try anonymous connection then
                        //         const options = {
                        //             securityMode: MessageSecurityMode.None,
                        //             securityPolicy: SecurityPolicy.None,
                        //             serverCertificate: selectedEndpoint.serverCertificate,
                        //             certificateFile: server.certificateFile,
                        //             privateKeyFile: server.privateKeyFile
                        //         };
                        //         debugLog("RegisterServerManager#_registerServer trying with no security");
                        //
                        //         client = OPCUAClientBase.create(options);
                        //         client._serverEndpoints = tmp;
                        //         server._registration_client = client;
                        //
                        //         client.connect(selectedEndpoint.endpointUrl, function (err) {
                        //
                        //             if (err) {
                        //                 console.log(" cannot register server to discovery server " +
                        //                              self.discoveryServerEndpointUrl);
                        //                 console.log("   " + err.message);
                        //                 console.log(" make sure discovery server is up and running.");
                        //                 console.log(" also, make sure that discovery server is accepting
                        //                      and trusting server  certificate.");
                        //                 console.log(" endpoint  = ", selectedEndpoint.toString());
                        //                 console.log(" certificateFile ", server.certificateFile);
                        //                 console.log("privateKeyFile   ", server.privateKeyFile);
                        //                 client.disconnect(function () {
                        //                     callback(err);
                        //                 });
                        //                 return;
                        //             }
                        //             return callback();
                        //         });
                        //         }
                    } else {
                        callback();
                    }
                });
            },
            (callback: EmptyCallback) => {
                sendRegisterServerRequest(this, client, isOnline, (err?: Error) => {
                    callback(err!);
                });
            },
            // close_connection_with_lds
            (callback: EmptyCallback) => {
                client.disconnect(callback);
            }
        ], (err?: Error | null) => {
            debugLog("RegisterServerManager#_registerServer end (isOnline", isOnline, ")");
            (server as any)._registration_client = null;
            outer_callback(err!);
        });
    }

    private _cancel_pending_client_if_any(callback: (err?: Error) => void) {

        debugLog("RegisterServerManager#_cancel_pending_client_if_any");

        if (this._registration_client) {

            debugLog("RegisterServerManager#_cancel_pending_client_if_any " +
              "=> wee need to disconnect  _registration_client");

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
