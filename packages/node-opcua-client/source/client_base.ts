/**
 * @module bode-opcua-client
 */
// tslint:disable:no-unused-expression
import * as async from "async";
import chalk from "chalk";
import { EventEmitter } from "events";
import * as  fs from "fs";
import * as  path from "path";
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { LocaleId } from "node-opcua-basic-types";
import { IOPCUASecureObjectOptions, OPCUASecureObject } from "node-opcua-common";
import { Certificate, makeSHA1Thumbprint, Nonce, toPem } from "node-opcua-crypto";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { ObjectRegistry } from "node-opcua-object-registry";
import {
    ClientSecureChannelLayer,
    coerceConnectionStrategy,
    coerceSecurityPolicy,

    ConnectionStrategy,
    ConnectionStrategyOptions,
    ErrorCallback,

    SecurityPolicy,
    SecurityToken,
} from "node-opcua-secure-channel";
import {
    FindServersOnNetworkRequest, FindServersOnNetworkRequestOptions,
    FindServersOnNetworkResponse, FindServersRequest,
    FindServersRequestOptions, FindServersResponse, ServerOnNetwork,
} from "node-opcua-service-discovery";
import {
    ApplicationDescription, EndpointDescription,
    GetEndpointsRequest, GetEndpointsResponse
} from "node-opcua-service-endpoints";
import {
    coerceMessageSecurityMode, MessageSecurityMode
} from "node-opcua-service-secure-channel";

import { ClientSession, ClientSessionImpl, ResponseCallback } from "./client_session";
import { Request, Response } from "./common";

import * as once from "once";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

const warningLog = debugLog;

export type FindServersRequestLike = FindServersRequest | FindServersRequestOptions;
export type FindServersOnNetworkRequestLike = FindServersOnNetworkRequest | FindServersOnNetworkRequestOptions;

const defaultConnectionStrategy: ConnectionStrategyOptions = {
    initialDelay: 1000,
    maxDelay: 20 * 1000, // 20 seconds
    maxRetry: 10000000, // almost infinite
    randomisationFactor: 0.1
};

export type GetEndpointCallbackFunc = ResponseCallback<EndpointDescription[]>;
export type CreateSecureChannelCallbackFunc = (err: Error | null, secureChannel?: ClientSecureChannelLayer) => void;

// xx OPCUAClientBase.prototype.getPrivateKey = OPCUASecureObject.prototype.getPrivateKey;
// xx OPCUAClientBase.prototype.getCertificate = OPCUASecureObject.prototype.getCertificate;
// xx OPCUAClientBase.prototype.getCertificateChain = OPCUASecureObject.prototype.getCertificateChain;

interface FindEndpointOptions {
    securityMode: MessageSecurityMode;
    securityPolicy: SecurityPolicy;
    connectionStrategy: ConnectionStrategyOptions;
}

interface FindEndpointResult {
    selectedEndpoint: EndpointDescription;
    endpoints: EndpointDescription[];
}

type FindEndpointCallback = (err: Error | null, result?: FindEndpointResult) => void;

function __findEndpoint(endpointUrl: string, params: FindEndpointOptions, callback: FindEndpointCallback) {

    const securityMode = params.securityMode;
    const securityPolicy = params.securityPolicy;

    const options = {
        connectionStrategy: params.connectionStrategy,
        endpoint_must_exist: false
    };

    const client = new OPCUAClientBase(options);

    let selectedEndpoints: any = null;
    const allEndpoints: any = null;
    const tasks = [

        (innerCallback: ErrorCallback) => {
            client.on("backoff", () => {
                debugLog("finding Endpoint => reconnecting ");
            });
            client.connect(endpointUrl, (err?: Error) => {
                if (err) {
                    debugLog("Fail to connect to server ", endpointUrl, " to collect certificate server");
                }
                return innerCallback(err);
            });
        },

        (innerCallback: ErrorCallback) => {

            client.getEndpoints((err: Error | null, endpoints?: EndpointDescription[]) => {

                if (err) {
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

    async.series(tasks, (err?: Error) => {

        if (err) {
            return callback(err);
        }

        if (!selectedEndpoints) {
            callback(new Error(" Cannot find an Endpoint matching " +
                " security mode: " + securityMode.toString() +
                " policy: " + securityPolicy.toString()));
        }

        const result = {
            endpoints: allEndpoints,
            selectedEndpoint: selectedEndpoints,
        };
        callback(null, result);
    });
}

/**
 * check if certificate is trusted or untrusted
 */
function _verify_serverCertificate(serverCertificate: Buffer, callback: ErrorCallback) {

    const pkiFolder = process.cwd() + "/pki";

    // istanbul ignore next
    if (!fs.existsSync(pkiFolder)) {
        fs.mkdirSync(pkiFolder);
    }
    const pkiUntrustedFolder = path.join(pkiFolder, "untrusted");

    // istanbul ignore next
    if (!fs.existsSync(pkiUntrustedFolder)) {
        fs.mkdirSync(pkiUntrustedFolder);
    }
    const thumbprint = makeSHA1Thumbprint(serverCertificate);

    const certificateFilename = path.join(pkiUntrustedFolder, thumbprint.toString("hex") + ".pem");
    fs.writeFile(certificateFilename, toPem(serverCertificate, "CERTIFICATE"), () => {
        setImmediate(callback);
    });
}

export interface OPCUAClientBaseOptions {

    connectionStrategy?: ConnectionStrategyOptions;

    /**
     * if not specify or set to 0 , token  renewal will happen
     * around 75% of the defaultSecureTokenLifetime
     */
    tokenRenewalInterval?: number;

    /**
     * if set to true, pending session will not be automatically closed when disconnect is called
     */
    keepPendingSessionsOnDisconnect?: boolean;

    /**
     * the server certificate.
     */
    serverCertificate?: Certificate;

    /**
     * default secure token lifetime in ms
     */
    defaultSecureTokenLifetime?: number;

    /**
     * the security mode
     * @default MessageSecurityMode.None
     */
    securityMode?: MessageSecurityMode | string;

    /**
     * the security policy
     * @default SecurityPolicy.None
     */

    securityPolicy?: SecurityPolicy | string;

    /**
     * can be set when the client doesn't create subscription. In this case,
     * the client will send a dummy request on a regular basis to keep the
     * connection active.
     * @default false
     */
    keepSessionAlive?: boolean;

    /**
     * client certificate pem file.
     * @default "certificates/client_selfsigned_cert_1024.pem"
     */
    certificateFile?: string;
    /**
     * client private key pem file.
     * @default "certificates/client_key_1024.pem"
     */
    privateKeyFile?: string;
    /**
     * a client name string that will be used to generate session names.
     */
    clientName?: string;
}

export interface GetEndpointsOptions {
    endpointUrl?: string;
    localeIds?: LocaleId[];
    profileUris?: string[];
}

export interface OPCUAClientBasePublic {

    /***
     *
     * @param endpointUrl the endpoint of the server to connect to ( i.e "opc.tcp://machine.name:3434/name" )
     */
    connect(endpointUrl: string): Promise<void>;

    connect(endpointUrl: string, callback: ErrorCallback): void;

    /***
     * cause client to close and disconnect the communication with server
     */
    disconnect(): Promise<void>;

    disconnect(callback: ErrorCallback): void;

    findEndpointForSecurity(
        securityMode: MessageSecurityMode, securityPolicy: SecurityPolicy): EndpointDescription | undefined;

    getEndpoints(options?: GetEndpointsOptions): Promise<EndpointDescription[]>;

    getEndpoints(options: GetEndpointsOptions, callback: ResponseCallback<EndpointDescription[]>): void;

    getEndpoints(callback: GetEndpointCallbackFunc): void;

    findServers(options?: FindServersRequestLike): Promise<ApplicationDescription[]>;

    findServers(options: FindServersRequestLike, callback: ResponseCallback<ApplicationDescription[]>): void;

    findServers(callback: ResponseCallback<ApplicationDescription[]>): void;

    findServersOnNetwork(options?: FindServersOnNetworkRequestLike): Promise<ServerOnNetwork[]>;

    findServersOnNetwork(callback: ResponseCallback<ServerOnNetwork[]>): void;

    findServersOnNetwork(options: FindServersOnNetworkRequestLike, callback: ResponseCallback<ServerOnNetwork[]>): void;

}

/**
 */
export class OPCUAClientBase extends OPCUASecureObject implements OPCUAClientBasePublic {

    public static registry = new ObjectRegistry(OPCUAClientBase);
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
    /// true if session shall periodically probe the server to keep the session alive and prevent timeout
    public keepSessionAlive: boolean;
    public _sessions: any;
    protected _serverEndpoints: EndpointDescription[];
    protected _secureChannel: any;
    // statistics...
    private _byteRead: number;
    private _byteWritten: number;
    private _transactionsPerformed: number;
    private _timedOutRequestCount: number;

    constructor(options?: OPCUAClientBaseOptions) {

        options = options || {};

        if (!options.certificateFile) {
            options.certificateFile = path.join(__dirname, "../certificates/client_selfsigned_cert_1024.pem");
        }
        if (!options.privateKeyFile) {
            options.privateKeyFile = path.join(__dirname, "../certificates/PKI/own/private/private_key.pem");
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

        this.connectionStrategy = coerceConnectionStrategy(options.connectionStrategy || defaultConnectionStrategy);

        /***
         * @property keepPendingSessionsOnDisconnect²
         * @type {boolean}
         */
        this.keepPendingSessionsOnDisconnect = options.keepPendingSessionsOnDisconnect || false;
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
     *
     */
    public get timedOutRequestCount() {
        return this._timedOutRequestCount + (this._secureChannel ? this._secureChannel.timedOutRequestCount : 0);
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

    public _cancel_reconnection(callback: ErrorCallback) {

        // istanbul ignore next
        if (!this._secureChannel) {
            return callback(); // nothing to do
        }
        this._secureChannel.abortConnection((err?: Error) => {
            err;
            this._secureChannel = null;
            callback();
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

        // create a secure channel
        // a new secure channel must be established
        setImmediate(() => {

            this._destroy_secure_channel();

            assert(!this._secureChannel);

            this._internal_create_secure_channel((err: Error | null) => {

                if (err) {
                    debugLog(chalk.bgWhite.red("OPCUAClientBase: cannot reconnect .."));
                    callback(err);
                } else {
                    assert(this._secureChannel, "expecting a secureChannel here ");
                    // a new channel has be created and a new connection is established
                    debugLog(chalk.bgWhite.red("OPCUAClientBase:  RECONNECTED                !!!"));
                    callback();
                }

                /**
                 * notify the observers that the reconnection process has been completed
                 * @event after_reconnection
                 * @param err
                 */
                this.emit("after_reconnection", err); // send after callback

            });
        });
    }

    public _internal_create_secure_channel(callback: CreateSecureChannelCallbackFunc) {

        let secureChannel: ClientSecureChannelLayer;

        assert(this._secureChannel === null);
        assert(_.isString(this.endpointUrl));

        async.series([

            // ------------------------------------------------- STEP 2 : OpenSecureChannel
            (_innerCallback: ErrorCallback) => {

                secureChannel = new ClientSecureChannelLayer({
                    connectionStrategy: this.connectionStrategy,
                    defaultSecureTokenLifetime: this.defaultSecureTokenLifetime,
                    parent: this,
                    securityMode: this.securityMode,
                    securityPolicy: this.securityPolicy,
                    serverCertificate: this.serverCertificate,
                    tokenRenewalInterval: this.tokenRenewalInterval,
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
                    this.getEndpoints((err: Error | null, endpoints?: EndpointDescription[]) => {
                        endpoints;
                        assert(this._secureChannel !== null);
                        innerCallback(err ? err : undefined);
                    });
                } else {
                    // end points are already known
                    assert(this._secureChannel !== null);
                    innerCallback();
                }
            }

        ], (err?: Error) => {

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

        debugLog("OPCUAClientBase#connect ", endpointUrl);

        // prevent illegal call to connect
        if (this._secureChannel !== null) {
            setImmediate(() => {
                callback(new Error("connect already called"));
            });
            return;
        }

        if (!this.serverCertificate && this.securityMode !== MessageSecurityMode.None) {

            debugLog("OPCUAClient : getting serverCertificate");
            // we have not been given the serverCertificate but this certificate
            // is required as the connection is to be secured.
            //
            // Let's explore the server endpoint that matches our security settings
            // This will give us the missing Certificate as well from the server itthis.
            // todo :
            // Once we have the certificate, we cannot trust it straight away
            // we have to verify that the certificate is valid and not outdated and not revoked.
            // if the certificate is this-signed the certificate must appear in the trust certificate
            // list.
            // if the certificate has been certified by an Certificate Authority we have to
            // verify that the certificates in the chain are valid and not revoked.
            //
            const params = {
                connectionStrategy: this.connectionStrategy,
                endpoint_must_exist: false,
                securityMode: this.securityMode,
                securityPolicy: this.securityPolicy,
            };
            return __findEndpoint(endpointUrl, params, (err: Error | null, result?: FindEndpointResult) => {
                if (err) {
                    return callback(err);
                }

                if (!result) {
                    return callback(new Error("internal error"));
                }

                const endpoint = result.selectedEndpoint;
                if (!endpoint) {
                    // no matching end point can be found ...
                    return callback(new Error("cannot find endpoint"));
                }

                assert(endpoint);

                _verify_serverCertificate(endpoint.serverCertificate, (err1?: Error) => {
                    if (err1) {
                        return callback(err1);
                    }
                    this.serverCertificate = endpoint.serverCertificate;
                    return this.connect(endpointUrl, callback);
                });
            });
        }

        // todo: make sure endpointUrl exists in the list of endpoints send by the server
        // [...]

        // make sure callback will only be call once regardless of outcome, and will be also deferred.
        const callbackOnceDelayed: any = once((err?: Error) => setImmediate(() => callback(err)));

        OPCUAClientBase.registry.register(this);

        this._internal_create_secure_channel((err: Error | null, secureChannel?: ClientSecureChannelLayer) => {
            secureChannel;
            callbackOnceDelayed(err!);
        });

    }

    public getClientNonce(): Nonce {
        return this._secureChannel.clientNonce;
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
        this._secureChannel.performMessageTransaction(request, callback);
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
    public getEndpoints(options: GetEndpointsOptions, callback: GetEndpointCallbackFunc): void;
    public getEndpoints(callback: GetEndpointCallbackFunc): void;
    public getEndpoints(...args: any[]): any {
        if (args.length === 1) {
            return this.getEndpoints({}, args[0]);
        }
        const options = args[0];
        const callback = args[1];
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
        warningLog("note: OPCUAClientBase#getEndpointsRequest is deprecated, use OPCUAClientBase#getEndpoints instead");
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

    /**
     * disconnect client from server
     * @method disconnect
     * @async
     * @param callback [Function}
     */
    public disconnect(): Promise<void>;
    public disconnect(callback: ErrorCallback): void;
    public disconnect(...args: any[]): any {

        const callback = args[0];

        assert(_.isFunction(callback), "expecting a callback function here");

        debugLog("OPCUAClientBase#disconnect", this.endpointUrl);

        if (this.isReconnecting) {
            debugLog("OPCUAClientBase#disconnect called while reconnection is in progress");
            // let's abort the reconnection process
            return this._cancel_reconnection((err?: Error) => {
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

        if (this._secureChannel) {

            const tmpChannel = this._secureChannel;

            this._destroy_secure_channel();

            tmpChannel.close(() => {

                debugLog(" EMIT NORMAL CLOSE");
                /**
                 * @event close
                 */
                this.emit("close", null);
                setImmediate(callback);
            });
        } else {
            this.emit("close", null);
            callback();
        }
    }

// override me !
    public _on_connection_reestablished(callback: ErrorCallback) {
        callback();
    }

    public toString() {

        let str = "";
        str += "  defaultSecureTokenLifetime.... " + this.defaultSecureTokenLifetime;
        str += "  securityMode.................. " + this.securityMode.toString();
        str += "  securityPolicy................ " + this.securityPolicy.toString();
        // this.serverCertificate = options.serverCertificate || null;
        str += "  keepSessionAlive.............. " + this.keepSessionAlive;
        str += "  bytesRead..................... " + this.bytesRead;
        str += "  bytesWritten.................. " + this.bytesWritten;
        str += "  transactionsPerformed......... " + this.transactionsPerformed;
        str += "  timedOutRequestCount.......... " + this.timedOutRequestCount;
        str += "  connectionStrategy.";
        str += "        .maxRetry............... " + this.connectionStrategy.maxRetry;
        str += "        .initialDelay........... " + this.connectionStrategy.initialDelay;
        str += "        .maxDelay............... " + this.connectionStrategy.maxDelay;
        str += "        .randomisationFactor.... " + this.connectionStrategy.randomisationFactor;
        str += "  keepSessionAlive.............. " + this.keepSessionAlive;
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

    private _destroy_secure_channel() {

        if (this._secureChannel) {

            if (doDebug) {
                debugLog(" DESTROYING SECURE CHANNEL ", this._secureChannel.isTransactionInProgress());
            }
            // keep accumulated statistics
            this._byteWritten += this._secureChannel.bytesWritten;
            this._byteRead += this._secureChannel.bytesRead;
            this._transactionsPerformed += this._secureChannel.transactionsPerformed;
            this._timedOutRequestCount += this._secureChannel.timedOutRequestCount;

            this._secureChannel.dispose();

            this._secureChannel.removeAllListeners();
            this._secureChannel = null;

            if (doDebug) {
                debugLog("byteWritten  = ", this._byteWritten);
                debugLog("byteRead     = ", this._byteRead);
            }
        }
    }

    private _close_pending_sessions(callback: ErrorCallback) {

        assert(_.isFunction(callback));
        const sessions = _.clone(this._sessions);
        async.map(sessions, (session: ClientSessionImpl, next: () => void) => {
            assert(session._client === this);
            session.close((err?: Error) => {
                // We should not bother if we have an error here
                // Session may fail to close , if they haven't been activate and forcefully closed by server
                // in a attempt to preserve resources in the case of a DDOS attack for instance.
                if (err) {
                    const msg = session.authenticationToken ? session.authenticationToken.toString() : "";
                    debugLog(" failing to close session " + msg);
                }
                next();
            });

        }, (err?: Error) => {

            // istanbul ignore next
            if (this._sessions.length > 0) {
                debugLog(this._sessions.map((s: ClientSessionImpl) =>
                    s.authenticationToken ? s.authenticationToken.toString() : "").join(" "));
            }

            assert(this._sessions.length === 0, " failed to disconnect exiting sessions ");
            callback(err);
        });

    }

    private _install_secure_channel_event_handlers(secureChannel: ClientSecureChannelLayer) {

        assert(this instanceof OPCUAClientBase);

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
            debugLog("SecureChannel Security Token ", token.tokenId,
                " is about to expired , it's time to request a new token");
            // forward message to upper level
            this.emit("lifetime_75", token);
        });

        secureChannel.on("security_token_renewed", () => {
            // forward message to upper level
            this.emit("security_token_renewed");
        });

        secureChannel.on("close", (err?: Error) => {

            debugLog(chalk.yellow.bold(" OPCUAClientBase emitting close"), err);

            if (!err || !this.reconnectOnFailure) {

                // this is a normal close operation initiated byu

                /**
                 * @event close
                 * @param error {Error}
                 */
                this.emit("close", err);

                setImmediate(() => {
                    this._destroy_secure_channel();
                });
                return;

            } else {

                setImmediate(() => {

                    debugLog("recreating new secure channel ");

                    this._recreate_secure_channel((err1?: Error) => {

                        debugLog("secureChannel#on(close) => _recreate_secure_channel returns ",
                            err1 ? err1.message : "OK");

                        if (err1) {
                            // xx assert(!this._secureChannel);
                            this.emit("close", err1);
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
const opts = {multiArgs: false};
OPCUAClientBase.prototype.connect = thenify.withCallback(OPCUAClientBase.prototype.connect);
OPCUAClientBase.prototype.disconnect = thenify.withCallback(OPCUAClientBase.prototype.disconnect);
OPCUAClientBase.prototype.getEndpoints = thenify.withCallback(OPCUAClientBase.prototype.getEndpoints);
OPCUAClientBase.prototype.findServers = thenify.withCallback(OPCUAClientBase.prototype.findServers);
OPCUAClientBase.prototype.findServersOnNetwork = thenify.withCallback(OPCUAClientBase.prototype.findServersOnNetwork);
