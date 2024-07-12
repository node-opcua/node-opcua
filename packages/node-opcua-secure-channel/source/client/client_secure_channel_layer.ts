/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
/**
 * @module node-opcua-secure-channel
 */
import { createPublicKey, randomBytes } from "crypto";
import { EventEmitter } from "events";
import { types } from "util";
import chalk from "chalk";
import async from "async";

import {
    Certificate,
    DerivedKeys,
    extractPublicKeyFromCertificate,
    PrivateKey,
    PublicKey,
    PublicKeyPEM,
    rsaLengthPrivateKey,
    rsaLengthPublicKey,
    split_der
} from "node-opcua-crypto";

import { assert } from "node-opcua-assert";

import { BinaryStream } from "node-opcua-binary-stream";
import { get_clock_tick, timestamp } from "node-opcua-utils";

import { readMessageHeader, verify_message_chunk } from "node-opcua-chunkmanager";
import { checkDebugFlag, hexDump, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import {
    ChannelSecurityToken,
    coerceMessageSecurityMode,
    MessageSecurityMode,
    SymmetricAlgorithmSecurityHeader
} from "node-opcua-service-secure-channel";

import { CallbackT, StatusCode, StatusCodes } from "node-opcua-status-code";
import { ClientTCP_transport, TransportSettingsOptions } from "node-opcua-transport";
import { ErrorCallback } from "node-opcua-status-code";
import { BaseUAObject } from "node-opcua-factory";
import { doTraceChunk } from "node-opcua-transport";
import { getPartialCertificateChain } from "node-opcua-common";

import { MessageBuilder } from "../message_builder";
import { ChunkMessageParameters, MessageChunker } from "../message_chunker";
import { messageHeaderToString } from "../message_header_to_string";

import {
    coerceSecurityPolicy,
    computeDerivedKeys,
    DerivedKeys1,
    getCryptoFactory,
    getOptionsForSymmetricSignAndEncrypt,
    SecureMessageData,
    SecurityPolicy,
    toURI
} from "../security_policy";
import {
    AsymmetricAlgorithmSecurityHeader,
    CloseSecureChannelRequest,
    OpenSecureChannelRequest,
    OpenSecureChannelResponse,
    SecurityTokenRequestType,
    ServiceFault
} from "../services";

const debugLog = make_debugLog("SecureChannel");
const errorLog = make_errorLog("SecureChannel");
const doDebug = checkDebugFlag("SecureChannel");
const warningLog = make_warningLog("SecureChannel");

const checkChunks = doDebug && false;
const doDebug1 = false;

// set checkTimeout to true to enable timeout trace checking
const checkTimeout = !!process.env.NODEOPCUACHECKTIMEOUT || false;

import { extractFirstCertificateInChain, getThumbprint, ICertificateKeyPairProvider, Request, Response } from "../common";
import {
    ClientTransactionStatistics,
    doPerfMonitoring,
    doTraceClientMessage,
    doTraceClientRequestContent,
    doTraceClientResponseContent,
    doTraceStatistics,
    dumpSecurityHeader,
    traceClientRequestMessage,
    traceClientResponseMessage,
    _dump_client_transaction_statistics,
    traceClientRequestContent,
    traceClientResponseContent,
    traceClientConnectionClosed
} from "../utils";
import { durationToString } from "./duration_to_string";
import { TokenStack } from "../token_stack";
import { SecurityHeader } from "../secure_message_chunk_manager";

// tslint:disable-next-line: no-var-requires
const backoff = require("backoff");

export const requestHandleNotSetValue = 0xdeadbeef;

type PerformTransactionCallback = CallbackT<Response>;

interface TransactionData {
    msgType: string;
    request: Request;
    callback: PerformTransactionCallback;
}

interface RequestData {
    msgType: string;
    request: Request;
    callback?: PerformTransactionCallback;

    response?: Response;

    beforeSendTick: number;
    afterSendTick: number;
    startReceivingTick: number;
    endReceivingTick: number;
    afterProcessingTick: number;
    bytesWritten_after: number;
    bytesWritten_before: number;
    bytesRead: number;
    key: string;
    chunk_count: number;
}

function process_request_callback(requestData: RequestData, err?: Error | null, response?: Response) {
    assert(typeof requestData.callback === "function");

    const request = requestData.request;

    if (!response && !err && requestData.msgType !== "CLO") {
        // this case happens when CLO is called and when some pending transactions
        // remains in the queue...
        err = new Error(" Connection has been closed by client , but this transaction cannot be honored");
    }

    if (response && response instanceof ServiceFault) {
        response.responseHeader.stringTable = [...(response.responseHeader.stringTable || [])];
        err = new Error(" serviceResult = " + response.responseHeader.serviceResult.toString());
        //  "  returned by server \n response:" + response.toString() + "\n  request: " + request.toString());
        (err as any).response = response;
        (err as any).request = request;
        response = undefined;
    }

    const theCallbackFunction = requestData.callback;
    /* istanbul ignore next */
    if (!theCallbackFunction) {
        throw new Error("Internal error");
    }
    assert(requestData.msgType === "CLO" || (err && !response) || (!err && response));

    // let set callback to undefined to prevent callback to be called again
    requestData.callback = undefined;

    theCallbackFunction(err || null, !err && response !== null ? response : undefined);
}

export interface ConnectionStrategyOptions {
    maxRetry?: number;
    initialDelay?: number;
    maxDelay?: number;
    randomisationFactor?: number;
}

export interface ConnectionStrategy {
    maxRetry: number;
    initialDelay: number;
    maxDelay: number;
    randomisationFactor: number;
}

export function coerceConnectionStrategy(options?: ConnectionStrategyOptions | null): ConnectionStrategy {
    options = options || {};

    const maxRetry: number = options.maxRetry === undefined ? 10 : options.maxRetry;
    const initialDelay = options.initialDelay || 10;
    const maxDelay = options.maxDelay || 10000;
    const randomisationFactor = options.randomisationFactor === undefined ? 0 : options.randomisationFactor;

    return {
        initialDelay,
        maxDelay,
        maxRetry,
        randomisationFactor
    };
}

export interface ClientSecureChannelParent extends ICertificateKeyPairProvider {
    applicationName?: string;
    clientName?: string;

    getCertificate(): Certificate;

    getCertificateChain(): Certificate;

    getPrivateKey(): PrivateKey;
}

/***
 * @param [options.factory] an factory that provides a method createObjectId(id) for the message builder
 */

export interface ClientSecureChannelLayerOptions {
    /**
     * default secure token life time , if not specified  30 seconds will be used as default value
     */
    defaultSecureTokenLifetime?: number;
    /**
     * defaultTransactionTimeout the default transaction timeout in unit of ms. Default value is 15 seconds.
     * If not specified, the default Transaction timeout will be taken from the global static variable ClientSecureChannelLayer.defaultTransactionTimeout
     */
    defaultTransactionTimeout?: number;
    /**
     * delay SecureTokenLifetime at which token renewal will be attempted.
     *
     * if 0 or not specify, the security token renewal will happen at 75% of defaultSecureTokenLifetime
     */
    tokenRenewalInterval?: number;
    /**
     *  message security mode
     *  default value =MessageSecurityMode.None
     */
    securityMode?: MessageSecurityMode;
    /**
     * security policy
     * default value = SecurityPolicy.None
     */
    securityPolicy?: SecurityPolicy;
    /**
     * the serverCertificate (required if securityMode!=None)
     */
    serverCertificate?: Certificate;

    parent?: ClientSecureChannelParent;

    /**
     *   the transport timeout in ms ( default = 60  seconds) sue for the Net.Socket timeout detection
     *   if 0 or not specify, the transport timeout will default  to ClientSecureChannelLayer.defaultTransportTimeout
     */
    transportTimeout?: number;
    /**
     * the connection strategy options
     * @param [options.connectionStrategy.maxRetry      = 10]
     * @param [options.connectionStrategy.initialDelay  = 10]
     * @param [options.connectionStrategy.maxDelay      = 10000]
     */
    connectionStrategy?: ConnectionStrategyOptions;

    transportSettings?: TransportSettingsOptions;
}

export interface ClientSecureChannelLayer extends EventEmitter {
    on(event: "end_transaction", eventHandler: (transactionStatistics: ClientTransactionStatistics) => void): this;
    on(event: "close", eventHandler: (err?: Error | null) => void): this;
    on(event: "lifetime_75", eventHandler: (securityToken: ChannelSecurityToken) => void): this;
    on(event: "receive_chunk", eventHandler: (chunk: Buffer) => void): this;
    on(event: "send_chunk", eventHandler: (chunk: Buffer) => void): this;
    on(event: "backoff", eventHandler: (retryCount: number, delay: number) => void): this;
    on(event: "security_token_created", eventHandler: (token: ChannelSecurityToken) => void): this;
    on(event: "security_token_renewed", eventHandler: (token: ChannelSecurityToken) => void): this;
    on(event: "send_request", eventHandler: (request: Request, msgType: string, securityHeader: SecurityHeader) => void): this;
    on(event: "receive_response", eventHandler: (response: Response) => void): this;
    on(event: "timed_out_request", eventHandler: (request: Request) => void): this;
    on(event: "abort", eventHandler: () => void): this;
    on(event: "beforePerformTransaction", eventHandler: (msgType: string, request: Request) => void): boolean;
    on(
        event: "message",
        eventHandler: (
            response: BaseUAObject,
            msgType: string,
            securityHeader: SecurityHeader,
            requestId: number,
            channelId: number
        ) => void
    ): this;
    emit(event: "end_transaction", transactionStatistics: ClientTransactionStatistics): boolean;
    /**
     * notify the observers that the transport connection has ended.
     * The error object is null or undefined if the disconnection was initiated by the ClientSecureChannelLayer.
     * A Error object is provided if the disconnection has been initiated by an external cause.
     *
     * @event close
     */
    emit(event: "close", err?: Error | null): boolean;
    /**
     * notify the observer that the secure channel has now reach 75% of its allowed live time and
     * that a new token is going to be requested.
     * @event  lifetime_75
     * @param  securityToken {Object} : the security token that is about to expire.
     *
     */
    emit(event: "lifetime_75", securityToken: ChannelSecurityToken): boolean;

    /**
     * notify the observers that ClientSecureChannelLayer has received a message chunk
     * @event receive_chunk
     */
    emit(event: "receive_chunk", chunk: Buffer): boolean;
    /**
     * notify the observer that a message chunk is about to be sent to the server
     * @event send_chunk
     */

    emit(event: "send_chunk", chunk: Buffer): boolean;

    emit(event: "backoff", retryCount: number, delay: number): boolean;
    /**
     * notify the observers that the security has been renewed
     * @event security_token_renewed
     */
    emit(event: "security_token_renewed", token: ChannelSecurityToken): boolean;
    emit(event: "security_token_created", token: ChannelSecurityToken): boolean;

    /**
     * notify the observer that a client request is being sent the server
     * @event send_request
     */
    emit(event: "send_request", request: Request, msgType: string, securityHeader: SecurityHeader): boolean;
    /**
     * notify the observers that a server response has been received on the channel
     * @event receive_response
     */
    emit(event: "receive_response", response: Response): boolean;
    /**
     * notify the observer that the response from the request has not been
     * received within the timeoutHint specified
     * @event timed_out_request
     */
    emit(event: "timed_out_request", request: Request): boolean;
    emit(event: "abort"): boolean;
    emit(event: "beforePerformTransaction", msgType: string, request: Request): boolean;

    /**
     * emitting when a message is received from the server
     */
    emit(
        event: "message",
        response: BaseUAObject,
        msgType: string,
        securityHeader: SecurityHeader,
        requestId: number,
        channelId: number
    ): boolean;
}
/**
 * a ClientSecureChannelLayer represents the client side of the OPCUA secure channel.
 */
export class ClientSecureChannelLayer extends EventEmitter {
    private static g_counter = 0;
    #_counter = ClientSecureChannelLayer.g_counter++;
    #_bytesRead = 0;
    #_bytesWritten = 0;
    #_timeDrift = 0;

    public static minTransactionTimeout = 5 * 1000; // 5 sec
    public static defaultTransactionTimeout = 15 * 1000; // 15 seconds
    public static defaultTransportTimeout = 60 * 1000; // 60 seconds

    public defaultTransactionTimeout: number;
    /**
     * true if the secure channel is trying to establish the connection with the server. In this case, the client
     * may be in the middle of the backoff connection process.
     *
     */
    public get isConnecting(): boolean {
        return !!this.__call;
    }

    get bytesRead(): number {
        return this.#_bytesRead + (this.#_transport ? this.#_transport.bytesRead : 0);
    }

    get bytesWritten(): number {
        return this.#_bytesWritten + (this.#_transport ? this.#_transport.bytesWritten : 0);
    }

    get transactionsPerformed(): number {
        return this.#_lastRequestId;
    }

    get timedOutRequestCount(): number {
        return this.#_timeout_request_count;
    }

    #requestedTransportSettings: TransportSettingsOptions;

    public protocolVersion: number;
    public readonly securityMode: MessageSecurityMode;
    public readonly securityPolicy: SecurityPolicy;
    public endpointUrl: string;
    public channelId: number;
    public activeSecurityToken: ChannelSecurityToken | null;

    #_lastRequestId: number;
    #_transport?: ClientTCP_transport;
    #_pending_transport?: ClientTCP_transport;
    readonly #parent?: ClientSecureChannelParent;

    readonly #messageChunker: MessageChunker;
    readonly #requestedLifetime: number;
    readonly #tokenRenewalInterval: number;
    #messageBuilder?: MessageBuilder;

    #_requests: { [key: string]: RequestData };

    #__in_normal_close_operation: boolean;
    #_timeout_request_count: number;
    #_securityTokenTimeoutId: NodeJS.Timeout | null;
    readonly #transportTimeout: number;
    readonly #connectionStrategy: any;
    last_transaction_stats: any | ClientTransactionStatistics;
    readonly #serverCertificate: Certificate | null; // the receiverCertificate => Receiver is Server
    #receiverPublicKey: PublicKey | null;

    private __call: any;
    #_isOpened: boolean;
    #lastError?: Error;
    #startReceivingTick = 0;
    #_isDisconnecting = false;

    #tokenStack: TokenStack;
    constructor(options: ClientSecureChannelLayerOptions) {
        super();

        this.defaultTransactionTimeout = options.defaultTransactionTimeout || ClientSecureChannelLayer.defaultTransactionTimeout;

        this.activeSecurityToken = null;

        this.#receiverPublicKey = null;

        this.endpointUrl = "";

        if ((global as any).hasResourceLeakDetector && !(global as any).ResourceLeakDetectorStarted) {
            throw new Error("ClientSecureChannelLayer not in ResourceLeakDetectorStarted");
        }

        assert(this instanceof ClientSecureChannelLayer);

        this.#_isOpened = false;
        this.#_transport = undefined;
        this.#_lastRequestId = 0;
        this.#parent = options.parent;

        this.protocolVersion = 0;
        this.#tokenStack = new TokenStack(1);

        this.#requestedLifetime = options.defaultSecureTokenLifetime || 30000;
        this.#tokenRenewalInterval = options.tokenRenewalInterval || 0;

        this.securityMode = coerceMessageSecurityMode(options.securityMode);
        this.securityPolicy = coerceSecurityPolicy(options.securityPolicy);
        this.#serverCertificate = extractFirstCertificateInChain(options.serverCertificate);

        assert(this.securityMode == MessageSecurityMode.None || this.#serverCertificate);

        // use to send Request => we use client keys
        this.#messageChunker = new MessageChunker({
            securityMode: this.securityMode
            // note maxMessageSize cannot be set at this stage, transport is not known
        });
        this.#_requests = {};
        this.#__in_normal_close_operation = false;
        this.#_timeout_request_count = 0;
        this.#_securityTokenTimeoutId = null;
        this.#transportTimeout = options.transportTimeout || ClientSecureChannelLayer.defaultTransportTimeout;
        this.#requestedTransportSettings = options.transportSettings || {};
        this.#connectionStrategy = coerceConnectionStrategy(options.connectionStrategy);
        this.channelId = 0;
    }

    public getTransportSettings(): { maxMessageSize: number } {
        const { maxMessageSize } = this.#_transport ? this.#_transport.getTransportSettings() : { maxMessageSize: 2048 };
        return { maxMessageSize: maxMessageSize || 0 };
    }

    public getPrivateKey(): PrivateKey | null {
        return this.#parent ? this.#parent.getPrivateKey() : null;
    }

    public getCertificateChain(): Certificate | null {
        return this.#parent ? this.#parent.getCertificateChain() : null;
    }

    public getCertificate(): Certificate | null {
        return this.#parent ? this.#parent.getCertificate() : null;
    }
    public toString(): string {
        let str = "";
        str += "\n securityMode ............. : " + MessageSecurityMode[this.securityMode];
        str += "\n securityPolicy............ : " + this.securityPolicy;
        str += "\n securityToken ............ : " + (this.activeSecurityToken ? this.activeSecurityToken!.toString() : "null");
        str += "\n timedOutRequestCount.....  : " + this.timedOutRequestCount;
        str += "\n transportTimeout ......... : " + this.#transportTimeout;
        str += "\n is transaction in progress : " + this.isTransactionInProgress();
        str += "\n is connecting ............ : " + this.isConnecting;
        str += "\n is disconnecting ......... : " + this.#_isDisconnecting;
        str += "\n is opened ................ : " + this.isOpened();
        str += "\n is valid ................. : " + this.isValid();
        str += "\n channelId ................ : " + this.channelId;
        str += "\n transportParameters: ..... : ";
        str += "\n   maxMessageSize (to send) : " + (this.#_transport?.parameters?.maxMessageSize || "<not set>");
        str += "\n   maxChunkCount  (to send) : " + (this.#_transport?.parameters?.maxChunkCount || "<not set>");
        str += "\n   receiveBufferSize(server): " + (this.#_transport?.parameters?.receiveBufferSize || "<not set>");
        str += "\n   sendBufferSize (to send) : " + (this.#_transport?.parameters?.sendBufferSize || "<not set>");
        str += "\ntime drift with server      : " + durationToString(this.#_timeDrift);
        str += "\n";
        return str;
    }

    public isTransactionInProgress(): boolean {
        return Object.keys(this.#_requests).length > 0;
    }

    /**
     * establish a secure channel with the provided server end point.
     *
     * @method create
     * @async
     * @param endpointUrl
     * @param callback the async callback function
     *
     *
     * @example
     *
     *    ```javascript
     *
     *    const secureChannel  = new ClientSecureChannelLayer({});
     *
     *    secureChannel.on("end", function(err) {
     *         console.log("secure channel has ended",err);
     *         if(err) {
     *            console.log(" the connection was closed by an external cause such as server shutdown");
     *        }
     *    });
     *    secureChannel.create("opc.tcp://localhost:1234/UA/Sample", (err) => {
     *         if(err) {
     *              console.log(" cannot establish secure channel" , err);
     *         } else {
     *              console.log("secure channel has been established");
     *         }
     *    });
     *
     *    ```
     */
    public create(endpointUrl: string, callback: ErrorCallback): void {
        assert(typeof callback === "function");

        if (this.securityMode !== MessageSecurityMode.None) {
            // istanbul ignore next
            if (!this.#serverCertificate) {
                return callback(
                    new Error("ClientSecureChannelLayer#create : expecting a server certificate when securityMode is not None")
                );
            }

            // take the opportunity of this async method to perform some async pre-processing
            if (!this.#receiverPublicKey) {
                extractPublicKeyFromCertificate(this.#serverCertificate, (err: Error | null, publicKey?: PublicKeyPEM) => {
                    /* istanbul ignore next */
                    if (err) {
                        return callback(err);
                    }
                    /* istanbul ignore next */
                    if (!publicKey) {
                        throw new Error("Internal Error");
                    }
                    this.#receiverPublicKey = createPublicKey(publicKey);
                    this.create(endpointUrl, callback);
                });
                return;
            }
        }

        this.endpointUrl = endpointUrl;

        const transport = new ClientTCP_transport(this.#requestedTransportSettings);
        transport.timeout = this.#transportTimeout;

        doDebug &&
            debugLog("ClientSecureChannelLayer#create creating ClientTCP_transport with  transport.timeout = ", transport.timeout);
        assert(!this.#_pending_transport);
        this.#_pending_transport = transport;
        this.#_establish_connection(transport, endpointUrl, (err?: Error | null) => {
            if (err) {
                doDebug && debugLog(chalk.red("cannot connect to server"));
                this.#_pending_transport = undefined;
                transport.dispose();
                return callback(err);
            }

            this.#_on_connection(transport, callback);
        });
    }

    public dispose(): void {
        this.#_dispose_transports();
        this.abortConnection(() => {
            /* empty */
        });
        this.#_cancel_security_token_watchdog();
    }

    public sabotageConnection() {
        this.#_closeWithError(new Error("Sabotage"), StatusCodes.Bad);
    }
    public abortConnection(callback: ErrorCallback): void {
        if (this.#_isDisconnecting) {
            doDebug && debugLog("abortConnection already aborting!");
            return callback();
        }
        this.#_isDisconnecting = true;
        doDebug && debugLog("abortConnection ", !!this.__call);

        async.series(
            [
                (inner_callback: ErrorCallback) => {
                    if (this.__call) {
                        this.__call.once("abort", () => inner_callback());
                        this.__call._cancelBackoff = true;
                        this.__call.abort();
                        this.__call = null;
                    } else {
                        inner_callback();
                    }
                },
                (inner_callback: ErrorCallback) => {
                    if (!this.#_pending_transport) {
                        return inner_callback();
                    }
                    this.#_pending_transport.disconnect(() => {
                        inner_callback();
                    });
                },
                (inner_callback: ErrorCallback) => {
                    if (!this.#_transport) {
                        return inner_callback();
                    }
                    this.#_transport.disconnect(() => {
                        inner_callback();
                    });
                }
            ],
            () => {
                callback();
            }
        );
    }

    /**
     * perform a OPC-UA message transaction, asynchronously.
     * During a transaction, the client sends a request to the server. The provided callback will be invoked
     * at a later stage with the reply from the server, or the error.
     *
     * preconditions:
     *   - the channel must be opened
     *
     * @example
     *
     *    ```javascript
     *    let secure_channel ; // get a  ClientSecureChannelLayer somehow
     *
     *    const request = new BrowseRequest({...});
     *    secure_channel.performMessageTransaction(request, (err,response) => {
     *       if (err) {
     *         // an error has occurred
     *       } else {
     *          assert(response instanceof BrowseResponse);
     *         // do something with response.
     *       }
     *    });
     *    ```
     *
     */
    public performMessageTransaction(request: Request, callback: PerformTransactionCallback): void {
        this.#_performMessageTransaction("MSG", request, callback);
    }

    public isValid(): boolean {
        if (!this.#_transport) {
            return false;
        }
        return this.#_transport.isValid();
    }

    public isOpened(): boolean {
        return this.isValid() && this.#_isOpened;
    }

    public getDisplayName(): string {
        if (!this.#parent) {
            return "";
        }
        return "" + (this.#parent.applicationName ? this.#parent.applicationName + " " : "") + this.#parent.clientName;
    }

    public cancelPendingTransactions(callback: ErrorCallback): void {
        assert(typeof callback === "function", "expecting a callback function, but got " + callback);

        // istanbul ignore next
        if (doDebug) {
            debugLog(
                "cancelPendingTransactions ",
                this.getDisplayName(),
                " = ",
                Object.keys(this.#_requests)
                    .map((k) => this.#_requests[k].request.constructor.name)
                    .join(" ")
            );
        }
        for (const key of Object.keys(this.#_requests)) {
            // kill timer id
            const transaction = this.#_requests[key];
            if (transaction.callback) {
                transaction.callback(new Error("Transaction has been canceled because client channel  is being closed"));
            }
        }
        callback();
    }

    /**
     * Close a client SecureChannel ,by sending a CloseSecureChannelRequest to the server.
     *
     *
     * After this call, the connection is closed and no further transaction can be made.
     *
     * @method close
     * @async
     * @param callback
     */
    public close(callback: ErrorCallback): void {
        assert(typeof callback === "function", "expecting a callback function, but got " + callback);

        // cancel any pending transaction
        this.cancelPendingTransactions((/* err?: Error */) => {
            // what the specs says:
            // --------------------
            //   The client closes the connection by sending a CloseSecureChannelRequest and closing the
            //   socket gracefully. When the server receives this message it shall release all resources
            //   allocated for the channel. The server does not send a CloseSecureChannel response
            //
            // ( Note : some servers do  send a CloseSecureChannel though !)

            // there is no need for the security token expiration event to trigger anymore
            this.#_cancel_security_token_watchdog();

            doDebug && debugLog("Sending CloseSecureChannelRequest to server");
            const request = new CloseSecureChannelRequest();

            this.#__in_normal_close_operation = true;

            if (!this.#_transport || this.#_transport.isDisconnecting()) {
                this.dispose();
                return callback(new Error("Transport disconnected"));
            }
            this.#_performMessageTransaction("CLO", request, (err) => {
                // istanbul ignore next
                if (err) {
                    warningLog("CLO transaction terminated with error: ", err.message);
                }
                if (this.#_transport) {
                    this.#_transport!.disconnect(() => {
                        callback();
                    });
                } else {
                    this.dispose();
                    callback();
                }
            });
        });
    }

    /**
     * @private internal use only : (used for test)
     */
    getTransport(): ClientTCP_transport | undefined {
        return this.#_transport;
    }
    /**
     * @private internal use only : (use for testing purpose)
     */
    _getMessageBuilder(): MessageBuilder | undefined {
        return this.#messageBuilder;
    }
    // #region private
    #_dispose_transports() {
        if (this.#_transport) {
            this.#_bytesRead += this.#_transport.bytesRead || 0;
            this.#_bytesWritten += this.#_transport.bytesWritten || 0;
            this.#_transport.dispose();
            this.#_transport = undefined;
        }
        if (this.#_pending_transport) {
            this.#_bytesRead += this.#_pending_transport.bytesRead || 0;
            this.#_bytesWritten += this.#_pending_transport.bytesWritten || 0;
            this.#_pending_transport.dispose();
            this.#_pending_transport = undefined;
        }
    }

    #_install_message_builder() {
        // istanbul ignore next
        if (!this.#_transport || !this.#_transport.parameters) {
            throw new Error("internal error");
        }
        // use to receive Server response
        this.#messageBuilder = new MessageBuilder(this.#tokenStack.serverKeyProvider(), {
            name: "client",
            privateKey: this.getPrivateKey() || undefined,
            securityMode: this.securityMode,
            maxChunkSize: this.#_transport.receiveBufferSize || 0,
            maxChunkCount: this.#_transport.maxChunkCount || 0,
            maxMessageSize: this.#_transport.maxMessageSize || 0
        });

        /* istanbul ignore next */
        if (doTraceChunk) {
            console.log(
                chalk.cyan(timestamp()),
                "   MESSAGE BUILDER LIMITS",
                "maxMessageSize = ",
                this.#messageBuilder.maxMessageSize,
                "maxChunkCount = ",
                this.#messageBuilder.maxChunkCount,
                "maxChunkSize = ",
                this.#messageBuilder.maxChunkSize,
                "(",
                this.#messageBuilder.maxChunkSize * this.#messageBuilder.maxChunkCount,
                ")"
            );
        }

        this.#messageBuilder
            .on("message", (response: BaseUAObject, msgType: string, securityHeader, requestId: number, channelId: number) => {
                this.emit("message", response, msgType, securityHeader, requestId, channelId );
                this.#_on_message_received(response as Response, msgType, securityHeader, requestId);
            })
            .on("startChunk", () => {
                //
                if (doPerfMonitoring) {
                    this.#startReceivingTick = get_clock_tick();
                }
            })
            .on("abandon", (requestId: number) => {
                const requestData = this.#_requests[requestId];

                // istanbul ignore next
                if (doDebug) {
                    debugLog("request id = ", requestId, "message was ", requestData);
                }

                const err = new ServiceFault({
                    responseHeader: {
                        requestHandle: requestId,
                        serviceResult: StatusCodes.BadOperationAbandoned
                    }
                });

                const callback = requestData.callback;
                delete this.#_requests[requestId];
                callback && callback(null, err);
            })
            .on("error", (err: Error, statusCode: StatusCode, requestId: number | null) => {
                // istanbul ignore next
                if (!requestId) {
                    return;
                }

                const requestData = this.#_requests[requestId];

                // istanbul ignore next
                doDebug && debugLog("request id = ", requestId, err, "message was ", requestData);

                if (doTraceClientRequestContent) {
                    errorLog(" message was 2:", requestData?.request?.toString() || "<null>");
                }

                if (!requestData) {
                    warningLog("requestData not found for requestId = ", requestId);
                    // istanbul ignore next
                    doDebug &&warningLog("err = ", err);
                    
                    return;
                }

                const callback = requestData.callback;
                delete this.#_requests[requestId];

                callback && callback(err, undefined);

                this.#_closeWithError(err, statusCode);
                return;
            });
    }
    #_closeWithError(err: Error, statusCode: StatusCode): void {
        if (this.#_transport) {
            this.#_transport.prematureTerminate(err, statusCode);
        }
        this.dispose();
    }

    #_on_transaction_completed(transactionStatistics: ClientTransactionStatistics) {
        /* istanbul ignore next */
        if (doTraceStatistics) {
            // dump some statistics about transaction ( time and sizes )
            _dump_client_transaction_statistics(transactionStatistics);
        }
        this.emit("end_transaction", transactionStatistics);
    }

    #_on_message_received(response: Response, msgType: string, securityHeader: SecurityHeader, requestId: number) {
        /* istanbul ignore next */
        if (response.responseHeader.requestHandle !== requestId) {
            warningLog(msgType, response.toString());
            errorLog(
                chalk.red.bgWhite.bold("xxxxx  <<<<<< _on_message_received  ERROR!   requestHandle !== requestId"),
                "requestId=",
                requestId,
                this.#_requests[requestId]?.constructor.name,
                "response.responseHeader.requestHandle=",
                response.responseHeader.requestHandle,
                response.schema.name.padStart(30)
            );
        }

        if (response instanceof OpenSecureChannelResponse) {
            if (this.channelId === 0) {
                this.channelId = response.securityToken?.channelId || 0;
            } else {
                if (this.channelId !== response.securityToken?.channelId) {
                    warningLog("channelId is supposed to be  ", this.channelId, " but is ", response.securityToken?.channelId);
                }
            }
        } else {
        }

        /* istanbul ignore next */
        if (doTraceClientMessage) {
            traceClientResponseMessage(response, this.channelId, this.#_counter);
        }

        const requestData = this.#_requests[requestId];

        /* istanbul ignore next */
        if (!requestData) {
            if (this.#__in_normal_close_operation) {
                // may be some responses that are received from the server
                // after the communication is closed. We can just ignore them
                // ( this happens with Dotnet C# stack for instance)
                return;
            }
            errorLog(
                chalk.cyan.bold("xxxxx  <<<<<< _on_message_received for unknown or timeout request "),
                requestId,
                response.schema.name.padStart(30),
                response.responseHeader.serviceResult.toString(),
                this.channelId
            );
            throw new Error(" =>  invalid requestId =" + requestId);
        }

        const request = requestData.request;

        /* istanbul ignore next */
        if (doPerfMonitoring) {
            requestData.startReceivingTick = this.#startReceivingTick;
        }

        delete this.#_requests[requestId];

        /* istanbul ignore next */
        if (response.responseHeader.requestHandle !== request.requestHeader.requestHandle) {
            const expected = request.requestHeader.requestHandle;
            const actual = response.responseHeader.requestHandle;

            if (actual !== 0x0) {
                // note some old OPCUA Server, like siemens with OPCUA 1.2 may send 0x00 as a
                // requestHandle, this is not harmful. THis happened with OpenSecureChannelRequest
                // so we only display the warning message if we have a real random discrepancy between the two requestHandle.
                const moreInfo = "Request= " + request.schema.name + " Response = " + response.schema.name;

                const message =
                    " WARNING SERVER responseHeader.requestHandle is invalid" +
                    ": expecting 0x" +
                    expected.toString(16) +
                    "(" +
                    expected +
                    ")" +
                    "  but got 0x" +
                    actual.toString(16) +
                    "(" +
                    actual +
                    ")" +
                    " ";

                debugLog(chalk.red.bold(message), chalk.yellow(moreInfo));
                warningLog(chalk.red.bold(message), chalk.yellow(moreInfo));
                warningLog(request.toString());
            }
        }

        requestData.response = response;

        /* istanbul ignore next */
        if (doPerfMonitoring) {
            // record tick2 : after response message has been received, before message processing
            requestData.startReceivingTick = this.#messageBuilder!._tick1;
        }
        requestData.bytesRead = this.#messageBuilder!.totalMessageSize;

        /* istanbul ignore next */
        if (doPerfMonitoring) {
            // record tick3 : after response message has been received, before message processing
            requestData.endReceivingTick = get_clock_tick();
        }

        process_request_callback(requestData, null, response);

        if (doPerfMonitoring) {
            // record tick4 after callback
            requestData.afterProcessingTick = get_clock_tick();
        } // store some statistics
        this.#_record_transaction_statistics(requestData);

        // notify that transaction is completed
        this.#_on_transaction_completed(this.last_transaction_stats);
    }

    #_record_transaction_statistics(requestData: RequestData) {
        const request = requestData.request;
        const response = requestData.response;
        // ---------------------------------------------------------------------------------------------------------|-
        //      _tick0                _tick1                         _tick2                       _tick3          _tick4
        //          sending request
        //        |---------------------|  waiting response
        //                              |------------------------------|      receiving response
        //                                                             |---------------------------| process.resp
        //                                                                                  |---------------|
        this.last_transaction_stats = {
            bytesRead: requestData.bytesRead,
            bytesWritten: requestData.bytesWritten_after - requestData.bytesWritten_before,
            lap_processing_response: requestData.afterProcessingTick - requestData.endReceivingTick,
            lap_receiving_response: requestData.endReceivingTick - requestData.startReceivingTick,
            lap_sending_request: requestData.afterSendTick - requestData.beforeSendTick,
            lap_transaction: requestData.afterProcessingTick - requestData.beforeSendTick,
            lap_waiting_response: requestData.startReceivingTick - requestData.afterSendTick,
            request,
            response
        };

        if (doTraceStatistics) {
            _dump_client_transaction_statistics(this.last_transaction_stats);
        }
    }

    #_cancel_pending_transactions(err?: Error | null) {
        if (doDebug && this.#_requests) {
            debugLog(
                "_cancel_pending_transactions  ",
                Object.keys(this.#_requests),
                this.#_transport ? this.#_transport.name : "no transport"
            );
        }

        if (this.#_requests) {
            for (const requestData of Object.values(this.#_requests)) {
                if (requestData) {
                    const request = requestData.request;
                    doDebug &&
                        debugLog("Cancelling pending transaction ", requestData.key, requestData.msgType, request?.schema.name);
                    process_request_callback(requestData, err);
                }
            }
        }

        this.#_requests = {};
    }

    #_on_transport_closed(err?: Error | null) {
        doDebug && debugLog(" =>ClientSecureChannelLayer#_on_transport_closed  err=", err ? err.message : "null");
        if (this.#__in_normal_close_operation) {
            err = undefined;
        }
        if (doTraceClientMessage) {
            traceClientConnectionClosed(err, this.channelId, this.#_counter);
        }
        this.emit("close", err);
        this.#_dispose_transports();
        this.#_cancel_pending_transactions(err);
        this.#_cancel_security_token_watchdog();
        this.dispose();
    }

    #_on_security_token_about_to_expire(securityToken: ChannelSecurityToken) {
        /* istanbul ignore next */
        doDebug &&
            debugLog(" client: Security Token ", securityToken.tokenId, " is about to expired, let's raise lifetime_75 event ");

        this.emit("lifetime_75", securityToken);
        this.#_renew_security_token();
    }

    #_cancel_security_token_watchdog() {
        if (this.#_securityTokenTimeoutId) {
            clearTimeout(this.#_securityTokenTimeoutId);
            this.#_securityTokenTimeoutId = null;
        }
    }

    #_install_security_token_watchdog(securityToken: ChannelSecurityToken) {
        // install timer event to raise a 'lifetime_75' when security token is about to expired
        // so that client can request for a new security token
        // note that, for speedup in test,
        // it is possible to tweak this interval for test by specifying a tokenRenewalInterval value
        //

        let lifeTime = securityToken.revisedLifetime;
        lifeTime = Math.max(lifeTime, 20);

        const percent = 75 / 100.0;
        let timeout = this.#tokenRenewalInterval || lifeTime * percent;
        timeout = Math.min(timeout, (lifeTime * 75) / 100);
        timeout = Math.max(timeout, 50);

        // istanbul ignore next
        if (doDebug) {
            debugLog(
                chalk.red.bold(" time until next security token renewal = "),
                timeout,
                "( lifetime = ",
                lifeTime + " -  tokenRenewalInterval =" + this.#tokenRenewalInterval
            );
        }
        assert(this.#_securityTokenTimeoutId === null);
        // security token renewal should happen without overlapping
        this.#_securityTokenTimeoutId = setTimeout(() => {
            this.#_securityTokenTimeoutId = null;
            this.#_on_security_token_about_to_expire(securityToken);
        }, timeout);
    }

    #_build_client_nonce(): undefined | Buffer {
        if (this.securityMode === MessageSecurityMode.None) {
            return undefined;
        }
        // create a client Nonce if secure mode is requested
        // Release 1.02 page 23 OPC Unified Architecture, Part 4 Table 7 – OpenSecureChannel Service Parameters
        // clientNonce
        // "This parameter shall have a length equal to key size used for the symmetric
        //  encryption algorithm that is identified by the securityPolicyUri"
        const cryptoFactory = getCryptoFactory(this.securityPolicy);
        /* istanbul ignore next */
        if (!cryptoFactory) {
            // this securityPolicy may not be support yet ... let's return null
            return undefined;
        }
        return randomBytes(cryptoFactory.symmetricKeyLength);
    }

    #_send_open_secure_channel_request(isInitial: boolean, callback: ErrorCallback) {
        // Verify that we have a valid and known Security policy
        if (this.securityPolicy !== SecurityPolicy.None) {
            const cryptoFactory = getCryptoFactory(this.securityPolicy);
            if (!cryptoFactory) {
                return callback(new Error(`_open_secure_channel_request :  invalid securityPolicy : ${this.securityPolicy} `));
            }
        }
        assert(this.securityMode !== MessageSecurityMode.Invalid, "invalid security mode");
        // from the specs:
        // The OpenSecureChannel Messages are not signed or encrypted if the SecurityMode is None. The
        // nonces  are ignored and should be set to null. The SecureChannelId and the TokenId are still
        // assigned but no security is applied to Messages exchanged via the channel.

        const msgType = "OPN";
        const requestType = isInitial ? SecurityTokenRequestType.Issue : SecurityTokenRequestType.Renew;

        const clientNonce = this.#_build_client_nonce();
        this.#_isOpened = !isInitial;
        // OpenSecureChannel
        const msg = new OpenSecureChannelRequest({
            clientNonce,
            clientProtocolVersion: this.protocolVersion,
            requestHeader: {
                auditEntryId: null
            },
            requestType: requestType,
            requestedLifetime: this.#requestedLifetime,
            securityMode: this.securityMode
        });

        const startDate = new Date();
        this.#_performMessageTransaction(msgType, msg, (err?: Error | null, response?: Response) => {
            // istanbul ignore next
            if (response && response.responseHeader && response.responseHeader.serviceResult !== StatusCodes.Good) {
                warningLog(
                    "OpenSecureChannelRequest Error: response.responseHeader.serviceResult ",
                    response.constructor.name,
                    response.responseHeader.serviceResult.toString()
                );
                err = new Error(response.responseHeader.serviceResult.toString());
            }
            if (!err && response) {
                const openSecureChannelResponse = response as OpenSecureChannelResponse;

                // record channelId for future transactions
                this.channelId = openSecureChannelResponse.securityToken.channelId;

                // todo : verify that server certificate is  valid
                // A self-signed application instance certificate does not need to be verified with a CA.
                // todo : verify that Certificate URI matches the ApplicationURI of the server

                // istanbul ignore next
                if (openSecureChannelResponse.securityToken.tokenId <= 0 && msgType !== "OPN") {
                    return callback(
                        new Error(
                            `_open_secure_channel_request : response has an  invalid token ${openSecureChannelResponse.securityToken.tokenId} Id or msgType ${msgType} `
                        )
                    );
                }

                const securityToken = openSecureChannelResponse.securityToken;

                // Check time
                const endDate = new Date();
                const midDate = new Date((startDate.getTime() + endDate.getTime()) / 2);
                if (securityToken.createdAt) {
                    const delta = securityToken.createdAt.getTime() - midDate.getTime();
                    this.#_timeDrift = delta;
                    if (Math.abs(delta) > 1000 * 5) {
                        warningLog(
                            `[NODE-OPCUA-W33]  client : server token creation date exposes a time discrepancy ${durationToString(delta)}\n` +
                                "remote server clock doesn't match this computer date !\n" +
                                " please check both server and client clocks are properly set !\n" +
                                ` server time :${chalk.cyan(securityToken.createdAt?.toISOString())}\n` +
                                ` client time :${chalk.cyan(midDate.toISOString())}\n` +
                                ` transaction duration = ${durationToString(endDate.getTime() - startDate.getTime())}\n` +
                                ` server URL = ${this.endpointUrl} \n` +
                                ` token.createdAt  has been updated to reflect client time`
                        );
                    }
                }

                securityToken.createdAt = midDate;

                const serverNonce = openSecureChannelResponse.serverNonce;

                let derivedKeys: DerivedKeys1 | null = null;
                if (this.securityMode !== MessageSecurityMode.None) {
                    // verify that server nonce if provided is at least 32 bytes long

                    /* istanbul ignore next */
                    if (!openSecureChannelResponse.serverNonce) {
                        warningLog(" client : server nonce is missing !");
                        return callback(new Error(" Invalid server nonce"));
                    }
                    // This parameter shall have a length equal to key size used for the symmetric
                    // encryption algorithm that is identified by the securityPolicyUri.
                    /* istanbul ignore next */
                    if (openSecureChannelResponse.serverNonce.length !== clientNonce?.length) {
                        warningLog(" client : server nonce is invalid  (invalid length)!");
                        return callback(new Error(" Invalid server nonce length"));
                    }

                    const cryptoFactory = getCryptoFactory(this.#messageBuilder!.securityPolicy!)!;
                    derivedKeys = computeDerivedKeys(cryptoFactory, serverNonce, clientNonce!);
                    // istanbul ignore next
                    if (doDebug) {
                        debugLog("Server has send a new security Token");
                    }
                }

                this.#tokenStack.pushNewToken(securityToken, derivedKeys);
                this.emit("security_token_created", securityToken);
                this.#_install_security_token_watchdog(securityToken);

                this.activeSecurityToken = securityToken;
                this.#_isOpened = true;
            }
            callback(err || undefined);
        });
    }

    /**
     * install message builder and send first OpenSecureChannelRequest
     */
    #_on_connection(transport: ClientTCP_transport, callback: ErrorCallback) {
        assert(this.#_pending_transport === transport);
        this.#_pending_transport = undefined;
        this.#_transport = transport;

        // install message chunker limits:
        this.#messageChunker.maxMessageSize = this.#_transport?.maxMessageSize || 0;
        this.#messageChunker.maxChunkCount = this.#_transport?.maxChunkCount || 0;

        this.#_install_message_builder();

        this.#_transport.on("chunk", (messageChunk: Buffer) => {
            this.emit("receive_chunk", messageChunk);
            this.#_on_receive_message_chunk(messageChunk);
        });

        this.#_transport.on("close", (err: Error | null) => this.#_on_transport_closed(err));

        this.#_transport.on("connection_break", () => {
            doDebug && debugLog(chalk.red("Client => CONNECTION BREAK  <="));
            this.#_on_transport_closed(new Error("Connection Break"));
        });

        setImmediate(() => {
            doDebug && debugLog(chalk.red("Client now sending OpenSecureChannel"));
            const isInitial = true;
            this.#_send_open_secure_channel_request(isInitial, callback);
        });
    }

    #_backoff_completion(
        err: Error | undefined,
        lastError: Error | undefined,
        transport: ClientTCP_transport,
        callback: ErrorCallback
    ) {
        // Node 20.11.1 on windows now reports a AggregateError when a connection is refused
        // this is a workaround to fix the error message, that is empty when the error is
        // an AggregateError
        const fixError = (err: Error | undefined) => {
            if (!err) return err;
            interface IAggregateError extends Error {
                errors: Error[];
            }
            if ((err as IAggregateError).errors) {
                const _err = err as IAggregateError;
                err.message = _err.errors.map((e) => e.message).join("\n");
            }
            return err;
        };

        if (this.__call) {
            transport.numberOfRetry = transport.numberOfRetry || 0;
            transport.numberOfRetry += this.__call.getNumRetries();
            this.__call.removeAllListeners();
            this.__call = null;

            if (err) {
                const err_ = fixError(lastError || err);
                callback(err_);
            } else {
                callback();
            }
        }
    }

    #_connect(transport: ClientTCP_transport, endpointUrl: string, _i_callback: ErrorCallback) {
        const on_connect = (err?: Error | null) => {
            doDebug && debugLog("Connection => err", err ? err.message : "null");
            // force Backoff to fail if err is not ECONNRESET or ECONNREFUSED
            // this mean that the connection to the server has succeeded but for some reason
            // the server has denied the connection
            // the cause could be:
            //   - invalid protocol version specified by client
            //   - server going to shutdown
            //   - server too busy -
            //   - server shielding itself from a DDOS attack
            if (err) {
                let should_abort = this.#_isDisconnecting;

                if (err.message.match(/ECONNRESET/)) {
                    should_abort = true;
                }
                if (err.message.match(/BadProtocolVersionUnsupported/)) {
                    should_abort = true;
                }
                if (err.message.match(/BadTcpInternalError/)) {
                    should_abort = true;
                }
                if (err.message.match(/BadTcpMessageTooLarge/)) {
                    should_abort = true;
                }
                if (err.message.match(/BadTcpEndpointUriInvalid/)) {
                    should_abort = true;
                }
                if (err.message.match(/BadTcpMessageTypeInvalid/)) {
                    should_abort = true;
                }

                this.#lastError = err;

                if (this.__call) {
                    // connection cannot be establish ? if not, abort the backoff process
                    if (should_abort) {
                        doDebug && debugLog(" Aborting backoff process prematurely - err = ", err.message);
                        this.__call.abort();
                    } else {
                        doDebug && debugLog(" backoff - keep trying - err = ", err.message);
                    }
                }
            }
            _i_callback(err!);
        };

        transport.connect(endpointUrl, on_connect);
    }

    #_establish_connection(transport: ClientTCP_transport, endpointUrl: string, callback: ErrorCallback) {
        transport.protocolVersion = this.protocolVersion;

        this.#lastError = undefined;

        if (this.#connectionStrategy.maxRetry === 0) {
            doDebug && debugLog(chalk.cyan("max Retry === 0 =>  No backoff required -> call the _connect function directly"));
            this.__call = 0;
            return this.#_connect(transport, endpointUrl, callback);
        }

        const connectFunc = (callback2: ErrorCallback) => {
            return this.#_connect(transport, endpointUrl, callback2);
        };
        const completionFunc = (err?: Error) => {
            return this.#_backoff_completion(err, this.#lastError, transport, callback);
        };

        this.__call = backoff.call(connectFunc, completionFunc);

        if (this.#connectionStrategy.maxRetry >= 0) {
            const maxRetry = Math.max(this.#connectionStrategy.maxRetry, 1);
            doDebug && debugLog(chalk.cyan("backoff will failed after "), maxRetry);
            this.__call.failAfter(maxRetry);
        } else {
            // retry will be infinite
            doDebug && debugLog(chalk.cyan("backoff => starting a infinite retry"));
        }

        const onBackoffFunc = (retryCount: number, delay: number) => {
            doDebug &&
                debugLog(
                    chalk.bgWhite.cyan(" Backoff #"),
                    retryCount,
                    "delay = ",
                    delay,
                    " ms",
                    " maxRetry ",
                    this.#connectionStrategy.maxRetry
                );
            // Do something when backoff starts, e.g. show to the
            // user the delay before next reconnection attempt.
            this.emit("backoff", retryCount, delay);
        };

        this.__call.on("backoff", onBackoffFunc);

        this.__call.on("abort", () => {
            doDebug && debugLog(chalk.bgWhite.cyan(` abort #   after ${this.__call.getNumRetries()} retries.`));
            // Do something when backoff starts, e.g. show to the
            // user the delay before next reconnection attempt.
            this.emit("abort");
            setImmediate(() => {
                this.#_backoff_completion(undefined, new Error("Connection abandoned"), transport, callback);
            });
        });

        this.__call.setStrategy(new backoff.ExponentialStrategy(this.#connectionStrategy));
        this.__call.start();
    }

    /**
     * @private internal function
     */
    public beforeSecurityRenew = async () => {};
    #_renew_security_token() {
        this.beforeSecurityRenew()
            .then(() => {
                // istanbul ignore next
                doDebug && debugLog("ClientSecureChannelLayer#_renew_security_token");

                // istanbul ignore next
                if (!this.isValid()) {
                    // this may happen if the communication has been closed by the client or the sever
                    warningLog("Invalid socket => Communication has been lost, cannot renew token");
                    return;
                }

                const isInitial = false;
                this.#_send_open_secure_channel_request(isInitial, (err?: Error | null) => {
                    /* istanbul ignore else */
                    if (!err) {
                        doDebug && debugLog(" token renewed");
                        this.emit("security_token_renewed", this.activeSecurityToken!);
                    } else {
                        errorLog(
                            "ClientSecureChannelLayer: Warning: securityToken hasn't been renewed -> err ",
                            (err as Error).message
                        );
                    }
                });
            })
            .catch((err) => {
                errorLog("ClientSecureChannelLayer#beforeSecurityRenew error", err);
            });
    }

    #_on_receive_message_chunk(messageChunk: Buffer) {
        /* istanbul ignore next */
        if (doDebug1) {
            const _stream = new BinaryStream(messageChunk);
            const messageHeader = readMessageHeader(_stream);
            debugLog("CLIENT RECEIVED " + chalk.yellow(JSON.stringify(messageHeader) + ""));
            debugLog("\n" + hexDump(messageChunk));
            debugLog(messageHeaderToString(messageChunk));
        }
        this.#messageBuilder!.feed(messageChunk);
    }

    /**
     * @return  newly generated request id
     */
    #makeRequestId(): number {
        this.#_lastRequestId += 1;
        return this.#_lastRequestId;
    }
    #undoRequestId(): number {
        this.#_lastRequestId -= 1;
        return this.#_lastRequestId;
    }

    /**
     * internal version of _performMessageTransaction.
     *
     * - this method takes a extra parameter : msgType
     * TODO:
     * - this method can be re-entrant, meaning that a new transaction can be started before any pending transaction
     *   is fully completed.
     * - Any error on transport will cause all pending transactions to be cancelled
     *
     * - the method returns a timeout Error if the server fails to return a response within the timeoutHint interval.
     *
     *
     */

    #_make_timeout_callback(request: Request, callback: PerformTransactionCallback, timeout: number): PerformTransactionCallback {
        let localCallback: PerformTransactionCallback | null = callback;

        const optionalTrace = !checkTimeout || new Error().stack;
        let hasTimedOut = false;

        let timerId: NodeJS.Timeout | null = setTimeout(() => {
            timerId = null;
            hasTimedOut = true;
            if (checkTimeout) {
                warningLog(" Timeout .... waiting for response for ", request.constructor.name, request.requestHeader.toString());
                warningLog(" Timeout was ", timeout, "ms");
                warningLog(request.toString());
                warningLog(optionalTrace);
            }
            modified_callback(
                new Error("Transaction has timed out ( timeout = " + timeout + " ms , request = " + request.constructor.name + ")")
            );
            this.#_timeout_request_count += 1;
            this.emit("timed_out_request", request);
        }, timeout);

        const modified_callback = (err?: Error | null, response?: Response) => {
            /* istanbul ignore next */
            if (doDebug) {
                debugLog(
                    chalk.cyan("------------------------------------- Client receiving response "),
                    request.constructor.name,
                    request.requestHeader.requestHandle,
                    response ? response.constructor.name : "null",
                    "err=",
                    err ? err.message : "null",
                    "securityTokenId=",
                    this.activeSecurityToken?.tokenId
                );
            }
            if (response && doTraceClientResponseContent) {
                traceClientResponseContent(response, this.channelId);
            }

            if (!localCallback) {
                return; // already processed by time  out
            }
            // when response === null we are processing the timeout , therefore there is no need to clearTimeout
            if (!hasTimedOut && timerId) {
                clearTimeout(timerId);
            }
            timerId = null;

            if (!err && response) {
                this.emit("receive_response", response);
            }
            assert(!err || types.isNativeError(err));

            delete this.#_requests[request.requestHeader.requestHandle];
            // invoke user callback if it has not been intercepted first ( by a abrupt disconnection for instance )
            try {
                localCallback.call(this, err || null, response);
            } catch (err1) {
                errorLog("ERROR !!! callback has thrown en error ", err1);
            } finally {
                localCallback = null;
            }
        };
        return modified_callback;
    }

    #_adjustRequestTimeout(request: Request) {
        let timeout =
            request.requestHeader.timeoutHint ||
            this.defaultTransactionTimeout ||
            ClientSecureChannelLayer.defaultTransactionTimeout;
        timeout = Math.max(ClientSecureChannelLayer.minTransactionTimeout, timeout);
        /* istanbul ignore next */
        if (request.requestHeader.timeoutHint != timeout) {
            debugLog("Adjusted timeout = ", request.requestHeader.timeoutHint);
        }
        request.requestHeader.timeoutHint = timeout;
        return timeout;
    }

    #_performMessageTransaction(msgType: string, request: Request, callback: PerformTransactionCallback) {
        this.emit("beforePerformTransaction", msgType, request);

        /* istanbul ignore next */
        if (!this.isValid()) {
            return callback(
                new Error("ClientSecureChannelLayer => Socket is closed ! while processing " + request.constructor.name)
            );
        }

        const timeout = this.#_adjustRequestTimeout(request);

        const modifiedCallback = this.#_make_timeout_callback(request, callback, timeout);

        const transactionData: TransactionData = {
            callback: modifiedCallback,
            msgType: msgType,
            request: request
        };

        this.#_internal_perform_transaction(transactionData);
    }

    /**
     *
     * @param transactionData
     * @param transactionData.msgType
     * @param transactionData.request
     * @param transactionData.callback
     * @private
     */

    #_internal_perform_transaction(transactionData: TransactionData) {
        if (!this.#_transport) {
            setTimeout(() => {
                transactionData.callback(new Error("Client not connected"));
            }, 100);
            return;
        }
        const msgType = transactionData.msgType;
        const request = transactionData.request;

        /* istanbul ignore next */
        if (request.requestHeader.requestHandle !== requestHandleNotSetValue) {
            errorLog(
                chalk.bgRed.white("xxxxx   >>>>>> request has already been set with a requestHandle"),
                request.requestHeader.requestHandle,
                request.constructor.name
            );
            errorLog(Object.keys(this.#_requests).join(" "));
            errorLog(new Error("Investigate me"));
        }

        // get a new requestId
        request.requestHeader.requestHandle = this.#makeRequestId();

        /* istanbul ignore next */
        if (doTraceClientMessage) {
            traceClientRequestMessage(request, this.channelId, this.#_counter);
        }

        const requestData: RequestData = {
            callback: transactionData.callback,
            msgType: msgType,
            request: request,

            bytesRead: 0,
            bytesWritten_after: 0,
            bytesWritten_before: this.bytesWritten,

            beforeSendTick: 0,
            afterSendTick: 0,
            startReceivingTick: 0,
            endReceivingTick: 0,
            afterProcessingTick: 0,
            key: "",
            chunk_count: 0
        };

        this.#_requests[request.requestHeader.requestHandle] = requestData;

        /* istanbul ignore next */
        if (doPerfMonitoring) {
            const stats = requestData;
            // record tick0 : before request is being sent to server
            stats.beforeSendTick = get_clock_tick();
        }
        // check that limits are OK
        this.#_sendSecureOpcUARequest(msgType, request);
    }

    #_send_chunk(requestId: number, chunk: Buffer | null) {
        const requestData = this.#_requests[requestId];

        if (chunk) {
            this.emit("send_chunk", chunk);

            /* istanbul ignore next */
            if (checkChunks) {
                verify_message_chunk(chunk);
                debugLog(chalk.yellow("CLIENT SEND chunk "));
                debugLog(chalk.yellow(messageHeaderToString(chunk)));
                debugLog(chalk.red(hexDump(chunk)));
            }
            assert(this.#_transport);
            this.#_transport?.write(chunk);
            requestData.chunk_count += 1;
        } else {
            // last chunk ....

            /* istanbul ignore next */
            if (checkChunks) {
                debugLog(chalk.yellow("CLIENT SEND done."));
            }
            if (requestData) {
                if (doPerfMonitoring) {
                    requestData.afterSendTick = get_clock_tick();
                }
                requestData.bytesWritten_after = this.bytesWritten;

                if (requestData.msgType === "CLO") {
                    setTimeout(() => {
                        // We sdo not expect any response from the server for a CLO message
                        if (requestData.callback) {
                            // if server do not initiates the disconnection, we may need to call the callback
                            // from here
                            requestData.callback!(null, undefined);
                            requestData.callback = undefined;
                        }
                    }, 100);
                }
            }
        }
    }

    #_construct_asymmetric_security_header(): AsymmetricAlgorithmSecurityHeader {
        const calculateMaxSenderCertificateSize = () => {
            /**
             * The SenderCertificate, including any chains, shall be small enough to fit
             * into a single MessageChunk and leave room for at least one byte of body
             * information.The maximum size for the SenderCertificate can be calculated
             * with this formula:
             */

            const cryptoFactory = getCryptoFactory(this.securityPolicy);
            if (!cryptoFactory) {
                // we have a unknown security policy
                // let's assume that maxSenderCertificateSize is not an issue
                return 1 * 8192;
            }
            const { signatureLength, blockPaddingSize } = cryptoFactory;
            const securityPolicyUriLength = this.securityPolicy.length;
            const messageChunkSize = this.#_transport?.parameters?.sendBufferSize || 0;
            const padding = blockPaddingSize;
            const extraPadding = 0; // ???
            const asymmetricSignatureSize = signatureLength;
            const maxSenderCertificateSize =
                messageChunkSize -
                12 - // Header size
                4 - // SecurityPolicyUriLength
                securityPolicyUriLength - // UTF-8 encoded string
                4 - // SenderCertificateLength
                4 - // ReceiverCertificateThumbprintLength
                20 - // ReceiverCertificateThumbprint
                8 - // SequenceHeader size
                1 - // Minimum body size
                1 - // PaddingSize if present
                padding - // Padding if present
                extraPadding - // ExtraPadding if present
                asymmetricSignatureSize; // If present
            return maxSenderCertificateSize;
        };

        switch (this.securityMode) {
            case MessageSecurityMode.None:
                {
                    return new AsymmetricAlgorithmSecurityHeader({
                        securityPolicyUri: toURI(this.securityPolicy),
                        receiverCertificateThumbprint: null,
                        senderCertificate: null
                    });
                }
                break;
            case MessageSecurityMode.Sign:
            case MessageSecurityMode.SignAndEncrypt: {
                // get a partial portion of the client certificate chain that matches the maxSenderCertificateSize
                const maxSenderCertificateSize = calculateMaxSenderCertificateSize();
                const partialCertificateChain = getPartialCertificateChain(this.getCertificateChain(), maxSenderCertificateSize);

                // get the thumbprint of the  receiverCertificate certificate
                const evaluateReceiverThumbprint = () => {
                    if (this.securityMode === MessageSecurityMode.None) {
                        return null;
                    }
                    const chain = split_der(this.#serverCertificate!);
                    assert(chain.length === 1);
                    const receiverCertificateThumbprint = getThumbprint(this.#serverCertificate);
                    doDebug && debugLog("XXXXXXserver certificate thumbprint = ", receiverCertificateThumbprint!.toString("hex"));
                    return receiverCertificateThumbprint;
                };
                const receiverCertificateThumbprint = evaluateReceiverThumbprint();
                if (this.securityPolicy === SecurityPolicy.Invalid) {
                    warningLog("SecurityPolicy is invalid", this.securityPolicy.toString());
                }
                const securityHeader = new AsymmetricAlgorithmSecurityHeader({
                    securityPolicyUri: toURI(this.securityPolicy),
                    /**
                     * The thumbprint of the X.509 v3 Certificate assigned to the receiving application Instance.
                     * The thumbprint is the CertificateDigest of the DER encoded form of the Certificate.
                     * This indicates what public key was used to encrypt the MessageChunk.
                     * This field shall be null if the Message is not encrypted.
                     */
                    receiverCertificateThumbprint,

                    /**
                     * The X.509 v3 Certificate assigned to the sending application Instance.
                     * This is a DER encoded blob.
                     * The structure of an X.509 v3 Certificate is defined in X.509 v3.
                     * The DER format for a Certificate is defined in X690
                     * This indicates what Private Key was used to sign the MessageChunk.
                     * The Stack shall close the channel and report an error to the application
                     * if the SenderCertificate is too large for the buffer size supported by the transport layer.
                     * This field shall be null if the Message is not signed.
                     * If the Certificate is signed by a CA, the DER encoded CA Certificate may be
                     * appended after the Certificate in the byte array. If the CA Certificate is also
                     * signed by another CA this process is repeated until the entire Certificate chain
                     * is in the buffer or if MaxSenderCertificateSize limit is reached (the process
                     * stops after the last whole Certificate that can be added without exceeding
                     * the MaxSenderCertificateSize limit).
                     * Receivers can extract the Certificates from the byte array by using the Certificate
                     * size contained in DER header (see X.509 v3).
                     */
                    senderCertificate: partialCertificateChain // certificate of the private key used to sign the message
                });

                /* istanbul ignore next */
                if (dumpSecurityHeader) {
                    warningLog("HEADER !!!! ", securityHeader.toString());
                }
                return securityHeader;
                break;
            }
            default:
                /* istanbul ignore next */
                throw new Error("invalid security mode");
        }
    }

    #_get_security_options_for_OPN(): SecureMessageData | null {
        // The OpenSecureChannel Messages are signed and encrypted if the SecurityMode is
        // not None(even  if the SecurityMode is Sign).

        if (this.securityMode === MessageSecurityMode.None) {
            return null;
        }

        const senderPrivateKey = this.getPrivateKey();
        /* istanbul ignore next */
        if (!senderPrivateKey) {
            throw new Error("invalid or missing senderPrivateKey : necessary to sign");
        }

        const cryptoFactory = getCryptoFactory(this.securityPolicy);
        /* istanbul ignore next */
        if (!cryptoFactory) {
            throw new Error("Internal Error: ServerSecureChannelLayer must have a crypto strategy");
        }

        /* istanbul ignore next */
        if (!this.#receiverPublicKey) {
            throw new Error("Internal error: invalid receiverPublicKey");
        }
        const receiverPublicKey = this.#receiverPublicKey;
        const keyLength = rsaLengthPublicKey(receiverPublicKey);
        const signatureLength = rsaLengthPrivateKey(senderPrivateKey);
        const options: SecureMessageData = {
            // for signing
            signatureLength,
            signBufferFunc: (chunk) => cryptoFactory.asymmetricSign(chunk, senderPrivateKey),
            // for encrypting
            cipherBlockSize: keyLength,
            plainBlockSize: keyLength - cryptoFactory.blockPaddingSize,
            encryptBufferFunc: (chunk) => cryptoFactory.asymmetricEncrypt(chunk, receiverPublicKey)
        };
        return options;
    }

    #_get_security_options_for_MSG(tokenId: number): SecureMessageData | null {
        if (this.securityMode === MessageSecurityMode.None) {
            return null;
        }
        const derivedClientKeys = this.#tokenStack.clientKeyProvider().getDerivedKey(tokenId);
        // istanbul ignore next
        if (!derivedClientKeys) {
            errorLog("derivedKeys not set but security mode = ", MessageSecurityMode[this.securityMode]);
            return null;
        }
        const options = getOptionsForSymmetricSignAndEncrypt(this.securityMode, derivedClientKeys);

        return options;
    }

    #_get_security_options(msgType: string): { securityHeader: SecurityHeader; securityOptions: SecureMessageData | null } {
        if (msgType == "OPN") {
            const securityHeader = this.#_construct_asymmetric_security_header();
            const securityOptions = this.#_get_security_options_for_OPN();
            return {
                securityHeader,
                securityOptions
            };
        } else {
            const securityToken = this.activeSecurityToken!;
            const tokenId = securityToken ? securityToken.tokenId : 0;
            const securityHeader = new SymmetricAlgorithmSecurityHeader({ tokenId });
            const securityOptions = this.#_get_security_options_for_MSG(tokenId);
            return {
                securityHeader,
                securityOptions
            };
        }
    }
    #_sendSecureOpcUARequest(msgType: string, request: Request) {
        const evaluateChunkSize = () => {
            // use chunk size that has been negotiated by the transport layer
            if (this.#_transport?.parameters && this.#_transport?.parameters.sendBufferSize) {
                return this.#_transport.parameters.sendBufferSize;
            }
            return 0;
        };
        const { securityOptions, securityHeader } = this.#_get_security_options(msgType);

        const requestId = request.requestHeader.requestHandle;

        const chunkSize = evaluateChunkSize();

        let options: ChunkMessageParameters = {
            channelId: this.channelId,
            securityOptions: {
                channelId: this.channelId,
                requestId,
                chunkSize,
                cipherBlockSize: 0,
                plainBlockSize: 0,
                sequenceHeaderSize: 0,
                signatureLength: 0,
                ...securityOptions
            },
            securityHeader: securityHeader
        };

        /* istanbul ignore next */
        if (doTraceClientRequestContent) {
            traceClientRequestContent(request, this.channelId, this.activeSecurityToken);
        }
        this.emit("send_request", request, msgType, securityHeader);

        const statusCode = this.#messageChunker.chunkSecureMessage(msgType, options, request as BaseUAObject, (chunk) =>
            this.#_send_chunk(requestId, chunk)
        );
        if (statusCode.isNotGood()) {
            // chunkSecureMessage has refused to send the message
            const response = new ServiceFault({
                responseHeader: {
                    requestHandle: requestId,
                    serviceResult: statusCode,
                    stringTable: [statusCode.toString()]
                }
            });
            this.#_on_message_received(response, "ERR", securityHeader, request.requestHeader.requestHandle);
        }
    }
    // #endregion
}
