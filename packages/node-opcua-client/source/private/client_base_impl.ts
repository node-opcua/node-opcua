/**
 * @module node-opcua-client-private
 */
// tslint:disable:no-unused-expression
import * as async from "async";
import * as chalk from "chalk";
import * as fs from "fs";
import * as path from "path";

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
import { coerceMessageSecurityMode, MessageSecurityMode } from "node-opcua-service-secure-channel";
import { ErrorCallback, StatusCode, StatusCodes } from "node-opcua-status-code";
import { matchUri } from "node-opcua-utils";

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
    OPCUAClientBaseOptions
} from "../client_base";
import { ClientSessionImpl } from "./client_session_impl";
import { getDefaultCertificateManager, makeSubject, OPCUACertificateManager } from "node-opcua-certificate-manager";
import { performCertificateSanityCheck } from "../verify";
import { VerificationStatus } from "node-opcua-pki";

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
            maxRetry: 0, /* no- retry */
            maxDelay: 2000,
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
                        " to collect certificate server (in findEndpoint) \n" +
                        " (err =" +
                        err.message +
                        ")";
                    debugLog("Fail to connect to server ", endpointUrl, " to collect certificate server");
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
            return callback(err);
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
    "uninitialized" |
    "disconnected" |
    "connecting" |
    "connected" |
    "reconnecting" |
    "disconnecting";

/*
 *    "disconnected"  ---[connect]----------------------> "connecting"
 *
 *    "connecting"    ---[(connection successfull)]-----> "connected"
 *
 *    "connecting"    ---[(connection faiulure)]--------> "disconnected"
 * 
 *    "connecting"    ---[disconnect]-------------------> "disconnecting" --> "disconnected"
 * 
 *    "connecting"    ---[lost of connection]-----------> "reconnecting" ->[reconnection]
 * 
 *    "reconnecting"  ---[reconnection successful]------> "connected"
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
export class ClientBaseImpl extends OPCUASecureObject implements OPCUAClientBase {
    /**
     * total number of requests that been canceled due to timeout
     * @property timedOutRequestCount
     * @type {Number}
     */
    public get timedOutRequestCount() {
        return this._timedOutRequestCount + (this._secureChannel ? this._secureChannel.timedOutRequestCount : 0);
    }

    /**
     * total number of transactions performed by the client
     * @property transactionsPerformed
     * @type {Number}
     */
    public get transactionsPerformed() {
        return this._transactionsPerformed + (this._secureChannel ? this._secureChannel.transactionsPerformed : 0);
    }

    /**
     * is true when the client has already requested the server end points.
     * @property knowsServerEndpoint
     * @type boolean
     */
    get knowsServerEndpoint(): boolean {
        return this._serverEndpoints && this._serverEndpoints.length > 0;
    }

    /**
     * true if the client is trying to reconnect to the server after a connection break.
     * @property isReconnecting
     * @type {Boolean}
     */
    get isReconnecting() {
        return !!(this._secureChannel && this._secureChannel.isConnecting) || this._internalState !== "connected";
    }

    /**
     * true if the connection strategy is set to automatically try to reconnect in case of failure
     * @property reconnectOnFailure
     * @type {Boolean}
     */
    get reconnectOnFailure(): boolean {
        return this.connectionStrategy.maxRetry > 0 || this.connectionStrategy.maxRetry === -1;
    }

    /**
     * total number of bytes read by the client
     * @property bytesRead
     * @type {Number}
     */
    get bytesRead() {
        return this._byteRead + (this._secureChannel ? this._secureChannel.bytesRead : 0);
    }

    /**
     * total number of bytes written by the client
     * @property bytesWritten
     * @type {Number}
     */
    public get bytesWritten() {
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

    protected _sessions: ClientSessionImpl[];
    protected _serverEndpoints: EndpointDescription[];
    protected _secureChannel: ClientSecureChannelLayer | null;
    protected disconnecting: boolean;

    // statistics...
    private _byteRead: number;
    private _byteWritten: number;

    private _timedOutRequestCount: number;

    private _transactionsPerformed: number;
    private reconnectionIsCanceled: boolean;
    private _clockAdjuster?: ClockAdjustment;
    private _tmpClient?: OPCUAClientBase;
    private _instanceNumber: number;

    public clientCertificateManager: OPCUACertificateManager;

    protected _setInternalState(internalState: InternalClientState) {
        const previousState = this._internalState;
        if (doDebug) {
            debugLog(chalk.cyan(`  Client ${this._instanceNumber} ${this.clientName} from    `), chalk.yellow(previousState), "to", chalk.yellow(internalState));
        }
        this._internalState = internalState;
    }
    public emit(eventName: string | symbol, ...others: any[]): boolean {
        if (doDebug) {
            debugLog(chalk.cyan(`  Client ${this._instanceNumber} ${this.clientName} emiting `), chalk.magentaBright(eventName));
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

        this.reconnectionIsCanceled = false;

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

    }

    private _cancel_reconnection(callback: ErrorCallback) {
        // _cancel_reconnection is invoked during disconnection
        // when we detect that a reconnection is in progress..
        assert(this.isReconnecting);

        this.reconnectionIsCanceled = true;
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

    public _recreate_secure_channel(callback: ErrorCallback) {
        debugLog("_recreate_secure_channel...", this._internalState);

        if (!this.knowsServerEndpoint) {
            debugLog("Cannot reconnect , server endpoint is unknown");
            return callback(new Error("Cannot reconnect, server endpoint is unknown"));
        }
        assert(this.knowsServerEndpoint);
        // xx ???        assert(!this.isReconnecting);
        /**
         * notifies the observer that the OPCUA is now trying to reestablish the connection
         * after having received a connection break...
         * @event start_reconnection
         *
         */
        this._setInternalState("reconnecting");
        this.emit("start_reconnection"); // send after callback

        this._destroy_secure_channel();
        assert(!this._secureChannel);

        const infiniteConnectionRetry: ConnectionStrategyOptions = {
            initialDelay: this.connectionStrategy.initialDelay,
            maxDelay: this.connectionStrategy.maxDelay,
            maxRetry: -1
        };

        const failAndRetry = (err: Error, message: string) => {
            debugLog("failAndRetry; ", message);
            if (this.reconnectionIsCanceled) {
                this.emit("reconnection_canceled");
                return callback(new Error("Reconnection has been canceled - " + this.clientName));
            }
            warningLog("client = ", this.clientName, message, err.message);
            // else
            // let retry a little bit later
            this.emit("reconnection_attempt_has_failed", err, message); // send after callback
            setTimeout(_attempt_to_recreate_secure_channel, 100);
        };

        const _attempt_to_recreate_secure_channel = () => {
            if (this.reconnectionIsCanceled) {
                this.emit("reconnection_canceled");
                return callback(new Error("Reconnection has been canceled - " + this.clientName));
            }
            this._internal_create_secure_channel(infiniteConnectionRetry, (err?: Error | null) => {
                if (err) {
                    if (err.message.match(/ECONNREFUSED|ECONNABORTED/)) {
                        return callback(err);
                    }
                    if (err.message.match("Backoff aborted.")) {
                        return failAndRetry(err!, "cannot create secure channel (backoff aborted)");
                    }
                    if (err!.message.match("BadCertificateInvalid") || err!.message.match(/_socket has been disconnected by third party/)) {
                        warningLog(
                            "the server certificate has changed,  we need to retrieve server certificate again: ",
                            err.message
                        );
                        warningLog("old server certificate ", this.serverCertificate ? makeSHA1Thumbprint(this.serverCertificate!).toString("hex") : "undefined");
                        // the server may have shut down the channel because its certificate
                        // has changed ....
                        // let request the server certificate again ....
                        debugLog(
                            chalk.bgWhite.red(
                                "ClientBaseImpl: Server Certificate has changed." + " we need to retrieve server certificate again"
                            )
                        );

                        return this.fetchServerCertificate(this.endpointUrl, (err1?: Error | null) => {
                            if (err1) {
                                errorLog("Failing to fetch new server certificate: ", err1.message);
                                return failAndRetry(err1, "trying to fetch new server certificate");
                            }
                            warningLog("new server certificate ", makeSHA1Thumbprint(this.serverCertificate!).toString("hex"));
                            this._internal_create_secure_channel(infiniteConnectionRetry, (err3?: Error | null) => {
                                if (err3) {
                                    return failAndRetry(err3, "trying to create new channel with new certificate");
                                }
                                this._setInternalState("connected");
                                this.emit("connected");
                                callback();
                            });
                        });
                    }
                    debugLog(chalk.bgWhite.red("ClientBaseImpl: cannot reconnect .."));
                    failAndRetry(err!, "cannot create secure channel");
                } else {
                    /**
                     * notify the observers that the reconnection process has been completed
                     * @event after_reconnection
                     * @param err
                     */
                    this.emit("after_reconnection", err); // send after callback
                    assert(this._secureChannel, "expecting a secureChannel here ");
                    // a new channel has be created and a new connection is established
                    debugLog(chalk.bgWhite.red("ClientBaseImpl:  RECONNECTED                !!!"));
                    this._setInternalState("connected");
                    return callback();
                }
            });
        };

        // create a secure channel
        // a new secure channel must be established
        setImmediate(() => {
            _attempt_to_recreate_secure_channel();
        });
    }

    public _internal_create_secure_channel(
        connectionStrategy: ConnectionStrategyOptions,
        callback: CreateSecureChannelCallbackFunc
    ) {
        assert(this._secureChannel === null);
        assert(typeof this.endpointUrl === "string");

        debugLog("_internal_create_secure_channel creating new ClientSecureChannelLayer");
        const secureChannel = new ClientSecureChannelLayer({
            connectionStrategy,
            defaultSecureTokenLifetime: this.defaultSecureTokenLifetime,
            parent: this,
            securityMode: this.securityMode,
            securityPolicy: this.securityPolicy,
            serverCertificate: this.serverCertificate,
            tokenRenewalInterval: this.tokenRenewalInterval
        });
        secureChannel.protocolVersion = this.protocolVersion;

        this._secureChannel = secureChannel;

        async.series(
            [
                // ------------------------------------------------- STEP 2 : OpenSecureChannel
                (_innerCallback: ErrorCallback) => {
                    debugLog("_internal_create_secure_channel before secureChannel.create");
                    secureChannel.create(this.endpointUrl, (err?: Error) => {
                        debugLog("_internal_create_secure_channel after secureChannel.create");
                        if (!this._secureChannel) {
                            debugLog("_secureChannel has been closed during the transaction !");
                            return _innerCallback(new Error("Secure Channel Closed"));
                        }
                        if (err) {
                            debugLog(chalk.yellow("Cannot create secureChannel"), err.message ? chalk.cyan(err.message) : "");
                            this._destroy_secure_channel();
                        } else {
                            assert(this._secureChannel !== null);
                            this._install_secure_channel_event_handlers(secureChannel);
                        }
                        _innerCallback(err);
                    });

                    secureChannel.on("backoff", (count: number, delay: number) => {
                        this.emit("backoff", count, delay);
                    });

                    secureChannel.on("abort", () => {
                        this.emit("abort");
                    });
                },
                // ------------------------------------------------- STEP 3 : GetEndpointsRequest
                (innerCallback: ErrorCallback) => {
                    assert(this._secureChannel !== null);
                    if (!this.knowsServerEndpoint) {
                        this.getEndpoints((err: Error | null /*, endpoints?: EndpointDescription[]*/) => {
                            if (this._secureChannel === null) {
                                assert(this.disconnecting);
                                innerCallback(new Error("disconnecting"));
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
                    this._secureChannel = null;
                    callback(err);
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
    ) {
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
    protected async createDefaultCertificate() {

        // istanbul ignore next
        if ((this as any)._increateDefaultCertificate) {
            errorLog("Internal error : rentreancy in createDefaultCertificate!");
        }

        (this as any)._increateDefaultCertificate = true;
        if (!fs.existsSync(this.certificateFile)) {
            const lockfile = path.join(this.certificateFile + ".lock");
            await withLock({ lockfile: lockfile, maxStaleDuration: 60 * 1000, retryInterval: 100 }, async () => {

                if (this.disconnecting) return;

                await ClientBaseImpl.createCertificate(this.clientCertificateManager, this.certificateFile, this.applicationName, this._getBuiltApplicationUri())
                debugLog("privateKey      = ", this.privateKeyFile);
                debugLog("                = ", this.clientCertificateManager.privateKey);
                debugLog("certificateFile = ", this.certificateFile);
                const certificate = this.getCertificate();
                const privateKey = this.getPrivateKey();
            });
        }
        (this as any)._increateDefaultCertificate = false;
    }

    protected _getBuiltApplicationUri(): string {
        if (!this._applicationUri) {
            this._applicationUri = makeApplicationUrn(getHostname(), this.applicationName);
        }
        return this._applicationUri;
    }

    protected async initializeCM(): Promise<void> {
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

    protected _handleUnrecoverableConnectionFailure(err: Error, callback: ErrorCallback) {
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

    public performMessageTransaction(request: Request, callback: ResponseCallback<Response>) {
        if (!this._secureChannel) {
            // this may happen if the Server has closed the connection abruptly for some unknown reason
            // or if the tcp connection has been broken.
            return callback(new Error("No SecureChannel , connection may have been canceled abruptly by server"));
        }
        if (this._internalState !== "connected" && this._internalState !== "connecting") {
            return callback(new Error("Invalid client state " + this._internalState));
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
    public getEndpointsRequest(options: any, callback: any) {
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

    public _removeSession(session: ClientSessionImpl) {
        const index = this._sessions.indexOf(session);

        if (index >= 0) {
            const s = this._sessions.splice(index, 1)[0];
            assert(s === session);
            assert(session._client === this);
            session._client = null;
        }
        assert(this._sessions.indexOf(session) === -1);
    }

    public disconnect(): Promise<void>;
    public disconnect(callback: ErrorCallback): void;
    public disconnect(...args: any[]): any {
        const callback = args[0];
        assert(typeof callback === "function", "expecting a callback function here");

        this.reconnectionIsCanceled = true;
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
        if (this.isReconnecting && !this.reconnectionIsCanceled) {
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

        if (this.clientCertificateManager) {
            this.clientCertificateManager.dispose();
        }
        if (this._internalState === "disconnected" || this._internalState === "disconnecting") {
            return callback();
        }
        debugLog("Disconnecting !");
        this._setInternalState("disconnecting");

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
    public _on_connection_reestablished(callback: ErrorCallback) {
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

    protected _addSession(session: ClientSessionImpl) {
        assert(!session._client || session._client === this);
        assert(this._sessions.indexOf(session) === -1, "session already added");
        session._client = this;
        this._sessions.push(session);

        if (this.keepSessionAlive) {
            session.startKeepAliveManager();
        }
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
                    warningLog("                 ", endpoint.serverCertificate.toString("base64").replace(/(.{80})/g, "$1\n                 "));
                    warningLog("                 verify that server certificate is trusted or that server certificate issuer's certificate is present in the issuer folder");
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
                debugLog(chalk.cyan(`  Client ${this._instanceNumber} ${this.clientName} byteWritten          = `), this._byteWritten);
                debugLog(chalk.cyan(`  Client ${this._instanceNumber} ${this.clientName} byteRead             = `), this._byteRead);
                debugLog(chalk.cyan(`  Client ${this._instanceNumber} ${this.clientName} transactions         = `), this._transactionsPerformed);
                debugLog(chalk.cyan(`  Client ${this._instanceNumber} ${this.clientName} timedOutRequestCount = `), this._timedOutRequestCount);
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

            this._secureChannel.dispose();
            this._secureChannel.removeAllListeners();
            this._secureChannel = null;
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

        secureChannel.on("send_request", (message: Request) => {
            /**
             * notify the observer that a request has been sent to the server.
             * @event send_request
             * @param message
             */
            this.emit("send_request", message);
        });

        secureChannel.on("receive_response", (message: Response) => {
            /**
             * notify the observer that a response has been received from the server.
             * @event receive_response
             * @param message
             */
            this.emit("receive_response", message);
        });

        secureChannel.on("lifetime_75", (token: SecurityToken) => {
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

        secureChannel.on("close", (err?: Error) => {
            debugLog(chalk.yellow.bold(" ClientBaseImpl emitting close"), err?.message);
            if (!err || !this.reconnectOnFailure) {
                // this is a normal close operation initiated by us
                /**
                 * @event close
                 * @param error
                 */
                this.emit("close", err);
                setImmediate(() => this._destroy_secure_channel());
            } else {
                /**
                 * @event connection_lost
                 */
                this.emit("connection_lost"); // instead of "close"
                this._repairConnection();
            }
        });

        secureChannel.on("timed_out_request", (request: Request) => {
            /**
             * send when a request has timed out without receiving a response
             * @event timed_out_request
             * @param request
             */
            this.emit("timed_out_request", request);
        });
    }
    private _repairConnection() {
        setImmediate(() => {
            debugLog("recreating new secure channel ");
            this._recreate_secure_channel((err1?: Error) => {
                debugLog("secureChannel#on(close) => _recreate_secure_channel returns ", err1 ? err1.message : "OK");

                if (err1) {
                    // xx assert(!this._secureChannel);
                    debugLog("_recreate_secure_channel has failed");

                    this.emit("close", err1);
                    this._setInternalState("disconnected");

                    return;
                } else {

                    this._finalReconnectionStep((err2?: Error | null) => {
                        if (err2) {
                            if (doDebug) {
                                debugLog("connection_reestablished has failed");
                                debugLog("errv= ", err2);
                            }
                            this.disconnect(() => {
                                warningLog("Disconnected following reconnection failure", err2.message);
                            });
                            return;
                        } else {
                            /**
                             * @event connection_reestablished
                             *        send when the connection is reestablished after a connection break
                             */
                            this.emit("connection_reestablished");
                            this._setInternalState("connected");
                        }
                    })
                }
            });
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
