/**
 * @module node-opcua-client-private
 */
// tslint:disable:no-unused-expression
import * as async from "async";
import * as chalk from "chalk";
import * as  fs from "fs";
import * as  path from "path";
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import {
    IOPCUASecureObjectOptions,
    OPCUASecureObject
} from "node-opcua-common";
import { Certificate, makeSHA1Thumbprint, Nonce, toPem } from "node-opcua-crypto";
import {
    installPeriodicClockAdjustmement,
    uninstallPeriodicClockAdjustmement
} from "node-opcua-date-time";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import {
    ClientSecureChannelLayer,
    coerceConnectionStrategy,
    coerceSecurityPolicy,
    ConnectionStrategy,
    ConnectionStrategyOptions,
    ErrorCallback,
    SecurityPolicy,
    SecurityToken
} from "node-opcua-secure-channel";
import {
    FindServersOnNetworkRequest, FindServersOnNetworkRequestOptions,
    FindServersOnNetworkResponse, FindServersRequest,
    FindServersResponse, ServerOnNetwork
} from "node-opcua-service-discovery";
import {
    ApplicationDescription, EndpointDescription,
    GetEndpointsRequest, GetEndpointsResponse
} from "node-opcua-service-endpoints";
import {
    coerceMessageSecurityMode, MessageSecurityMode
} from "node-opcua-service-secure-channel";

import { ResponseCallback } from "../client_session";
import { Request, Response } from "../common";

import {
    CreateSecureChannelCallbackFunc, FindEndpointCallback,
    FindEndpointOptions,
    FindEndpointResult, FindServersOnNetworkRequestLike, FindServersRequestLike,
    GetEndpointsOptions,
    OPCUAClientBase,
    OPCUAClientBaseOptions
} from "../client_base";
import { ClientSessionImpl } from "./client_session_impl";

// tslint:disable-next-line:no-var-requires
const once = require("once");

const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);
const doDebug = checkDebugFlag(__filename);

const defaultConnectionStrategy: ConnectionStrategyOptions = {
    initialDelay: 1000,
    maxDelay: 20 * 1000, // 20 seconds
    maxRetry: -1, // infinite
    randomisationFactor: 0.1
};

const warningLog = debugLog;

function __findEndpoint(
    masterClient: OPCUAClientBase,
    endpointUrl: string,
    params: FindEndpointOptions,
    callback: FindEndpointCallback
) {

    debugLog("findEndpoint : endpointUrl = ", endpointUrl);

    const securityMode = params.securityMode;
    const securityPolicy = params.securityPolicy;

    const options: OPCUAClientBaseOptions = {
        connectionStrategy: params.connectionStrategy,

        // endpoint_must_exist: false,

        applicationName: params.applicationName,
        certificateFile: params.certificateFile,
        privateKeyFile: params.privateKeyFile

    };

    const client = new ClientBaseImpl(options);

    let selectedEndpoints: any = null;
    const allEndpoints: any = null;
    const tasks = [

        (innerCallback: ErrorCallback) => {

            // rebind backoff handler
            masterClient.listeners("backoff").forEach(
                (handler: any) => client.on("backoff", handler));

            if (doDebug) {
                client.on("backoff", (retryCount: number, delay: number) => {
                    debugLog("finding Endpoint => reconnecting ",
                        " retry count", retryCount, " next attempt in ", delay / 1000, "seconds");
                });
            }

            client.connect(endpointUrl, (err?: Error) => {
                if (err) {
                    // let's improve the error message with meaningful info
                    err.message = "Fail to connect to server at " + endpointUrl +
                        " to collect certificate server (in findEndpoint) \n" +
                        " (err =" + err.message + ")";
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
                if (!endpoints) {
                    return innerCallback(new Error("Internal Error"));
                }

                endpoints.forEach((endpoint: EndpointDescription) => {
                    if (endpoint.securityMode === securityMode && endpoint.securityPolicyUri === securityPolicy) {
                        selectedEndpoints = endpoint; // found it
                    }
                });

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

        if (!selectedEndpoints) {
            callback(new Error("Cannot find an Endpoint matching " +
                " security mode: " + securityMode.toString() +
                " policy: " + securityPolicy.toString()));
        }

        const result = {
            endpoints: allEndpoints,
            selectedEndpoint: selectedEndpoints
        };
        callback(null, result);
    });
}

/**
 * check if certificate is trusted or untrusted
 */
function _verify_serverCertificate(serverCertificate: Certificate, callback: ErrorCallback) {

    // todo:
    //  - use Certificate manager to deal with trusted/ untrusted certificate
    //  - add certificate verification and validity check

    const pkiFolder = process.cwd() + "/pki";

    // istanbul ignore next
    if (!fs.existsSync(pkiFolder)) {
        fs.mkdirSync(pkiFolder);
    }
    const pkiRejectedCertificateFolder = path.join(pkiFolder, "rejected");

    // istanbul ignore next
    if (!fs.existsSync(pkiRejectedCertificateFolder)) {
        fs.mkdirSync(pkiRejectedCertificateFolder);
    }
    const thumbprint = makeSHA1Thumbprint(serverCertificate);

    const certificateFilename = path.join(pkiRejectedCertificateFolder, thumbprint.toString("hex") + ".pem");
    fs.writeFile(certificateFilename, toPem(serverCertificate, "CERTIFICATE"), () => {
        setImmediate(callback);
    });
}

/**
 * @internal
 */
export class ClientBaseImpl extends OPCUASecureObject implements OPCUAClientBase {

    /**
     *
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
        return (this._serverEndpoints && this._serverEndpoints.length > 0);
    }

    /**
     * @property isReconnecting
     * @type {Boolean} true if the client is trying to reconnect to the server after a connection break.
     */
    get isReconnecting() {
        return !!(this._secureChannel && this._secureChannel.isConnecting);
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

    /// true if session shall periodically probe the server to keep the session alive and prevent timeout
    public keepSessionAlive: boolean;
    public _sessions: any;
    protected _serverEndpoints: EndpointDescription[];
    protected _secureChannel: ClientSecureChannelLayer | null;
    // statistics...
    private _byteRead: number;
    private _byteWritten: number;

    private _timedOutRequestCount: number;

    private _transactionsPerformed: number;
    private reconnectionIsCanceled: boolean;

    constructor(options?: OPCUAClientBaseOptions) {

        options = options || {};

        if (!options.certificateFile) {
            options.certificateFile = path.join(__dirname, "../../certificates/client_selfsigned_cert_2048.pem");
        }
        if (!options.privateKeyFile) {
            options.privateKeyFile = path.join(__dirname, "../../certificates/PKI/own/private/private_key.pem");
        }

        // istanbul ignore next
        if (!fs.existsSync(options.certificateFile)) {
            throw new Error(" cannot locate certificate file " + options.certificateFile);
        }

        // istanbul ignore next
        if (!fs.existsSync(options.privateKeyFile)) {
            throw new Error(" cannot locate private key file " + options.privateKeyFile);
        }

        super(options as IOPCUASecureObjectOptions);

        this._secureChannel = null;

        this.reconnectionIsCanceled = false;

        this.endpointUrl = "";

        this.clientName = options.clientName || "Session";

        // must be ZERO with Spec 1.0.2
        this.protocolVersion = 0;

        this._sessions = [];

        this._serverEndpoints = [];
        this._secureChannel = null;

        this.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 600000;
        this.tokenRenewalInterval = options.tokenRenewalInterval || 0;
        assert(_.isFinite(this.tokenRenewalInterval) && this.tokenRenewalInterval >= 0);
        /**
         * @property securityMode
         * @type MessageSecurityMode
         */
        this.securityMode = coerceMessageSecurityMode(options.securityMode);

        /**
         * @property securityPolicy
         * @type {SecurityPolicy}
         */
        this.securityPolicy = coerceSecurityPolicy(options.securityPolicy);

        /**
         * @property serverCertificate
         * @type {Certificate}
         */
        this.serverCertificate = options.serverCertificate;

        /**
         * true if session shall periodically probe the server to keep the session alive and prevent timeout
         * @property keepSessionAlive
         * @type {boolean}
         */
        this.keepSessionAlive = _.isBoolean(options.keepSessionAlive) ? options.keepSessionAlive : false;

        // statistics...
        this._byteRead = 0;
        this._byteWritten = 0;
        this._transactionsPerformed = 0;
        this._timedOutRequestCount = 0;

        this.connectionStrategy = coerceConnectionStrategy(
            options.connectionStrategy || defaultConnectionStrategy);

        /***
         * @property keepPendingSessionsOnDisconnect²
         * @type {boolean}
         */
        this.keepPendingSessionsOnDisconnect = options.keepPendingSessionsOnDisconnect || false;

        this.applicationName = options.applicationName || "NodeOPCUA-Client";

        this.discoveryUrl = options.discoveryUrl || "";
    }

    public _cancel_reconnection(callback: ErrorCallback) {

        assert(this.isReconnecting);

        // istanbul ignore next
        this.reconnectionIsCanceled = true;
        if (!this._secureChannel) {
            return callback(); // nothing to do
        }
        this._secureChannel.abortConnection((/*err?: Error*/) => {
            this._secureChannel = null;
            callback();
        });
        (this as any).once("reconnection_canceled", () => {
            /* empty */
        });
    }

    public _recreate_secure_channel(callback: ErrorCallback) {

        debugLog("_recreate_secure_channel...");

        if (!this.knowsServerEndpoint) {
            debugLog("Cannot reconnect , server endpoint is unknown");
            return callback(new Error("Cannot reconnect, server endpoint is unknown"));
        }
        assert(this.knowsServerEndpoint);
        assert(!this.isReconnecting);
        /**
         * notifies the observer that the OPCUA is now trying to reestablish the connection
         * after having received a connection break...
         * @event start_reconnection
         *
         */
        this.emit("start_reconnection"); // send after callback

        this._destroy_secure_channel();
        assert(!this._secureChannel);

        const infiniteConnectionRetry: ConnectionStrategyOptions = {
            initialDelay: this.connectionStrategy.initialDelay,
            maxDelay: this.connectionStrategy.maxDelay,
            maxRetry: -1
        };

        const failAndRetry = (err: Error, message: string) => {

            errorLog("client = ", this.clientName, message, err.message);

            if (this.reconnectionIsCanceled) {
                this.emit("reconnection_canceled");
                return callback(new Error("Reconnection has been canceled - " + this.clientName));
            }
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
                    if (err.message.match("ECONNREFUSED")) {
                        return callback(err);
                    }
                    if (err.message.match("Backoff aborted.")) {
                        return failAndRetry(err!, "cannot create secure channel");
                    }
                    if (true || err!.message.match("BadCertificateInvalid")) {
                        errorLog(" _internal_create_secure_channel err = ", err.message);
                        // the server may have shut down the channel because its certificate
                        // has changed ....
                        // let request the server certificate again ....
                        debugLog(chalk.bgWhite.red("ClientBaseImpl: Server Certificate has changed." +
                            " we need to retrieve server certificate again"));

                        return this.fetchServerCertificate(this.endpointUrl, (err1?: Error | null) => {
                            if (err1) {
                                return failAndRetry(err1, "trying to fetch new server certificate");
                            }
                            this._internal_create_secure_channel(infiniteConnectionRetry, (err3?: Error | null) => {
                                if (err3) {
                                    return failAndRetry(err3, "trying to create new channel with new certificate");
                                }
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

        let secureChannel: ClientSecureChannelLayer;

        assert(this._secureChannel === null);
        assert(_.isString(this.endpointUrl));

        async.series([

            // ------------------------------------------------- STEP 2 : OpenSecureChannel
            (_innerCallback: ErrorCallback) => {

                secureChannel = new ClientSecureChannelLayer({
                    connectionStrategy,
                    defaultSecureTokenLifetime: this.defaultSecureTokenLifetime,
                    parent: this,
                    securityMode: this.securityMode,
                    securityPolicy: this.securityPolicy,
                    serverCertificate: this.serverCertificate,
                    tokenRenewalInterval: this.tokenRenewalInterval
                });

                this._secureChannel = secureChannel;

                secureChannel.protocolVersion = this.protocolVersion;

                secureChannel.create(this.endpointUrl, (err?: Error) => {
                    if (err) {
                        debugLog(chalk.yellow("Cannot create secureChannel"),
                            (err.message ? chalk.cyan(err.message) : ""));
                        this._destroy_secure_channel();
                    } else {
                        if (!this._secureChannel) {
                            debugLog("_secureChannel has been closed during the transaction !");
                            this._destroy_secure_channel();
                            return _innerCallback(new Error("Secure Channel Closed"));
                        }
                        assert(this._secureChannel !== null);
                        this._install_secure_channel_event_handlers(secureChannel);
                    }
                    assert(err || this._secureChannel !== null);
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

                if (!this.knowsServerEndpoint) {
                    assert(this._secureChannel !== null);
                    this.getEndpoints((err: Error | null/*, endpoints?: EndpointDescription[]*/) => {
                        // Xx endpoints;
                        assert(this._secureChannel !== null);
                        innerCallback(err ? err : undefined);
                    });
                } else {
                    // end points are already known
                    assert(this._secureChannel !== null);
                    innerCallback();
                }
            }

        ], (err) => {

            if (err) {
                this._secureChannel = null;
                callback(err);
            } else {
                assert(this._secureChannel !== null);
                callback(null, secureChannel);
            }
        });

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
        assert(_.isFunction(callback), "expecting a callback");

        this.endpointUrl = endpointUrl;

        debugLog("ClientBaseImpl#connect ", endpointUrl);

        // prevent illegal call to connect
        if (this._secureChannel !== null) {
            setImmediate(() => {
                callback(new Error("connect already called"));
            });
            return;
        }

        if (!this.serverCertificate && this.securityMode !== MessageSecurityMode.None) {

            return this.fetchServerCertificate(endpointUrl, (err?: Error) => {
                if (err) {
                    return callback(err);
                }
                this.connect(endpointUrl, callback);
            });
        }

        // todo: make sure endpointUrl exists in the list of endpoints send by the server
        // [...]

        // make sure callback will only be call once regardless of outcome, and will be also deferred.
        const callbackOnceDelayed: any = once((err?: Error) => setImmediate(() => callback(err)));

        installPeriodicClockAdjustmement();
        OPCUAClientBase.registry.register(this);

        this._internal_create_secure_channel(this.connectionStrategy, (err: Error | null /* secureChannel?: ClientSecureChannelLayer*/) => {
            // xx secureChannel;
            if (!err) {
                this.emit("connected");
                callbackOnceDelayed(err!);
            } else {

                OPCUAClientBase.registry.unregister(this);
                uninstallPeriodicClockAdjustmement();

                debugLog(chalk.red("SecureChannel creation has failed with error :", err.message));
                if (err.message.match(/ECONNREF/)) {
                    debugLog(chalk.yellow("- The client cannot to :" + endpointUrl + ". Server is not reachable."));
                    err = new Error("The connection cannot be established with server " + endpointUrl + " .\n" +
                        "Please check that the server is up and running or your network configuration.\n" +
                        "Err = (" + err.message + ")");

                } else {
                    debugLog(chalk.yellow("  - The client certificate may not be trusted by the server"));
                    err = new Error("The connection has been rejected by server,\n" +
                        "Please check that client certificate is trusted by server.\n" +
                        "Err = (" + err.message + ")");
                }
                this.emit("connection_failed", err);
                callbackOnceDelayed(err!);
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
        return _.find(this._serverEndpoints, (endpoint) => {
            return endpoint.securityMode === securityMode &&
                endpoint.securityPolicyUri === securityPolicy;
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
        return _.find(this._serverEndpoints, (endpoint: EndpointDescription) => {
            return endpoint.endpointUrl === endpointUrl &&
                endpoint.securityMode === securityMode &&
                endpoint.securityPolicyUri === securityPolicy;
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
        assert(_.isFunction(callback));

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
            if (!response || !(response instanceof GetEndpointsResponse)) {
                return callback(new Error("Internal Error"));
            }
            if (response && response.endpoints) {
                this._serverEndpoints = response.endpoints;
            }
            callback(null, this._serverEndpoints);
        });
    }

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
            if (!response || !(response instanceof FindServersResponse)) {
                return callback(new Error("Internal Error"));
            }
            response.servers = response.servers || [];

            callback(null, response.servers);
        });
    }

    public findServersOnNetwork(options?: FindServersOnNetworkRequestLike): Promise<ServerOnNetwork[]>;
    public findServersOnNetwork(callback: ResponseCallback<ServerOnNetwork[]>): void;
    public findServersOnNetwork(
        options: FindServersOnNetworkRequestLike, callback: ResponseCallback<ServerOnNetwork[]>): void;
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
            assert(!_.contains(this._sessions, session));
            assert(session._client === this);
            session._client = null;
        }
        assert(!_.contains(this._sessions, session));
    }

    public disconnect(): Promise<void>;
    public disconnect(callback: ErrorCallback): void;
    public disconnect(...args: any[]): any {

        const callback = args[0];
        assert(_.isFunction(callback), "expecting a callback function here");
        debugLog("ClientBaseImpl#disconnect", this.endpointUrl);
        if (this.isReconnecting) {
            debugLog("ClientBaseImpl#disconnect called while reconnection is in progress");
            // let's abort the reconnection process
            return this._cancel_reconnection((err?: Error) => {

                debugLog("ClientBaseImpl#disconnect reconnection has been canceled");

                assert(!err, " why would this fail ?");
                assert(!this.isReconnecting);
                // sessions cannot be cancelled properly and must be discarded.
                this.disconnect(callback);
            });
        }

        if (this._sessions.length && !this.keepPendingSessionsOnDisconnect) {
            debugLog("warning : disconnection : closing pending sessions");
            // disconnect has been called whereas living session exists
            // we need to close them first ....
            this._close_pending_sessions((/*err*/) => {
                this.disconnect(callback);
            });
            return;
        }

        if (this._sessions.length) {
            // transfer active session to  orphan and detach them from channel
            _.forEach(this._sessions, (session: ClientSessionImpl) => {
                this._removeSession(session);
            });
            this._sessions = [];
        }
        assert(this._sessions.length === 0, " attempt to disconnect a client with live sessions ");

        OPCUAClientBase.registry.unregister(this);
        uninstallPeriodicClockAdjustmement();

        if (this._secureChannel) {

            let tmpChannel: any = this._secureChannel;
            this._secureChannel = null;

            tmpChannel.close(() => {
                this._secureChannel = tmpChannel;
                tmpChannel = null;
                this._destroy_secure_channel();
                setImmediate(callback);
            });
        } else {
            this.emit("close", null);
            setImmediate(callback);
        }
    }

    // override me !
    public _on_connection_reestablished(callback: ErrorCallback) {
        callback();
    }

    public toString(): string {

        let str = "";
        str += "  defaultSecureTokenLifetime.... " + this.defaultSecureTokenLifetime + "\n";
        str += "  securityMode.................. " + this.securityMode.toString() + "\n";
        str += "  securityPolicy................ " + this.securityPolicy.toString() + "\n";
        str += "  certificate fingerprint....... " + makeSHA1Thumbprint(this.getCertificate()).toString("hex") + "\n";
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
        if (this._secureChannel) {
            str += "secureChannel:\n" + this._secureChannel.toString();
        }
        return str;
    }

    protected _addSession(session: ClientSessionImpl) {
        assert(!session._client || session._client === this);
        assert(!_.contains(this._sessions, session), "session already added");
        session._client = this;
        this._sessions.push(session);

        if (this.keepSessionAlive) {
            session.startKeepAliveManager();
        }
    }

    private fetchServerCertificate(endpointUrl: string, callback: (err?: Error) => void): void {

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
        const certificateFile = this.certificateFile || "certificates/client_selfsigned_cert_2048.pem";
        const privateKeyFile = this.privateKeyFile || "certificates/client_key_2048.pem";
        const applicationName = (this as any).applicationName || "NodeOPCUA-Client";

        const params = {
            connectionStrategy: this.connectionStrategy,
            endpoint_must_exist: false,
            securityMode: this.securityMode,
            securityPolicy: this.securityPolicy,

            applicationName,
            certificateFile,
            privateKeyFile
        };
        return __findEndpoint(this, discoveryUrl, params, (err: Error | null, result?: FindEndpointResult) => {
            if (err) {
                this.emit("connection_failed", err);
                return callback(err);
            }

            if (!result) {
                const err1 = new Error("internal error");
                this.emit("connection_failed", err1);
                return callback(err1);
            }

            const endpoint = result.selectedEndpoint;
            if (!endpoint) {
                // no matching end point can be found ...
                const err1 = new Error("cannot find endpoint");
                this.emit("connection_failed", err1);
                return callback(err1);
            }

            assert(endpoint);

            _verify_serverCertificate(endpoint.serverCertificate, (err1?: Error) => {
                if (err1) {
                    this.emit("connection_failed", err1);
                    return callback(err1);
                }
                this.serverCertificate = endpoint.serverCertificate;
                callback();
            });
        });

    }
    private _acculumate_statistics() {
        if (this._secureChannel) {
            // keep accumulated statistics
            this._byteWritten += this._secureChannel.bytesWritten;
            this._byteRead += this._secureChannel.bytesRead;
            this._transactionsPerformed += this._secureChannel.transactionsPerformed;
            this._timedOutRequestCount += this._secureChannel.timedOutRequestCount;
            if (doDebug) {
                debugLog("byteWritten  = ", this._byteWritten);
                debugLog("byteRead     = ", this._byteRead);
                debugLog("transactions = ", this._transactionsPerformed);
            }

        }
    }
    private _destroy_secure_channel() {

        if (this._secureChannel) {

            if (doDebug) {
                debugLog(" DESTROYING SECURE CHANNEL (isTransactionInProgress ?", this._secureChannel.isTransactionInProgress(), ")");
            }

            this._acculumate_statistics();

            this._secureChannel.dispose();
            this._secureChannel.removeAllListeners();
            this._secureChannel = null;

        }
    }

    private _close_pending_sessions(callback: ErrorCallback) {

        assert(_.isFunction(callback));
        const sessions = _.clone(this._sessions);
        async.map(sessions, (session: ClientSessionImpl, next: () => void) => {
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

        }, (err) => {

            // istanbul ignore next
            if (this._sessions.length > 0) {
                debugLog(this._sessions.map((s: ClientSessionImpl) =>
                    s.authenticationToken ? s.authenticationToken.toString() : "").join(" "));
            }
            assert(this._sessions.length === 0, " failed to disconnect exiting sessions ");
            callback(err!);
        });

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
            debugLog("SecureChannel Security Token ", token.tokenId, "live time was =", token.revisedLifetime,
                " is about to expired , it's time to request a new token");
            // forward message to upper level
            this.emit("lifetime_75", token, secureChannel);
        });

        secureChannel.on("security_token_renewed", () => {
            // forward message to upper level
            this.emit("security_token_renewed", secureChannel);
        });

        secureChannel.on("close", (err?: Error) => {

            debugLog(chalk.yellow.bold(" ClientBaseImpl emitting close"), err);

            if (!err || !this.reconnectOnFailure) {

                // this is a normal close operation initiated byu

                /**
                 * @event close
                 * @param error
                 */
                this.emit("close", err);

                setImmediate(() => {
                    this._destroy_secure_channel();
                });
                return;

            } else {

                this.emit("connection_lost");

                setImmediate(() => {

                    debugLog("recreating new secure channel ");

                    this._recreate_secure_channel((err1?: Error) => {

                        debugLog("secureChannel#on(close) => _recreate_secure_channel returns ",
                            err1 ? err1.message : "OK");

                        if (err1) {
                            // xx assert(!this._secureChannel);
                            debugLog("_recreate_secure_channel has failed");
                            // xx this.emit("close", err1);
                            return;
                        } else {
                            /**
                             * @event connection_reestablished
                             *        send when the connection is reestablished after a connection break
                             */
                            this.emit("connection_reestablished");

                            // now delegate to upper class the
                            if (this._on_connection_reestablished) {
                                assert(_.isFunction(this._on_connection_reestablished));
                                this._on_connection_reestablished((err2?: Error) => {

                                    if (err2) {
                                        debugLog("connection_reestablished has failed");
                                        this.disconnect(() => {
                                            //  callback(err);
                                        });
                                    }
                                });
                            }
                        }
                    });
                });
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
