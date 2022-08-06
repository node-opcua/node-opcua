/**
 * @module node-opcua-client-private
 */
// tslint:disable:no-unused-expression
import * as fs from "fs";
import * as path from "path";
import * as async from "async";
import * as chalk from "chalk";

import { withLock } from "@ster5/global-mutex";
import { assert } from "node-opcua-assert";
import { IOPCUASecureObjectOptions, OPCUASecureObject } from "node-opcua-common";
import { Certificate, makeSHA1Thumbprint, Nonce } from "node-opcua-crypto";
import { installPeriodicClockAdjustment, periodicClockAdjustment, uninstallPeriodicClockAdjustment } from "node-opcua-date-time";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";

import { makeApplicationUrn } from "node-opcua-common";
import { getHostname } from "node-opcua-hostname";

import {
    ClientSecureChannelLayer,
    coerceConnectionStrategy,
    coerceSecurityPolicy,
    ConnectionStrategy,
    ConnectionStrategyOptions,
    Request as Request1,
    Response as Response1,
    SecurityPolicy,
    SecurityToken
} from "node-opcua-secure-channel";
import {
    FindServersOnNetworkRequest,
    FindServersOnNetworkRequestOptions,
    FindServersOnNetworkResponse,
    FindServersRequest,
    FindServersResponse,
    ServerOnNetwork
} from "node-opcua-service-discovery";
import {
    ApplicationDescription,
    EndpointDescription,
    GetEndpointsRequest,
    GetEndpointsResponse
} from "node-opcua-service-endpoints";
import { ChannelSecurityToken, coerceMessageSecurityMode, MessageSecurityMode } from "node-opcua-service-secure-channel";
import { ErrorCallback, StatusCode, StatusCodes } from "node-opcua-status-code";
import { matchUri } from "node-opcua-utils";

import { getDefaultCertificateManager, makeSubject, OPCUACertificateManager } from "node-opcua-certificate-manager";
import { VerificationStatus } from "node-opcua-pki";
import { CloseSessionRequest, CloseSessionResponse } from "node-opcua-service-session";
import { ResponseCallback } from "../client_session";
import { Request, Response } from "../common";

import {
    CreateSecureChannelCallbackFunc,
    FindEndpointCallback,
    FindEndpointOptions,
    FindEndpointResult,
    FindServersOnNetworkRequestLike,
    FindServersRequestLike,
    GetEndpointsOptions,
    OPCUAClientBase,
    OPCUAClientBaseOptions,
    TransportSettings
} from "../client_base";
import { performCertificateSanityCheck } from "../verify";
import { ClientSessionImpl } from "./client_session_impl";
import { IClientBase } from "./i_private_client";

// tslint:disable-next-line:no-var-requires
const once = require("once");

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const errorLog = make_errorLog(__filename);
const warningLog = make_warningLog(__filename);

const defaultConnectionStrategy: ConnectionStrategyOptions = {
    initialDelay: 1000,
    maxDelay: 20 * 1000, // 20 seconds
    maxRetry: -1, // infinite
    randomisationFactor: 0.1
};

interface MasterClient extends OPCUAClientBase {
    _tmpClient?: OPCUAClientBase;
}
function __findEndpoint(this: OPCUAClientBase, endpointUrl: string, params: FindEndpointOptions, _callback: FindEndpointCallback) {
    const masterClient = this as MasterClient;
    debugLog("findEndpoint : endpointUrl = ", endpointUrl);
    debugLog(" params ", params);
    assert(!masterClient._tmpClient);

    const callback = (err: Error | null, result?: FindEndpointResult) => {
        masterClient._tmpClient = undefined;
        _callback(err, result);
    };

    const securityMode = params.securityMode;
    const securityPolicy = params.securityPolicy;
    const connectionStrategy = params.connectionStrategy;
    const options: OPCUAClientBaseOptions = {
        applicationName: params.applicationName,
        applicationUri: params.applicationUri,
        certificateFile: params.certificateFile,
        clientCertificateManager: params.clientCertificateManager,

        clientName: "EndpointFetcher",
        connectionStrategy: {
            maxRetry: 0 /* no- retry */,
            maxDelay: 2000
        },

        privateKeyFile: params.privateKeyFile
    };

    const client = new TmpClient(options);
    masterClient._tmpClient = client;

    let selectedEndpoint: EndpointDescription | undefined;
    const allEndpoints: EndpointDescription[] = [];
    const tasks = [
        (innerCallback: ErrorCallback) => {
            // rebind backoff handler
            masterClient.listeners("backoff").forEach((handler: any) => client.on("backoff", handler));

            if (doDebug) {
                client.on("backoff", (retryCount: number, delay: number) => {
                    debugLog(
                        "finding Endpoint => reconnecting ",
                        " retry count",
                        retryCount,
                        " next attempt in ",
                        delay / 1000,
                        "seconds"
                    );
                });
            }

            client.connect(endpointUrl, (err?: Error) => {
                if (err) {
                    // let's improve the error message with meaningful info
                    err.message =
                        "Fail to connect to server at " +
                        endpointUrl +
                        " to collect server's certificate (in findEndpoint) \n" +
                        " (err =" +
                        err.message +
                        ")";
                    debugLog(err.message);
                }
                return innerCallback(err);
            });
        },

        (innerCallback: ErrorCallback) => {
            client.getEndpoints((err: Error | null, endpoints?: EndpointDescription[]) => {
                if (err) {
                    err.message = "error in getEndpoints \n" + err.message;
                    return innerCallback(err);
                }
                // istanbul ignore next
                if (!endpoints) {
                    return innerCallback(new Error("Internal Error"));
                }

                for (const endpoint of endpoints) {
                    if (endpoint.securityMode === securityMode && endpoint.securityPolicyUri === securityPolicy) {
                        if (selectedEndpoint) {
                            errorLog(
                                "Warning more than one endpoint matching !",
                                endpoint.endpointUrl,
                                selectedEndpoint.endpointUrl
                            );
                        }
                        selectedEndpoint = endpoint; // found it
                    }
                }
                innerCallback();
            });
        },

        (innerCallback: ErrorCallback) => {
            client.disconnect(innerCallback);
        }
    ];

    async.series(tasks, (err) => {
        if (err) {
            client.disconnect(() => {
                callback(err);
            });
            return;
        }

        if (!selectedEndpoint) {
            return callback(
                new Error(
                    "Cannot find an Endpoint matching " +
                        " security mode: " +
                        securityMode.toString() +
                        " policy: " +
                        securityPolicy.toString()
                )
            );
        }

        // istanbul ignore next
        if (doDebug) {
            debugLog(chalk.bgWhite.red("xxxxxxxxxxxxxxxxxxxxx => selected EndPoint = "), selectedEndpoint.toString());
        }

        const result = {
            endpoints: allEndpoints,
            selectedEndpoint
        };

        callback(null, result);
    });
}

/**
 * check if certificate is trusted or untrusted
 */
function _verify_serverCertificate(
    certificateManager: OPCUACertificateManager,
    serverCertificate: Certificate,
    callback: ErrorCallback
) {
    certificateManager.checkCertificate(serverCertificate, (err: Error | null, status?: StatusCode) => {
        if (err) {
            return callback(err);
        }
        if (status !== StatusCodes.Good) {
            // do it again for debug purposes
            if (doDebug) {
                certificateManager.verifyCertificate(serverCertificate, (err1: Error | null, status1?: VerificationStatus) => {
                    debugLog(status1);
                });
            }
            warningLog("serverCertificate = ", makeSHA1Thumbprint(serverCertificate).toString("hex"));
            warningLog("serverCertificate = ", serverCertificate.toString("base64"));

            return callback(new Error("server Certificate verification failed with err " + status?.toString()));
        }
        callback();
    });
}

const forceEndpointDiscoveryOnConnect = !!parseInt(process.env.NODEOPCUA_CLIENT_FORCE_ENDPOINT_DISCOVERY || "0", 10);
debugLog("forceEndpointDiscoveryOnConnect = ", forceEndpointDiscoveryOnConnect);

class ClockAdjustment {
    constructor() {
        debugLog("installPeriodicClockAdjustment ", periodicClockAdjustment.timerInstallationCount);
        installPeriodicClockAdjustment();
    }
    dispose() {
        uninstallPeriodicClockAdjustment();
        debugLog("uninstallPeriodicClockAdjustment ", periodicClockAdjustment.timerInstallationCount);
    }
}

type InternalClientState =
    | "uninitialized"
    | "disconnected"
    | "connecting"
    | "connected"
    | "reconnecting"
    | "reconnecting_newchannel_connected"
    | "disconnecting";

/*
 *    "disconnected"  ---[connect]----------------------> "connecting"
 *
 *    "connecting"    ---[(connection successful)]------> "connected"
 *
 *    "connecting"    ---[(connection failure)]---------> "disconnected"
 *
 *    "connecting"    ---[disconnect]-------------------> "disconnecting" --> "disconnected"
 *
 *    "connecting"    ---[lost of connection]-----------> "reconnecting" ->[reconnection]
 *
 *    "reconnecting"  ---[reconnection successful]------> "reconnecting_newchannel_connected"
 *
 *    "reconnecting_newchannel_connected" --(session failure) -->"reconnecting"
 *
 *    "reconnecting"  ---[reconnection failure]---------> [reconnection] ---> "reconnecting"
 *
 *    "reconnecting"  ---[disconnect]-------------------> "disconnecting" --> "disconnected"
 */

let g_ClientCounter = 0;

/**
 * @internal
 */
// tslint:disable-next-line: max-classes-per-file
export class ClientBaseImpl extends OPCUASecureObject implements OPCUAClientBase, IClientBase {
    /**
     * total number of requests that been canceled due to timeout
     */
    public get timedOutRequestCount(): number {
        return this._timedOutRequestCount + (this._secureChannel ? this._secureChannel.timedOutRequestCount : 0);
    }

    /**
     * total number of transactions performed by the client
   x  */
    public get transactionsPerformed(): number {
        return this._transactionsPerformed + (this._secureChannel ? this._secureChannel.transactionsPerformed : 0);
    }

    /**
     * is true when the client has already requested the server end points.
     */
    get knowsServerEndpoint(): boolean {
        return this._serverEndpoints && this._serverEndpoints.length > 0;
    }

    /**
     * true if the client is trying to reconnect to the server after a connection break.
     */
    get isReconnecting(): boolean {
        return !!(this._secureChannel && this._secureChannel.isConnecting) || this._internalState !== "connected";
    }

    /**
     * true if the connection strategy is set to automatically try to reconnect in case of failure
     */
    get reconnectOnFailure(): boolean {
        return this.connectionStrategy.maxRetry > 0 || this.connectionStrategy.maxRetry === -1;
    }

    /**
     * total number of bytes read by the client
     */
    get bytesRead(): number {
        return this._byteRead + (this._secureChannel ? this._secureChannel.bytesRead : 0);
    }

    /**
     * total number of bytes written by the client
     */
    public get bytesWritten(): number {
        return this._byteWritten + (this._secureChannel ? this._secureChannel.bytesWritten : 0);
    }

    public securityMode: MessageSecurityMode;
    public securityPolicy: SecurityPolicy;
    public serverCertificate?: Certificate;
    public clientName: string;
    public protocolVersion: 0;
    public defaultSecureTokenLifetime: number;
    public tokenRenewalInterval: number;
    public connectionStrategy: ConnectionStrategy;
    public keepPendingSessionsOnDisconnect: boolean;
    public endpointUrl: string;
    public discoveryUrl: string;
    public readonly applicationName: string;
    private _applicationUri: string;

    /**
     * true if session shall periodically probe the server to keep the session alive and prevent timeout
     */
    public keepSessionAlive: boolean;

    public _sessions: ClientSessionImpl[];
    protected _serverEndpoints: EndpointDescription[];
    public _secureChannel: ClientSecureChannelLayer | null;
    protected disconnecting: boolean;

    // statistics...
    private _byteRead: number;
    private _byteWritten: number;

    private _timedOutRequestCount: number;

    private _transactionsPerformed: number;
    private _reconnectionIsCanceled: boolean;
    private _clockAdjuster?: ClockAdjustment;
    private _tmpClient?: OPCUAClientBase;
    private _instanceNumber: number;
    private _transportSettings: TransportSettings;

    public clientCertificateManager: OPCUACertificateManager;

    protected _setInternalState(internalState: InternalClientState): void {
        const previousState = this._internalState;
        if (doDebug) {
            debugLog(
                chalk.cyan(`  Client ${this._instanceNumber} ${this.clientName} from    `),
                chalk.yellow(previousState),
                "to",
                chalk.yellow(internalState)
            );
        }
        this._internalState = internalState;
    }
    public emit(eventName: string | symbol, ...others: any[]): boolean {
        if (doDebug) {
            debugLog(chalk.cyan(`  Client ${this._instanceNumber} ${this.clientName} emitting `), chalk.magentaBright(eventName));
        }
        return super.emit(eventName, ...others);
    }
    constructor(options?: OPCUAClientBaseOptions) {
        options = options || {};
        if (!options.clientCertificateManager) {
            options.clientCertificateManager = getDefaultCertificateManager("PKI");
        }
        options.privateKeyFile = options.privateKeyFile || options.clientCertificateManager.privateKey;
        options.certificateFile =
            options.certificateFile || path.join(options.clientCertificateManager.rootDir, "own/certs/client_certificate.pem");

        super(options as IOPCUASecureObjectOptions);

        this._instanceNumber = g_ClientCounter++;
        this._internalState = "uninitialized";
        this.applicationName = options.applicationName || "NodeOPCUA-Client";
        assert(!this.applicationName.match(/^locale=/), "applicationName badly converted from LocalizedText");
        assert(!this.applicationName.match(/urn:/), "applicationName should not be a URI");

        // we need to delay _applicationUri initialization
        this._applicationUri = options.applicationUri || this._getBuiltApplicationUri();

        this.disconnecting = false;

        this.clientCertificateManager = options.clientCertificateManager;

        this._secureChannel = null;

        this._reconnectionIsCanceled = false;

        this.endpointUrl = "";

        this.clientName = options.clientName || "ClientSession";

        // must be ZERO with Spec 1.0.2
        this.protocolVersion = 0;

        this._sessions = [];

        this._serverEndpoints = [];

        this.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 600000;
        this.tokenRenewalInterval = options.tokenRenewalInterval || 0;
        assert(isFinite(this.tokenRenewalInterval) && this.tokenRenewalInterval >= 0);
        this.securityMode = coerceMessageSecurityMode(options.securityMode);
        this.securityPolicy = coerceSecurityPolicy(options.securityPolicy);
        this.serverCertificate = options.serverCertificate;

        this.keepSessionAlive = typeof options.keepSessionAlive === "boolean" ? options.keepSessionAlive : false;

        // statistics...
        this._byteRead = 0;
        this._byteWritten = 0;
        this._transactionsPerformed = 0;
        this._timedOutRequestCount = 0;

        this.connectionStrategy = coerceConnectionStrategy(options.connectionStrategy || defaultConnectionStrategy);

        /***
         * @property keepPendingSessionsOnDisconnect²
         * @type {boolean}
         */
        this.keepPendingSessionsOnDisconnect = options.keepPendingSessionsOnDisconnect || false;

        this.discoveryUrl = options.discoveryUrl || "";

        this._setInternalState("disconnected");

        this._transportSettings = options.transportSettings || {};
    }

    private _cancel_reconnection(callback: ErrorCallback) {
        // _cancel_reconnection is invoked during disconnection
        // when we detect that a reconnection is in progress..
        if (!this.isReconnecting) {
            warningLog("internal error : _cancel_reconnection should be used when reconnecting is in progress");
        }
        debugLog("canceling reconnection");
        this._reconnectionIsCanceled = true;
        // istanbul ignore next
        if (!this._secureChannel) {
            debugLog("_cancel_reconnection:  Nothing to do !");
            return callback(); // nothing to do
        }

        this._secureChannel.abortConnection((/*err?: Error*/) => {
            this._secureChannel = null;
            callback();
        });
        this.once("reconnection_canceled", () => {
            /* empty */
        });
    }

    public _recreate_secure_channel(callback: ErrorCallback): void {
        debugLog("_recreate_secure_channel... while internalState is", this._internalState);

        if (!this.knowsServerEndpoint) {
            debugLog("Cannot reconnect , server endpoint is unknown");
            return callback(new Error("Cannot reconnect, server endpoint is unknown"));
        }
        assert(this.knowsServerEndpoint);

        this._setInternalState("reconnecting");
        this.emit("start_reconnection"); // send after callback

        const infiniteConnectionRetry: ConnectionStrategyOptions = {
            initialDelay: this.connectionStrategy.initialDelay,
            maxDelay: this.connectionStrategy.maxDelay,
            maxRetry: -1
        };

        const _when_internal_error = (err: Error, callback: ErrorCallback) => {
            errorLog("INTERNAL ERROR", err.message);
            callback(err);
        };

        const _when_reconnectionIsCanceled = (callback: ErrorCallback) => {
            warningLog("attempt to recreate a new secure channel : suspended becasue reconnection is canceled !");
            this.emit("reconnection_canceled");
            return callback(new Error("Reconnection has been canceled - " + this.clientName));
        };

        const _failAndRetry = (err: Error, message: string, callback: ErrorCallback) => {
            debugLog("failAndRetry; ", message);
            if (this._reconnectionIsCanceled) {
                return _when_reconnectionIsCanceled(callback);
            }
            this._destroy_secure_channel();
            warningLog("client = ", this.clientName, message, err.message);
            // else
            // let retry a little bit later
            this.emit("reconnection_attempt_has_failed", err, message); // send after callback
            setImmediate(_attempt_to_recreate_secure_channel, callback);
        };

        const _when_connected = (callback: ErrorCallback) => {
            this.emit("after_reconnection", null); // send after callback
            assert(this._secureChannel, "expecting a secureChannel here ");
            // a new channel has be created and a new connection is established
            debugLog(chalk.bgWhite.red("ClientBaseImpl:  RECONNECTED                !!!"));
            this._setInternalState("reconnecting_newchannel_connected");
            return callback();
        };

        const _attempt_to_recreate_secure_channel = (callback: ErrorCallback) => {
            debugLog("attempt to recreate a new secure channel");
            if (this._reconnectionIsCanceled) {
                return _when_reconnectionIsCanceled(callback);
            }
            assert(!this._secureChannel, "_attempt_to_recreate_secure_channel,  expecting this._secureChannel not to exist");

            this._internal_create_secure_channel(infiniteConnectionRetry, (err?: Error | null) => {
                if (err) {
                    // istanbul ignore next
                    if (this._secureChannel) {
                        const err = new Error("_internal_create_secure_channel failed, expecting this._secureChannel not to exist");
                        return _when_internal_error(err, callback);
                    }

                    if (err.message.match(/ECONNREFUSED|ECONNABORTED/)) {
                        return _failAndRetry(err, "create secure channel failed with ECONNREFUSED|ECONNABORTED", callback);
                    }

                    if (err.message.match("Backoff aborted.")) {
                        return _failAndRetry(err!, "cannot create secure channel (backoff aborted)", callback);
                    }

                    if (
                        err!.message.match("BadCertificateInvalid") ||
                        err!.message.match(/_socket has been disconnected by third party/)
                    ) {
                        warningLog(
                            "the server certificate has changed,  we need to retrieve server certificate again: ",
                            err.message
                        );
                        warningLog(
                            "old server certificate ",
                            this.serverCertificate ? makeSHA1Thumbprint(this.serverCertificate!).toString("hex") : "undefined"
                        );
                        // the server may have shut down the channel because its certificate
                        // has changed ....
                        // let request the server certificate again ....
                        return this.fetchServerCertificate(this.endpointUrl, (err1?: Error | null) => {
                            if (err1) {
                                return _failAndRetry(err1, "Failing to fetch new server certificate", callback);
                            }
                            warningLog("new server certificate ", makeSHA1Thumbprint(this.serverCertificate!).toString("hex"));
                            this._internal_create_secure_channel(infiniteConnectionRetry, (err3?: Error | null) => {
                                if (err3) {
                                    return _failAndRetry(err3, "trying to create new channel with new certificate", callback);
                                }
                                return _when_connected(callback);
                            });
                        });
                    } else {
                        return _failAndRetry(err, "cannot create secure channel", callback);
                    }
                } else {
                    return _when_connected(callback);
                }
            });
        };

        // create a secure channel
        // a new secure channel must be established
        _attempt_to_recreate_secure_channel(callback);
    }

    public _internal_create_secure_channel(
        connectionStrategy: ConnectionStrategyOptions,
        callback: CreateSecureChannelCallbackFunc
    ): void {
        assert(this._secureChannel === null);
        assert(typeof this.endpointUrl === "string");

        debugLog("_internal_create_secure_channel creating new ClientSecureChannelLayer _internalState =", this._internalState);
        const secureChannel = new ClientSecureChannelLayer({
            connectionStrategy,
            defaultSecureTokenLifetime: this.defaultSecureTokenLifetime,
            parent: this,
            securityMode: this.securityMode,
            securityPolicy: this.securityPolicy,
            serverCertificate: this.serverCertificate,
            tokenRenewalInterval: this.tokenRenewalInterval,
            transportSettings: this._transportSettings
            // transportTimeout:
        });
        secureChannel.on("backoff", (count: number, delay: number) => {
            this.emit("backoff", count, delay);
        });

        secureChannel.on("abort", () => {
            this.emit("abort");
        });

        secureChannel.protocolVersion = this.protocolVersion;

        this._secureChannel = secureChannel;

        async.series(
            [
                // ------------------------------------------------- STEP 2 : OpenSecureChannel
                (innerCallback: ErrorCallback) => {
                    debugLog("_internal_create_secure_channel before secureChannel.create");

                    secureChannel.create(this.endpointUrl, (err?: Error) => {
                        debugLog("_internal_create_secure_channel after secureChannel.create");
                        if (!this._secureChannel) {
                            debugLog("_secureChannel has been closed during the transaction !");
                            assert(this.disconnecting);
                            return innerCallback(new Error("Secure Channel Closed"));
                        }
                        if (!err) {
                            this._install_secure_channel_event_handlers(secureChannel);
                        }
                        innerCallback(err);
                    });
                },
                // ------------------------------------------------- STEP 3 : GetEndpointsRequest
                (innerCallback: ErrorCallback) => {
                    assert(this._secureChannel !== null);
                    if (!this.knowsServerEndpoint) {
                        this.getEndpoints((err: Error | null /*, endpoints?: EndpointDescription[]*/) => {
                            if (!this._secureChannel) {
                                debugLog("_secureChannel has been closed during the transaction ! (while getEndpoints)");
                                assert(this.disconnecting);
                                return innerCallback(new Error("Secure Channel Closed"));
                            }
                            innerCallback(err ? err : undefined);
                        });
                    } else {
                        // end points are already known
                        innerCallback();
                    }
                }
            ],
            (err) => {
                if (err) {
                    debugLog("Inner create secure channel has failed", err.message);
                    if (this._secureChannel) {
                        this._secureChannel!.abortConnection(() => {
                            this._destroy_secure_channel();
                            callback(err);
                        });
                    } else {
                        callback(err);
                    }
                } else {
                    assert(this._secureChannel !== null);
                    callback(null, secureChannel);
                }
            }
        );
    }

    static async createCertificate(
        clientCertificateManager: OPCUACertificateManager,
        certificateFile: string,
        applicationName: string,
        applicationUri: string
    ): Promise<void> {
        if (!fs.existsSync(certificateFile)) {
            const hostname = getHostname();
            // this.serverInfo.applicationUri!;
            await clientCertificateManager.createSelfSignedCertificate({
                applicationUri,
                dns: [hostname],
                // ip: await getIpAddresses(),
                outputFile: certificateFile,
                subject: makeSubject(applicationName, hostname),
                startDate: new Date(),
                validity: 365 * 10 // 10 years
            });
        }
        // istanbul ignore next
        if (!fs.existsSync(certificateFile)) {
            throw new Error(" cannot locate certificate file " + certificateFile);
        }
    }

    public async createDefaultCertificate(): Promise<void> {
        // istanbul ignore next
        if ((this as any)._inCreateDefaultCertificate) {
            errorLog("Internal error : re-entrancy in createDefaultCertificate!");
        }

        (this as any)._inCreateDefaultCertificate = true;
        if (!fs.existsSync(this.certificateFile)) {
            const lockfile = path.join(this.certificateFile + ".lock");
            await withLock({ lockfile: lockfile, maxStaleDuration: 60 * 1000, retryInterval: 100 }, async () => {
                if (this.disconnecting) return;

                await ClientBaseImpl.createCertificate(
                    this.clientCertificateManager,
                    this.certificateFile,
                    this.applicationName,
                    this._getBuiltApplicationUri()
                );
                debugLog("privateKey      = ", this.privateKeyFile);
                debugLog("                = ", this.clientCertificateManager.privateKey);
                debugLog("certificateFile = ", this.certificateFile);
                const certificate = this.getCertificate();
                const privateKey = this.getPrivateKey();
            });
        }
        (this as any)._inCreateDefaultCertificate = false;
    }

    protected _getBuiltApplicationUri(): string {
        if (!this._applicationUri) {
            this._applicationUri = makeApplicationUrn(getHostname(), this.applicationName);
        }
        return this._applicationUri;
    }

    protected async initializeCM(): Promise<void> {
        if (!this.clientCertificateManager) {
            // this usually happen when the client  has been already disconnected,
            // disconnect
            errorLog(
                "[NODE-OPCUA-E08] initializeCM: clientCertificateManager is null\n" +
                    "                 This happen when you disconnected the client, to free resources.\n" +
                    "                 Please create a new OPCUAClient instance if you want to reconnect"
            );
            return;
        }
        await this.clientCertificateManager.initialize();
        await this.createDefaultCertificate();
        // istanbul ignore next
        if (!fs.existsSync(this.privateKeyFile)) {
            throw new Error(" cannot locate private key file " + this.privateKeyFile);
        }

        if (this.disconnecting) return;

        const lockfile = path.join(this.certificateFile + ".lock");
        await withLock({ lockfile: lockfile, maxStaleDuration: 60 * 1000, retryInterval: 100 }, async () => {
            if (this.disconnecting) return;
            await performCertificateSanityCheck.call(this, "client", this.clientCertificateManager, this._getBuiltApplicationUri());
        });
    }

    protected _internalState: InternalClientState;

    protected _handleUnrecoverableConnectionFailure(err: Error, callback: ErrorCallback): void {
        debugLog(err.message);
        this.emit("connection_failed");
        this._setInternalState("disconnected");
        return callback(err);
    }
    private _handleDisconnectionWhileConnecting(err: Error, callback: ErrorCallback) {
        debugLog(err.message);
        this.emit("connection_failed");
        this._setInternalState("disconnected");
        return callback(err);
    }
    private _handleSuccessfulConnection(callback: ErrorCallback) {
        debugLog(" Connected successfully  to ", this.endpointUrl);
        this.emit("connected");
        this._setInternalState("connected");
        callback();
    }

    /**
     * connect the OPC-UA client to a server end point.
     * @async
     */
    public connect(endpointUrl: string): Promise<void>;
    public connect(endpointUrl: string, callback: ErrorCallback): void;
    public connect(...args: any[]): any {
        const endpointUrl = args[0];
        const callback = args[1];
        assert(typeof callback === "function", "expecting a callback");
        if (typeof endpointUrl !== "string" || endpointUrl.length <= 0) {
            errorLog("[NODE-OPCUA-E03] OPCUAClient#connect expects a valid endpoint : " + endpointUrl);
            callback(new Error("Invalid endpoint"));
            return;
        }
        assert(typeof endpointUrl === "string" && endpointUrl.length > 0);

        // istanbul ignore next
        if (this._internalState !== "disconnected") {
            callback(new Error("invalid internal state = " + this._internalState));
            return;
        }

        // prevent illegal call to connect
        if (this._secureChannel !== null) {
            setImmediate(() => callback(new Error("connect already called")));
            return;
        }

        this._setInternalState("connecting");
        this.disconnecting = false;

        this.initializeCM()
            .then(() => {
                debugLog("ClientBaseImpl#connect ", endpointUrl);
                if (this.disconnecting) {
                    return this._handleDisconnectionWhileConnecting(new Error("premature disconnection 1"), callback);
                }

                if (
                    !this.serverCertificate &&
                    (forceEndpointDiscoveryOnConnect || this.securityMode !== MessageSecurityMode.None)
                ) {
                    debugLog("Fetching certificates from endpoints");
                    this.fetchServerCertificate(endpointUrl, (err: Error | null, adjustedEndpointUrl?: string) => {
                        if (err) {
                            return this._handleUnrecoverableConnectionFailure(err, callback);
                        }
                        if (this.disconnecting) {
                            return this._handleDisconnectionWhileConnecting(new Error("premature disconnection 2"), callback);
                        }
                        if (forceEndpointDiscoveryOnConnect) {
                            debugLog("connecting with adjusted endpoint : ", adjustedEndpointUrl, "  was =", endpointUrl);
                            this._connectStep2(adjustedEndpointUrl!, callback);
                        } else {
                            debugLog("connecting with endpoint : ", endpointUrl);
                            this._connectStep2(endpointUrl, callback);
                        }
                    });
                } else {
                    this._connectStep2(endpointUrl, callback);
                }
            })
            .catch((err) => {
                return this._handleUnrecoverableConnectionFailure(err, callback);
            });
    }

    /**
     * @private
     */
    public _connectStep2(endpointUrl: string, callback: ErrorCallback): void {
        // prevent illegal call to connect
        assert(this._secureChannel === null);
        this.endpointUrl = endpointUrl;

        this._clockAdjuster = this._clockAdjuster || new ClockAdjustment();
        OPCUAClientBase.registry.register(this);

        debugLog("__connectStep2");
        this._internal_create_secure_channel(this.connectionStrategy, (err: Error | null) => {
            if (!err) {
                this._handleSuccessfulConnection(callback);
            } else {
                OPCUAClientBase.registry.unregister(this);
                if (this._clockAdjuster) {
                    this._clockAdjuster.dispose();
                    this._clockAdjuster = undefined;
                }
                debugLog(chalk.red("SecureChannel creation has failed with error :", err.message));
                if (err.message.match(/ECONNABORTED/)) {
                    debugLog(chalk.yellow("- The client cannot to :" + endpointUrl + ". Connection has been aborted."));
                    err = new Error("The connection has been aborted");
                    this._handleUnrecoverableConnectionFailure(err, callback);
                } else if (err.message.match(/ECONNREF/)) {
                    debugLog(chalk.yellow("- The client cannot to :" + endpointUrl + ". Server is not reachable."));
                    err = new Error(
                        "The connection cannot be established with server " +
                            endpointUrl +
                            " .\n" +
                            "Please check that the server is up and running or your network configuration.\n" +
                            "Err = (" +
                            err.message +
                            ")"
                    );
                    this._handleUnrecoverableConnectionFailure(err, callback);
                } else if (err.message.match(/disconnecting/)) {
                    /* */
                    this._handleDisconnectionWhileConnecting(err, callback);
                } else {
                    err = new Error("The connection may have been rejected by server,\n" + "Err = (" + err.message + ")");
                    this._handleUnrecoverableConnectionFailure(err, callback);
                }
            }
        });
    }

    public getClientNonce(): Nonce | null {
        return this._secureChannel ? this._secureChannel.getClientNonce() : null;
    }

    public performMessageTransaction(request: Request, callback: ResponseCallback<Response>): void {
        if (!this._secureChannel) {
            // this may happen if the Server has closed the connection abruptly for some unknown reason
            // or if the tcp connection has been broken.
            return callback(
                new Error("performMessageTransaction: No SecureChannel , connection may have been canceled abruptly by server")
            );
        }
        if (
            this._internalState !== "connected" &&
            this._internalState !== "reconnecting_newchannel_connected" &&
            this._internalState !== "connecting" &&
            this._internalState !== "reconnecting"
        ) {
            return callback(
                new Error(
                    "performMessageTransaction: Invalid client state " +
                        this._internalState +
                        " while performing a transaction " +
                        request.constructor.name
                )
            );
        }
        assert(this._secureChannel);
        assert(request);
        assert(request.requestHeader);
        assert(typeof callback === "function");
        this._secureChannel.performMessageTransaction(request, callback as any);
    }

    /**
     *
     * return the endpoint information matching  security mode and security policy.
     * @method findEndpoint
     */
    public findEndpointForSecurity(
        securityMode: MessageSecurityMode,
        securityPolicy: SecurityPolicy
    ): EndpointDescription | undefined {
        securityMode = coerceMessageSecurityMode(securityMode);
        securityPolicy = coerceSecurityPolicy(securityPolicy);
        assert(this.knowsServerEndpoint, "Server end point are not known yet");
        return this._serverEndpoints.find((endpoint) => {
            return endpoint.securityMode === securityMode && endpoint.securityPolicyUri === securityPolicy;
        });
    }

    /**
     *
     * return the endpoint information matching the specified url , security mode and security policy.
     * @method findEndpoint
     */
    public findEndpoint(
        endpointUrl: string,
        securityMode: MessageSecurityMode,
        securityPolicy: SecurityPolicy
    ): EndpointDescription | undefined {
        assert(this.knowsServerEndpoint, "Server end point are not known yet");
        if (!this._serverEndpoints || this._serverEndpoints.length === 0) {
            return undefined;
        }
        return this._serverEndpoints.find((endpoint: EndpointDescription) => {
            return (
                matchUri(endpoint.endpointUrl, endpointUrl) &&
                endpoint.securityMode === securityMode &&
                endpoint.securityPolicyUri === securityPolicy
            );
        });
    }

    public async getEndpoints(options?: GetEndpointsOptions): Promise<EndpointDescription[]>;
    public getEndpoints(options: GetEndpointsOptions, callback: ResponseCallback<EndpointDescription[]>): void;
    public getEndpoints(callback: ResponseCallback<EndpointDescription[]>): void;
    public getEndpoints(...args: any[]): any {
        if (args.length === 1) {
            return this.getEndpoints({}, args[0]);
        }
        const options = args[0] as GetEndpointsOptions;
        const callback = args[1] as ResponseCallback<EndpointDescription[]>;
        assert(typeof callback === "function");

        options.localeIds = options.localeIds || [];
        options.profileUris = options.profileUris || [];

        const request = new GetEndpointsRequest({
            endpointUrl: options.endpointUrl || this.endpointUrl,
            localeIds: options.localeIds,
            profileUris: options.profileUris,
            requestHeader: {
                auditEntryId: null
            }
        });

        this.performMessageTransaction(request, (err: Error | null, response?: Response) => {
            this._serverEndpoints = [];
            if (err) {
                return callback(err);
            }
            // istanbul ignore next
            if (!response || !(response instanceof GetEndpointsResponse)) {
                return callback(new Error("Internal Error"));
            }
            if (response && response.endpoints) {
                this._serverEndpoints = response.endpoints;
            }
            callback(null, this._serverEndpoints);
        });
    }

    /**
     * @deprecated
     */
    public getEndpointsRequest(options: GetEndpointsOptions, callback: ResponseCallback<EndpointDescription[]>): void {
        warningLog("note: ClientBaseImpl#getEndpointsRequest is deprecated, use ClientBaseImpl#getEndpoints instead");
        return this.getEndpoints(options, callback);
    }

    /**
     * @method findServers
     */
    public findServers(options?: FindServersRequestLike): Promise<ApplicationDescription[]>;
    public findServers(options: FindServersRequestLike, callback: ResponseCallback<ApplicationDescription[]>): void;
    public findServers(callback: ResponseCallback<ApplicationDescription[]>): void;
    public findServers(...args: any[]): any {
        if (!this._secureChannel) {
            setImmediate(() => {
                callback(new Error("Invalid Secure Channel"));
            });
            return;
        }

        if (args.length === 1) {
            return this.findServers({}, args[0]);
        }
        const options = args[0] as FindServersRequestLike;
        const callback = args[1] as ResponseCallback<ApplicationDescription[]>;

        const request = new FindServersRequest({
            endpointUrl: options.endpointUrl || this.endpointUrl,
            localeIds: options.localeIds || [],
            serverUris: options.serverUris || []
        });

        this.performMessageTransaction(request, (err: Error | null, response?: Response) => {
            if (err) {
                return callback(err);
            }
            /* istanbul ignore next */
            if (!response || !(response instanceof FindServersResponse)) {
                return callback(new Error("Internal Error"));
            }
            response.servers = response.servers || [];

            callback(null, response.servers);
        });
    }

    public findServersOnNetwork(options?: FindServersOnNetworkRequestLike): Promise<ServerOnNetwork[]>;
    public findServersOnNetwork(callback: ResponseCallback<ServerOnNetwork[]>): void;
    public findServersOnNetwork(options: FindServersOnNetworkRequestLike, callback: ResponseCallback<ServerOnNetwork[]>): void;
    public findServersOnNetwork(...args: any[]): any {
        if (args.length === 1) {
            return this.findServersOnNetwork({}, args[0]);
        }
        const options = args[0] as FindServersOnNetworkRequestOptions;
        const callback = args[1] as ResponseCallback<ServerOnNetwork[]>;

        if (!this._secureChannel) {
            setImmediate(() => {
                callback(new Error("Invalid Secure Channel"));
            });
            return;
        }

        const request = new FindServersOnNetworkRequest(options);

        this.performMessageTransaction(request, (err: Error | null, response?: Response) => {
            if (err) {
                return callback(err);
            }
            /* istanbul ignore next */
            if (!response || !(response instanceof FindServersOnNetworkResponse)) {
                return new Error("Internal Error");
            }
            response.servers = response.servers || [];
            callback(null, response.servers);
        });
    }

    public _removeSession(session: ClientSessionImpl): void {
        const index = this._sessions.indexOf(session);

        if (index >= 0) {
            const s = this._sessions.splice(index, 1)[0];
            assert(s === session);
            assert(session._client === this);
            session._client = null;
        }
        assert(this._sessions.indexOf(session) === -1);
    }

    private _closeSession(
        session: ClientSessionImpl,
        deleteSubscriptions: boolean,
        callback: (err: Error | null, response?: CloseSessionResponse) => void
    ) {
        assert(typeof callback === "function");
        assert(typeof deleteSubscriptions === "boolean");

        // istanbul ignore next
        if (!this._secureChannel) {
            return callback(null); // new Error("no channel"));
        }
        assert(this._secureChannel);
        if (!this._secureChannel.isValid()) {
            return callback(null);
        }

        debugLog(chalk.bgWhite.green("_closeSession ") + this._secureChannel!.channelId);

        if (this.isReconnecting) {
            errorLog("OPCUAClientImpl#_closeSession called while reconnection in progress ! What shall we do");
            return callback(null);
        }

        const request = new CloseSessionRequest({
            deleteSubscriptions
        });

        session.performMessageTransaction(request, (err: Error | null, response?: Response) => {
            if (err) {
                callback(err);
            } else {
                callback(err, response as CloseSessionResponse);
            }
        });
    }

    public closeSession(...args: any[]): any {
        const session = args[0] as ClientSessionImpl;
        const deleteSubscriptions = args[1];
        const callback = args[2];

        assert(typeof deleteSubscriptions === "boolean");
        assert(typeof callback === "function");
        assert(session);
        assert(session._client === this, "session must be attached to this");
        session._closed = true;

        // todo : send close session on secure channel
        this._closeSession(session, deleteSubscriptions, (err?: Error | null, response?: CloseSessionResponse) => {
            session.emitCloseEvent(StatusCodes.Good);

            this._removeSession(session);
            session.dispose();

            assert(this._sessions.indexOf(session) === -1);
            assert(session._closed, "session must indicate it is closed");

            callback(err ? err : undefined);
        });
    }

    public disconnect(): Promise<void>;
    public disconnect(callback: ErrorCallback): void;
    // eslint-disable-next-line max-statements
    public disconnect(...args: any[]): any {
        const callback = args[0];
        assert(typeof callback === "function", "expecting a callback function here");

        if (this._internalState === "disconnected" || this._internalState === "disconnecting") {
            if (this._internalState === "disconnecting") {
                warningLog("[NODE-OPCUA-W26] OPCUAClient#disconnect called while already disconnecting");
            }
            return callback();
        }
        debugLog("disconnecting client! (will set reconnectionIsCanceled to true");
        this._reconnectionIsCanceled = true;
        this.disconnecting = true;

        if (this._tmpClient) {
            this._tmpClient.disconnect((err) => {
                this._tmpClient = undefined;
                assert(!this._tmpClient);
                // retry disconnect on main client
                this.disconnect(callback);
            });
            return;
        }
        debugLog("ClientBaseImpl#disconnect", this.endpointUrl);
        if (this.isReconnecting && !this._reconnectionIsCanceled) {
            debugLog("ClientBaseImpl#disconnect called while reconnection is in progress");
            // let's abort the reconnection process
            this._cancel_reconnection((err?: Error) => {
                debugLog("ClientBaseImpl#disconnect reconnection has been canceled", this.applicationName);
                assert(!err, " why would this fail ?");
                // sessions cannot be cancelled properly and must be discarded.
                this.disconnect(callback);
            });
            return;
        }

        if (this._sessions.length && !this.keepPendingSessionsOnDisconnect) {
            debugLog("warning : disconnection : closing pending sessions");
            // disconnect has been called whereas living session exists
            // we need to close them first .... (unless keepPendingSessionsOnDisconnect)
            this._close_pending_sessions((/*err*/) => {
                this.disconnect(callback);
            });
            return;
        }

        debugLog("Disconnecting !");
        this._setInternalState("disconnecting");
        if (this.clientCertificateManager) {
            const tmp = this.clientCertificateManager;
            // (this as any).clientCertificateManager = null;
            tmp.dispose();
        }

        if (this._sessions.length) {
            // transfer active session to  orphan and detach them from channel
            const tmp = [...this._sessions];
            for (const session of tmp) {
                this._removeSession(session);
            }
            this._sessions = [];
        }
        assert(this._sessions.length === 0, " attempt to disconnect a client with live sessions ");

        OPCUAClientBase.registry.unregister(this);
        if (this._clockAdjuster) {
            this._clockAdjuster.dispose();
            this._clockAdjuster = undefined;
        }

        if (this._secureChannel) {
            let tmpChannel: any = this._secureChannel;
            this._secureChannel = null;
            debugLog("Closing channel");
            tmpChannel.close(() => {
                this._secureChannel = tmpChannel;
                tmpChannel = null;
                this._destroy_secure_channel();
                this._setInternalState("disconnected");
                setImmediate(callback);
            });
        } else {
            this.emit("close", null);
            this._setInternalState("disconnected");
            setImmediate(callback);
        }
    }

    // override me !
    public _on_connection_reestablished(callback: ErrorCallback): void {
        callback();
    }

    public toString(): string {
        let str = "\n";
        str += "  defaultSecureTokenLifetime.... " + this.defaultSecureTokenLifetime + "\n";
        str += "  securityMode.................. " + MessageSecurityMode[this.securityMode] + "\n";
        str += "  securityPolicy................ " + this.securityPolicy.toString() + "\n";
        str += "  certificate fingerprint....... " + makeSHA1Thumbprint(this.getCertificate()).toString("hex") + "\n";
        str +=
            "  server certificate fingerprint " +
            (this.serverCertificate ? makeSHA1Thumbprint(this.serverCertificate).toString("hex") : "") +
            "\n";
        // this.serverCertificate = options.serverCertificate || null + "\n";
        str += "  keepSessionAlive.............. " + this.keepSessionAlive + "\n";
        str += "  bytesRead..................... " + this.bytesRead + "\n";
        str += "  bytesWritten.................. " + this.bytesWritten + "\n";
        str += "  transactionsPerformed......... " + this.transactionsPerformed + "\n";
        str += "  timedOutRequestCount.......... " + this.timedOutRequestCount + "\n";
        str += "  connectionStrategy." + "\n";
        str += "        .maxRetry............... " + this.connectionStrategy.maxRetry + "\n";
        str += "        .initialDelay........... " + this.connectionStrategy.initialDelay + "\n";
        str += "        .maxDelay............... " + this.connectionStrategy.maxDelay + "\n";
        str += "        .randomisationFactor.... " + this.connectionStrategy.randomisationFactor + "\n";
        str += "  keepSessionAlive.............. " + this.keepSessionAlive + "\n";
        str += "  applicationName............... " + this.applicationName + "\n";
        str += "  applicationUri................ " + this._getBuiltApplicationUri() + "\n";
        str += "  clientName.................... " + this.clientName + "\n";

        if (this._secureChannel) {
            str += "secureChannel:\n" + this._secureChannel.toString();
        }
        return str;
    }

    public getSessions(): ClientSessionImpl[] {
        return this._sessions;
    }

    protected _addSession(session: ClientSessionImpl): void {
        assert(!session._client || session._client === this);
        assert(this._sessions.indexOf(session) === -1, "session already added");
        session._client = this;
        this._sessions.push(session);
    }

    private fetchServerCertificate(endpointUrl: string, callback: (err: Error | null, adjustedEndpointUrl?: string) => void): void {
        const discoveryUrl = this.discoveryUrl.length > 0 ? this.discoveryUrl : endpointUrl;
        debugLog("OPCUAClientImpl : getting serverCertificate");
        // we have not been given the serverCertificate but this certificate
        // is required as the connection is to be secured.
        //
        // Let's explore the server endpoint that matches our security settings
        // This will give us the missing Certificate as well from the server.
        // todo :
        // Once we have the certificate, we cannot trust it straight away
        // we have to verify that the certificate is valid and not outdated and not revoked.
        // if the certificate is self-signed the certificate must appear in the trust certificate
        // list.
        // if the certificate has been certified by an Certificate Authority we have to
        // verify that the certificates in the chain are valid and not revoked.
        //
        const certificateFile = this.certificateFile;
        const privateKeyFile = this.privateKeyFile;
        const applicationName = this.applicationName;
        const applicationUri = this._applicationUri;
        const params = {
            connectionStrategy: this.connectionStrategy,
            endpointMustExist: false,
            securityMode: this.securityMode,
            securityPolicy: this.securityPolicy,

            applicationName,
            applicationUri,

            certificateFile,
            privateKeyFile,

            clientCertificateManager: this.clientCertificateManager
        };
        return __findEndpoint.call(this, discoveryUrl, params, (err: Error | null, result?: FindEndpointResult) => {
            if (err) {
                return callback(err);
            }

            // istanbul ignore next
            if (!result) {
                const err1 = new Error("internal error");
                return callback(err1);
            }

            const endpoint = result.selectedEndpoint;
            if (!endpoint) {
                // no matching end point can be found ...
                const err1 = new Error(
                    "cannot find endpoint for securityMode=" +
                        MessageSecurityMode[this.securityMode] +
                        " policy = " +
                        this.securityPolicy
                );
                return callback(err1);
            }

            assert(endpoint);

            _verify_serverCertificate(this.clientCertificateManager, endpoint.serverCertificate, (err1?: Error) => {
                if (err1) {
                    warningLog("[NODE-OPCUA-W25] client's server certificate verification has failed ", err1.message);
                    warningLog("                 ", this.clientCertificateManager.rootDir);
                    warningLog(
                        "                 ",
                        endpoint.serverCertificate.toString("base64").replace(/(.{80})/g, "$1\n                 ")
                    );
                    warningLog(
                        "                 verify that server certificate is trusted or that server certificate issuer's certificate is present in the issuer folder"
                    );
                    return callback(err1);
                }
                this.serverCertificate = endpoint.serverCertificate;
                callback(null, endpoint.endpointUrl!);
            });
        });
    }
    private _accumulate_statistics() {
        if (this._secureChannel) {
            // keep accumulated statistics
            this._byteWritten += this._secureChannel.bytesWritten;
            this._byteRead += this._secureChannel.bytesRead;
            this._transactionsPerformed += this._secureChannel.transactionsPerformed;
            this._timedOutRequestCount += this._secureChannel.timedOutRequestCount;
            if (doDebug) {
                debugLog(
                    chalk.cyan(`  Client ${this._instanceNumber} ${this.clientName} byteWritten          = `),
                    this._byteWritten
                );
                debugLog(chalk.cyan(`  Client ${this._instanceNumber} ${this.clientName} byteRead             = `), this._byteRead);
                debugLog(
                    chalk.cyan(`  Client ${this._instanceNumber} ${this.clientName} transactions         = `),
                    this._transactionsPerformed
                );
                debugLog(
                    chalk.cyan(`  Client ${this._instanceNumber} ${this.clientName} timedOutRequestCount = `),
                    this._timedOutRequestCount
                );
            }
        }
    }
    private _destroy_secure_channel() {
        if (this._secureChannel) {
            if (doDebug) {
                debugLog(
                    " DESTROYING SECURE CHANNEL (isTransactionInProgress ?",
                    this._secureChannel.isTransactionInProgress(),
                    ")"
                );
            }
            this._accumulate_statistics();
            const secureChannel = this._secureChannel;
            this._secureChannel = null;
            secureChannel.dispose();
            secureChannel.removeAllListeners();
        }
    }

    private _close_pending_sessions(callback: ErrorCallback) {
        const sessions = [...this._sessions];
        async.map(
            sessions,
            (session: ClientSessionImpl, next: () => void) => {
                assert(session._client === this);

                // note: to prevent next to be call twice
                let _next_already_call = false;
                session.close((err?: Error) => {
                    if (_next_already_call) {
                        return;
                    }
                    _next_already_call = true;

                    // We should not bother if we have an error here
                    // Session may fail to close , if they haven't been activate and forcefully closed by server
                    // in a attempt to preserve resources in the case of a DDOS attack for instance.
                    if (err) {
                        const msg = session.authenticationToken ? session.authenticationToken.toString() : "";
                        debugLog(" failing to close session " + msg);
                    }
                    next();
                });
            },
            (err) => {
                // istanbul ignore next
                if (this._sessions.length > 0) {
                    debugLog(
                        this._sessions
                            .map((s: ClientSessionImpl) => (s.authenticationToken ? s.authenticationToken.toString() : ""))
                            .join(" ")
                    );
                }
                assert(this._sessions.length === 0, " failed to disconnect exiting sessions ");
                callback(err!);
            }
        );
    }

    private _install_secure_channel_event_handlers(secureChannel: ClientSecureChannelLayer) {
        assert(this instanceof ClientBaseImpl);

        secureChannel.on("send_chunk", (chunk: Buffer) => {
            /**
             * notify the observer that a message_chunk has been sent
             * @event send_chunk
             * @param message_chunk
             */
            this.emit("send_chunk", chunk);
        });

        secureChannel.on("receive_chunk", (chunk: Buffer) => {
            /**
             * notify the observer that a message_chunk has been received
             * @event receive_chunk
             * @param message_chunk
             */
            this.emit("receive_chunk", chunk);
        });

        secureChannel.on("send_request", (message: Request1) => {
            /**
             * notify the observer that a request has been sent to the server.
             * @event send_request
             * @param message
             */
            this.emit("send_request", message);
        });

        secureChannel.on("receive_response", (message: Response1) => {
            /**
             * notify the observer that a response has been received from the server.
             * @event receive_response
             * @param message
             */
            this.emit("receive_response", message);
        });

        secureChannel.on("lifetime_75", (token: ChannelSecurityToken) => {
            // secureChannel requests a new token
            debugLog(
                "SecureChannel Security Token ",
                token.tokenId,
                "live time was =",
                token.revisedLifetime,
                " is about to expired , it's time to request a new token"
            );
            // forward message to upper level
            this.emit("lifetime_75", token, secureChannel);
        });

        secureChannel.on("security_token_renewed", () => {
            // forward message to upper level
            this.emit("security_token_renewed", secureChannel);
        });

        secureChannel.on("close", (err?: Error | null) => {
            debugLog(chalk.yellow.bold(" ClientBaseImpl emitting close"), err?.message);
            this._destroy_secure_channel();
            if (!err || !this.reconnectOnFailure) {
                // this is a normal close operation initiated by us
                /**
                 * @event close
                 * @param error
                 */
                this.emit("close", err);
            } else {
                /**
                 * @event connection_lost
                 */
                // this.emit("close", err);
                if (this.reconnectOnFailure && this._internalState !== "reconnecting") {
                    debugLog(" ClientBaseImpl emitting connection_lost");
                    this.emit("connection_lost", err?.message); // instead of "close"
                    this._repairConnection();
                }
            }
        });

        secureChannel.on("timed_out_request", (request: Request1) => {
            /**
             * send when a request has timed out without receiving a response
             * @event timed_out_request
             * @param request
             */
            this.emit("timed_out_request", request);
        });
    }

    public _inside_repairConnection = false;

    private _repairConnection() {
        if (this._inside_repairConnection) {
            errorLog("_repairConnection already in progress ", this._internalState);
            return;
        }
        this._inside_repairConnection = true;
        debugLog("recreating new secure channel ", this._internalState);
        this._recreate_secure_channel((err1?: Error) => {
            debugLog("secureChannel#on(close) => _recreate_secure_channel returns ", err1 ? err1.message : "OK");

            if (err1) {
                errorLog("_recreate_secure_channel has failed: err = ", err1.message);
                this.emit("close", err1);
                this._setInternalState("disconnected");
                this._inside_repairConnection = false;
                return;
            } else {
                this._finalReconnectionStep((err2?: Error | null) => {
                    if (err2) {
                        // istanbul ignore next
                        if (doDebug) {
                            debugLog("connection_reestablished has failed");
                            debugLog("err= ", err2.message);
                        }
                        // we still need to retry connecting here !!!
                        debugLog("Disconnected following reconnection failure", err2.message);
                        debugLog(`I will retry OPCUA client reconnection in ${OPCUAClientBase.retryDelay / 1000} seconds`);
                        this._inside_repairConnection = false;
                        this._destroy_secure_channel();
                        setTimeout(() => this._repairConnection(), OPCUAClientBase.retryDelay);
                        return;
                    } else {
                        /**
                         * @event connection_reestablished
                         *        send when the connection is reestablished after a connection break
                         */
                        this.emit("connection_reestablished");
                        this._setInternalState("connected");
                        this._inside_repairConnection = false;
                    }
                });
            }
        });
    }
    private _finalReconnectionStep(callback: ErrorCallback) {
        // now delegate to upper class the
        if (this._on_connection_reestablished) {
            assert(typeof this._on_connection_reestablished === "function");
            this._on_connection_reestablished((err2?: Error) => {
                callback(err2);
            });
        } else {
            callback();
        }
    }

    /**
     *
     * @internal
     * @private
     */
    public __createSession_step2(
        session: ClientSessionImpl,
        callback: (err: Error | null, session?: ClientSessionImpl) => void
    ): void {
        throw new Error("Please override");
    }
    public _activateSession(session: ClientSessionImpl, callback: (err: Error | null, session?: ClientSessionImpl) => void): void {
        throw new Error("Please override");
    }
}

// tslint:disable-next-line: max-classes-per-file
class TmpClient extends ClientBaseImpl {
    constructor(options: OPCUAClientBaseOptions) {
        options.clientName = (options.clientName || "") + "_TmpClient";
        super(options);
    }

    async connect(endpoint: string): Promise<void>;
    connect(endpoint: string, callback: ErrorCallback): void;
    connect(endpoint: string, callback?: ErrorCallback): any {
        debugLog("connecting to TmpClient");

        // istanbul ignore next
        if (this._internalState !== "disconnected") {
            callback!(new Error("TmpClient#connect: invalid internal state " + this._internalState));
            return;
        }

        if (this.disconnecting) {
            return this._handleUnrecoverableConnectionFailure(new Error("premature disconnection 3"), callback!);
        }

        this._setInternalState("connecting");
        this._connectStep2(endpoint, (err?: Error) => {
            if (this.disconnecting) {
                return this._handleUnrecoverableConnectionFailure(new Error("premature disconnection 4"), callback!);
            }
            callback!(err);
        });
    }
}

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
ClientBaseImpl.prototype.connect = thenify.withCallback(ClientBaseImpl.prototype.connect);
ClientBaseImpl.prototype.disconnect = thenify.withCallback(ClientBaseImpl.prototype.disconnect);
ClientBaseImpl.prototype.getEndpoints = thenify.withCallback(ClientBaseImpl.prototype.getEndpoints);
ClientBaseImpl.prototype.findServers = thenify.withCallback(ClientBaseImpl.prototype.findServers);
ClientBaseImpl.prototype.findServersOnNetwork = thenify.withCallback(ClientBaseImpl.prototype.findServersOnNetwork);

OPCUAClientBase.create = (options: OPCUAClientBaseOptions): OPCUAClientBase => {
    return new ClientBaseImpl(options);
};
