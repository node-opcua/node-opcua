/**
 * @module node-opcua-secure-channel
 */
// tslint:disable:variable-name
// tslint:disable:object-literal-shorthand
// tslint:disable:no-console
import * as chalk from "chalk";
import { randomBytes } from "crypto";
import { EventEmitter } from "events";
import * as async from "async";

import { Certificate, extractPublicKeyFromCertificate, PrivateKeyPEM, PublicKeyPEM, rsa_length } from "node-opcua-crypto";

import { assert } from "node-opcua-assert";

import { BinaryStream } from "node-opcua-binary-stream";
import { get_clock_tick, timestamp } from "node-opcua-utils";

import { readMessageHeader, verify_message_chunk } from "node-opcua-chunkmanager";
import { checkDebugFlag, hexDump, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { coerceMessageSecurityMode, MessageSecurityMode } from "node-opcua-service-secure-channel";
import { StatusCodes } from "node-opcua-status-code";
import { ClientTCP_transport } from "node-opcua-transport";
import { ErrorCallback } from "node-opcua-status-code";
import { BaseUAObject } from "node-opcua-factory";

import { MessageBuilder, SecurityToken } from "../message_builder";
import { ChunkMessageOptions, MessageChunker } from "../message_chunker";
import { messageHeaderToString } from "../message_header_to_string";
import {
    coerceSecurityPolicy,
    computeDerivedKeys,
    DerivedKeys1,
    getCryptoFactory,
    getOptionsForSymmetricSignAndEncrypt,
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

// import * as backoff from "backoff";
// tslint:disable-next-line: no-var-requires
const backoff = require("backoff");

const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);
const doDebug = checkDebugFlag(__filename);
const warningLog = make_warningLog(__filename);
const checkChunks = doDebug && false;
const doDebug1 = false;

import { extractFirstCertificateInChain, getThumbprint, ICertificateKeyPairProvider, Request, Response } from "../common";
import {
    ClientTransactionStatistics,
    doPerfMonitoring,
    doTraceClientMessage,
    doTraceClientRequestContent,
    doTraceStatistics,
    dumpSecurityHeader,
    traceClientRequestMessage,
    traceClientResponseMessage,
    _dump_client_transaction_statistics
} from "../utils";

export const requestHandleNotSetValue = 0xdeadbeef;

type PerformTransactionCallback = (err?: Error | null, response?: Response) => void;

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

    _tick0: number;
    _tick1: number;
    _tick2: number;
    _tick3: number;
    _tick4: number;
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
        response.responseHeader.stringTable = response.responseHeader.stringTable || [];
        response.responseHeader.stringTable = [response.responseHeader.stringTable.join("\n")];
        err = new Error(" serviceResult = " + response.responseHeader.serviceResult.toString());
        //  "  returned by server \n response:" + response.toString() + "\n  request: " + request.toString());
        (err as any).response = response;
        ((err as any).request = request), (response = undefined);
    }

    const theCallbackFunction = requestData.callback;
    /* istanbul ignore next */
    if (!theCallbackFunction) {
        throw new Error("Internal error");
    }
    assert(requestData.msgType === "CLO" || (err && !response) || (!err && response));

    // let set callback to undefined to prevent callback to be called again
    requestData.callback = undefined;

    theCallbackFunction(err, !err && response !== null ? response : undefined);
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

export function coerceConnectionStrategy(options: ConnectionStrategyOptions | null): ConnectionStrategy {
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

    getPrivateKey(): PrivateKeyPEM;
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

    parent: ClientSecureChannelParent;

    /* OPCUAClientBase */
    /**
     *   the transport timeout interval in ms ( default = 10 seconds)
     */
    transportTimeout?: number;
    /**
     * the connection strategy options
     * @param [options.connectionStrategy.maxRetry      = 10]
     * @param [options.connectionStrategy.initialDelay  = 10]
     * @param [options.connectionStrategy.maxDelay      = 10000]
     */
    connectionStrategy: ConnectionStrategyOptions;
}

/**
 * a ClientSecureChannelLayer represents the client side of the OPCUA secure channel.
 */
export class ClientSecureChannelLayer extends EventEmitter {
    private static g_counter: number = 0;
    private _counter: number = ClientSecureChannelLayer.g_counter++;
    private _bytesRead: number = 0;
    private _bytesWritten: number = 0;
    
    public static minTransactionTimeout = 10 * 1000; // 10 sec
    public static defaultTransactionTimeout = 60 * 1000; // 1 minute

    /**
     * true if the secure channel is trying to establish the connection with the server. In this case, the client
     * may be in the middle of the backoff connection process.
     *
     */
    public get isConnecting(): boolean {
        return !!this.__call;
    }

    get bytesRead(): number {
        return this._bytesRead + (this._transport ? this._transport.bytesRead : 0);
    }

    get bytesWritten(): number {
        return this._bytesWritten + (this._transport ? this._transport.bytesWritten : 0);
    }

    get transactionsPerformed(): number {
        return this._lastRequestId;
    }

    get timedOutRequestCount(): number {
        return this._timeout_request_count;
    }

    public static defaultTransportTimeout = 60 * 1000; // 1 minute

    public protocolVersion: number;
    public readonly securityMode: MessageSecurityMode;
    public readonly securityPolicy: SecurityPolicy;
    public endpointUrl: string;
    public channelId: number;

    private _lastRequestId: number;
    private _transport?: ClientTCP_transport;
    private _pending_transport?: ClientTCP_transport;
    private readonly parent: ClientSecureChannelParent;

    private clientNonce: any;
    private readonly messageChunker: MessageChunker;
    private readonly defaultSecureTokenLifetime: number;
    private readonly tokenRenewalInterval: number;
    private readonly serverCertificate: Certificate | null;
    private readonly messageBuilder: MessageBuilder;

    private _requests: { [key: string]: RequestData };

    private __in_normal_close_operation: boolean;
    private _timeout_request_count: number;
    private _securityTokenTimeoutId: NodeJS.Timer | null;
    private readonly transportTimeout: number;
    private readonly connectionStrategy: any;
    private last_transaction_stats: any | ClientTransactionStatistics;
    private derivedKeys: DerivedKeys1 | null;
    private receiverPublicKey: PublicKeyPEM | null;
    private __call: any;
    private _isOpened: boolean;
    private securityToken: SecurityToken | null;
    private serverNonce: Buffer | null;
    private receiverCertificate: Certificate | null;
    private securityHeader: AsymmetricAlgorithmSecurityHeader | null;
    private lastError?: Error;
    private _tick2: number = 0;
    private _isDisconnecting = false;

    constructor(options: ClientSecureChannelLayerOptions) {
        super();

        this.securityHeader = null;
        this.receiverCertificate = null;
        this.securityToken = null;
        this.serverNonce = null;
        this.derivedKeys = null;
        this.receiverPublicKey = null;
        this.endpointUrl = "";

        if ((global as any).hasResourceLeakDetector && !(global as any).ResourceLeakDetectorStarted) {
            throw new Error("ClientSecureChannelLayer not in ResourceLeakDetectorStarted");
        }

        assert(this instanceof ClientSecureChannelLayer);

        this._isOpened = false;
        this._transport = undefined;
        this._lastRequestId = 0;
        this.parent = options.parent;
        this.clientNonce = null; // will be created when needed

        this.protocolVersion = 0;

        this.messageChunker = new MessageChunker({
            derivedKeys: null,
            // note maxMessageSize cannot be set at this stage, transport is not kown
        });

        this.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 30000;
        this.tokenRenewalInterval = options.tokenRenewalInterval || 0;

        this.securityMode = coerceMessageSecurityMode(options.securityMode);

        this.securityPolicy = coerceSecurityPolicy(options.securityPolicy);

        this.serverCertificate = extractFirstCertificateInChain(options.serverCertificate);

        if (this.securityMode !== MessageSecurityMode.None) {
            assert(
                (this.serverCertificate as any) instanceof Buffer,
                "Expecting a valid certificate when security mode is not None"
            );
            assert(this.securityPolicy !== SecurityPolicy.None, "Security Policy None is not a valid choice");
            // make sure that we do not have a chain here ...
        }

        this.messageBuilder = new MessageBuilder({
            name: "client",
            privateKey: this.getPrivateKey() || undefined,
            securityMode: this.securityMode
        });
        this._requests = {};

        this.messageBuilder
            .on("message", (response: Response, msgType: string, requestId: number) => {
                this._on_message_received(response, msgType, requestId);
            })
            .on("start_chunk", () => {
                //
                if (doPerfMonitoring) {
                    this._tick2 = get_clock_tick();
                }
            })
            .on("error", (err, requestId) => {
                //
                debugLog("request id = ", requestId, err);
                let requestData = this._requests[requestId];

                if (doDebug) {
                    debugLog(" message was ");
                    debugLog(requestData);
                }

                if (!requestData) {
                    requestData = this._requests[requestId + 1];
                    if (doTraceClientRequestContent) {
                        console.log(" message was 2:", requestData ? requestData.request.toString() : "<null>");
                    }
                }
                // xx console.log(request_data.request.toString());
            });

        this.__in_normal_close_operation = false;

        this._timeout_request_count = 0;

        this._securityTokenTimeoutId = null;

        this.transportTimeout = options.transportTimeout || ClientSecureChannelLayer.defaultTransportTimeout;

        this.channelId = 0;

        this.connectionStrategy = coerceConnectionStrategy(options.connectionStrategy);
    }

    public getPrivateKey(): PrivateKeyPEM | null {
        return this.parent ? this.parent.getPrivateKey() : null;
    }

    public getCertificateChain(): Certificate | null {
        return this.parent ? this.parent.getCertificateChain() : null;
    }
    public getCertificate(): Certificate | null {
        return this.parent ? this.parent.getCertificate() : null;
    }

    public toString(): string {
        let str = "";
        str += "\n securityMode ............. : " + MessageSecurityMode[this.securityMode];
        str += "\n securityPolicy............ : " + this.securityPolicy;
        str += "\n securityToken ............ : " + (this.securityToken ? this.securityToken!.toString() : "null");
        str += "\n serverNonce  ............. : " + (this.serverNonce ? this.serverNonce.toString("hex") : "null");
        str += "\n clientNonce  ............. : " + (this.clientNonce ? this.clientNonce.toString("hex") : "null");
        str += "\n transportTimeout ......... : " + this.transportTimeout;
        str += "\n maxMessageSize (to send..) : " + (this._transport?.parameters?.maxMessageSize || "<not set>");
        str += "\n maxChunkCount  (to send..) : " + (this._transport?.parameters?.maxChunkCount || "<not set>");
        str += "\n receiveBufferSize(server)  : " + (this._transport?.parameters?.receiveBufferSize || "<not set>");
        str += "\n";
        return str;
    }

    public isTransactionInProgress(): boolean {
        return Object.keys(this._requests).length > 0;
    }

    public getClientNonce(): Buffer {
        return this.clientNonce;
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
     *    var secureChannel  = new ClientSecureChannelLayer({});
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
    public create(endpointUrl: string, callback: ErrorCallback) {
        assert(typeof callback === "function");

        if (this.securityMode !== MessageSecurityMode.None) {
            // istanbul ignore next
            if (!this.serverCertificate) {
                return callback(
                    new Error("ClientSecureChannelLayer#create : expecting a server certificate when securityMode is not None")
                );
            }

            // take the opportunity of this async method to perform some async pre-processing
            if (!this.receiverPublicKey) {
                extractPublicKeyFromCertificate(this.serverCertificate, (err: Error | null, publicKey?: PublicKeyPEM) => {
                    /* istanbul ignore next */
                    if (err) {
                        return callback(err);
                    }
                    /* istanbul ignore next */
                    if (!publicKey) {
                        throw new Error("Internal Error");
                    }
                    this.receiverPublicKey = publicKey;

                    this.create(endpointUrl, callback);
                });
                return;
            }
        }

        this.endpointUrl = endpointUrl;

        const transport = new ClientTCP_transport();
        transport.timeout = this.transportTimeout;

        debugLog("ClientSecureChannelLayer#create creating ClientTCP_transport with  transport.timeout = ", transport.timeout);
        assert(!this._pending_transport);
        this._pending_transport = transport;
        this._establish_connection(transport, endpointUrl, (err?: Error | null) => {
            if (err) {
                debugLog(chalk.red("cannot connect to server"));
                transport.dispose();
                return callback(err);
            }

            this._on_connection(transport, callback);
        });
    }

    public dispose() {
        this._isDisconnecting = true;
        this.abortConnection(() => {
            /* empty */
        });
        this._cancel_security_token_watchdog();
        if (this.__call) {
            this.__call.abort();
            this.__call = null;
        }
        if (this._transport) {
            this._transport.dispose();
            this._transport = undefined;
        }
        if (this._pending_transport) {
            this._pending_transport.dispose();
            this._pending_transport = undefined;
        }
    }

    public abortConnection(callback: ErrorCallback) {
        const self = this;
        this._isDisconnecting = true;
        debugLog("abortConnection ", !!this.__call);
        assert(typeof callback === "function");

        async.series(
            [
                (inner_callback: ErrorCallback) => {
                    if (this.__call) {
                        this.__call.once("abort", () => setTimeout(inner_callback, 20));
                        this.__call._cancelBackoff = true;
                        this.__call.abort();
                    } else {
                        inner_callback();
                    }
                },
                (inner_callback: ErrorCallback) => {
                    if (!self._pending_transport) {
                        return inner_callback();
                    }
                    self._pending_transport.disconnect(() => {
                        inner_callback();
                    });
                },
                (inner_callback: ErrorCallback) => {
                    if (!self._transport) {
                        return inner_callback();
                    }
                    self._transport.disconnect(() => {
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
    public performMessageTransaction(request: Request, callback: PerformTransactionCallback) {
        assert(typeof callback === "function");
        this._performMessageTransaction("MSG", request, callback);
    }

    public isValid(): boolean {
        if (!this._transport) {
            return false;
        }
        return this._transport.isValid();
    }

    public isOpened(): boolean {
        return this.isValid() && this._isOpened;
    }

    public getDisplayName(): string {
        if (!this.parent) {
            return "";
        }
        return "" + (this.parent.applicationName ? this.parent.applicationName + " " : "") + this.parent.clientName;
    }

    public cancelPendingTransactions(callback: ErrorCallback): void {
        assert(typeof callback === "function", "expecting a callback function, but got " + callback);

        // istanbul ignore next
        if (doDebug) {
            debugLog(
                "cancelPendingTransactions ",
                this.getDisplayName(),
                " = ",
                Object.keys(this._requests)
                    .map((k) => this._requests[k].request.constructor.name)
                    .join(" ")
            );
        }

        for (const key of Object.keys(this._requests)) {
            // kill timer id
            const transaction = this._requests[key];
            if (transaction.callback) {
                transaction.callback(new Error("Transaction has been canceled because client channel  is being closed"));
            }
        }
        setImmediate(callback);
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
            this._cancel_security_token_watchdog();

            debugLog("Sending CloseSecureChannelRequest to server");
            const request = new CloseSecureChannelRequest({});

            this.__in_normal_close_operation = true;

            if (!this._transport || this._transport.isDisconnecting) {
                this.dispose();
                return callback(new Error("Transport disconnected"));
            }
            this._performMessageTransaction("CLO", request, () => {
                this.dispose();
                callback();
            });
        });
    }

    public closeWithError(err: Error, callback: ErrorCallback): void {
        if (this._transport) {
            this._transport.prematureTerminate(err);
        }
        callback();
    }

    private on_transaction_completed(transactionStatistics: ClientTransactionStatistics) {
        /* istanbul ignore next */
        if (doTraceStatistics) {
            // dump some statistics about transaction ( time and sizes )
            _dump_client_transaction_statistics(transactionStatistics);
        }
        this.emit("end_transaction", transactionStatistics);
    }

    private _on_message_received(response: Response, msgType: string, requestId: number) {
        assert(msgType !== "ERR");

        /* istanbul ignore next */
        if (response.responseHeader.requestHandle !== requestId) {
            console.log(
                chalk.red.bgWhite.bold("xxxxx  <<<<<< _on_message_received  ERROR"),
                "requestId=",
                requestId,
                "response.responseHeader.requestHandle=",
                response.responseHeader.requestHandle,
                response.schema.name.padStart(30)
            );
        }

        /* istanbul ignore next */
        if (doTraceClientMessage) {
            traceClientResponseMessage(response, this.channelId, this._counter);
        }

        const requestData = this._requests[requestId];

        /* istanbul ignore next */
        if (!requestData) {
            console.log(
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
            requestData._tick2 = this._tick2;
        }

        delete this._requests[requestId];

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

        if (doPerfMonitoring) {
            // record tick2 : after response message has been received, before message processing
            requestData._tick2 = this.messageBuilder._tick1;
        }
        requestData.bytesRead = this.messageBuilder.totalMessageSize;

        if (doPerfMonitoring) {
            // record tick3 : after response message has been received, before message processing
            requestData._tick3 = get_clock_tick();
        }

        process_request_callback(requestData, null, response);

        if (doPerfMonitoring) {
            // record tick4 after callback
            requestData._tick4 = get_clock_tick();
        } // store some statistics
        this._record_transaction_statistics(requestData);

        // notify that transaction is completed
        this.on_transaction_completed(this.last_transaction_stats);
    }

    private _record_transaction_statistics(requestData: RequestData) {
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
            lap_processing_response: requestData._tick4 - requestData._tick3,
            lap_receiving_response: requestData._tick3 - requestData._tick2,
            lap_sending_request: requestData._tick1 - requestData._tick0,
            lap_transaction: requestData._tick4 - requestData._tick0,
            lap_waiting_response: requestData._tick2 - requestData._tick1,
            request,
            response
        };

        if (doTraceStatistics) {
            _dump_client_transaction_statistics(this.last_transaction_stats);
        }
    }

    private _cancel_pending_transactions(err?: Error | null) {
        if (doDebug && this._requests) {
            debugLog(
                "_cancel_pending_transactions  ",
                Object.keys(this._requests),
                this._transport ? this._transport.name : "no transport"
            );
        }

        if (this._requests) {
            for (const requestData of Object.values(this._requests)) {
                if (requestData) {
                    const request = requestData.request;
                    debugLog("Cancelling pending transaction ", requestData.key, requestData.msgType, request?.schema.name);
                    process_request_callback(requestData, err);
                }
            }
        }

        this._requests = {};
    }

    private _on_transport_closed(err?: Error| null) {
        debugLog(" =>ClientSecureChannelLayer#_on_transport_closed  err=", err ? err.message : "null");

        if (this.__in_normal_close_operation) {
            err = undefined;
        }
        /**
         * notify the observers that the transport connection has ended.
         * The error object is null or undefined if the disconnection was initiated by the ClientSecureChannelLayer.
         * A Error object is provided if the disconnection has been initiated by an external cause.
         *
         * @event close
         * @param err
         */
        this.emit("close", err);

        //
        this._bytesRead += this._transport?.bytesRead || 0;
        this._bytesWritten += this._transport?.bytesWritten || 0;

        this._transport?.dispose();
        this._transport = undefined;
        this._cancel_pending_transactions(err);
        this._cancel_security_token_watchdog();
        this.dispose();
    }

    private _on_security_token_about_to_expire() {
        if (!this.securityToken) {
            return;
        }

        debugLog(" client: Security Token ", this.securityToken.tokenId, " is about to expired, let's raise lifetime_75 event ");

        /**
         * notify the observer that the secure channel has now reach 75% of its allowed live time and
         * that a new token is going to be requested.
         * @event  lifetime_75
         * @param  securityToken {Object} : the security token that is about to expire.
         *
         */
        this.emit("lifetime_75", this.securityToken);
        this._renew_security_token();
    }

    private _cancel_security_token_watchdog() {
        if (this._securityTokenTimeoutId) {
            clearTimeout(this._securityTokenTimeoutId);
            this._securityTokenTimeoutId = null;
        }
    }

    private _install_security_token_watchdog() {
        if (!this.securityToken) {
            errorLog("Failed to install security token watch dog before securityToken is null!");
            return;
        }

        // install timer event to raise a 'lifetime_75' when security token is about to expired
        // so that client can request for a new security token
        // note that, for speedup in test,
        // it is possible to tweak this interval for test by specifying a tokenRenewalInterval value
        //
        const lifeTime = this.securityToken.revisedLifetime;
        assert(lifeTime !== 0 && lifeTime > 20);
        const percent = 75 / 100.0;
        let timeout = this.tokenRenewalInterval || lifeTime * percent;
        timeout = Math.min(timeout, (lifeTime * 75) / 100);
        timeout = Math.max(timeout, 50); // at least one half second !

        if (doDebug) {
            debugLog(
                chalk.red.bold(" time until next security token renewal = "),
                timeout,
                "( lifetime = ",
                lifeTime + " -  tokenRenewalInterval =" + this.tokenRenewalInterval
            );
        }
        assert(this._securityTokenTimeoutId === null);
        // security token renewal should happen without overlapping
        this._securityTokenTimeoutId = setTimeout(() => {
            this._securityTokenTimeoutId = null;
            this._on_security_token_about_to_expire();
        }, timeout);
    }

    private _build_client_nonce() {
        if (this.securityMode === MessageSecurityMode.None) {
            return null;
        }
        // create a client Nonce if secure mode is requested
        // Release 1.02 page 23 OPC Unified Architecture, Part 4 Table 7 – OpenSecureChannel Service Parameters
        // clientNonce
        // "This parameter shall have a length equal to key size used for the symmetric
        //  encryption algorithm that is identified by the securityPolicyUri"

        const cryptoFactory = getCryptoFactory(this.securityPolicy);
        if (!cryptoFactory) {
            // this securityPolicy may not be support yet ... let's return null
            return null;
        }
        assert(cryptoFactory !== null && typeof cryptoFactory === "object");
        return randomBytes(cryptoFactory.symmetricKeyLength);
    }

    private _open_secure_channel_request(isInitial: boolean, callback: ErrorCallback) {
        assert(this.securityMode !== MessageSecurityMode.Invalid, "invalid security mode");
        // from the specs:
        // The OpenSecureChannel Messages are not signed or encrypted if the SecurityMode is None. The
        // nonces  are ignored and should be set to null. The SecureChannelId and the TokenId are still
        // assigned but no security is applied to Messages exchanged via the channel.

        const msgType = "OPN";
        const requestType = isInitial ? SecurityTokenRequestType.Issue : SecurityTokenRequestType.Renew;

        this.clientNonce = this._build_client_nonce();

        this._isOpened = !isInitial;

        // OpenSecureChannel
        const msg = new OpenSecureChannelRequest({
            clientNonce: this.clientNonce, //
            clientProtocolVersion: this.protocolVersion,
            requestHeader: {
                auditEntryId: null
            },
            requestType: requestType,
            requestedLifetime: this.defaultSecureTokenLifetime,
            securityMode: this.securityMode
        });

        this._performMessageTransaction(msgType, msg, (err?: Error | null, response?: Response) => {
            // istanbul ignore next
            if (response && response.responseHeader && response.responseHeader.serviceResult !== StatusCodes.Good) {
                warningLog(
                    "xxxxx => response.responseHeader.serviceResult ",
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

                assert(
                    openSecureChannelResponse.securityToken.tokenId > 0 || msgType === "OPN",
                    "_sendSecureOpcUARequest: invalid token Id "
                );
                assert(openSecureChannelResponse.hasOwnProperty("serverNonce"));
                this.securityToken = openSecureChannelResponse.securityToken;
                this.serverNonce = openSecureChannelResponse.serverNonce;

                if (this.securityMode !== MessageSecurityMode.None) {
                    // verify that server nonce if provided is at least 32 bytes long

                    /* istanbul ignore next */
                    if (!openSecureChannelResponse.serverNonce) {
                        console.log(" client : server nonce is invalid !");
                        return callback(new Error(" Invalid server nonce"));
                    }
                    // This parameter shall have a length equal to key size used for the symmetric
                    // encryption algorithm that is identified by the securityPolicyUri.
                    if (openSecureChannelResponse.serverNonce.length !== this.clientNonce.length) {
                        console.log(" client : server nonce is invalid !");
                        return callback(new Error(" Invalid server nonce length"));
                    }
                }

                const cryptoFactory = this.messageBuilder.cryptoFactory;
                if (cryptoFactory) {
                    assert(this.serverNonce instanceof Buffer);
                    /* istanbul ignore next */
                    if (!this.serverNonce) {
                        throw new Error("internal error");
                    }
                    this.derivedKeys = computeDerivedKeys(cryptoFactory, this.serverNonce, this.clientNonce);
                }

                const derivedServerKeys = this.derivedKeys ? this.derivedKeys.derivedServerKeys : null;

                if (doDebug) {
                    debugLog("Server has send a new security Token");
                }
                this.messageBuilder.pushNewToken(this.securityToken, derivedServerKeys);

                this._install_security_token_watchdog();

                this._isOpened = true;
            }
            callback(err || undefined);
        });
    }

    private _on_connection(transport: ClientTCP_transport, callback: ErrorCallback) {
        assert(this._pending_transport === transport);
        this._pending_transport = undefined;
        this._transport = transport;

        this._transport.on("message", (messageChunk: Buffer) => {
            /**
             * notify the observers that ClientSecureChannelLayer has received a message chunk
             * @event receive_chunk
             * @param message_chunk
             */
            this.emit("receive_chunk", messageChunk);
            this._on_receive_message_chunk(messageChunk);
        });

        this._transport.on("close", (err: Error|null) => this._on_transport_closed(err));

        this._transport.on("connection_break", () => {
            debugLog(chalk.red("Client => CONNECTION BREAK  <="));
            this._on_transport_closed(new Error("Connection Break"));
        });

        setImmediate(() => {
            debugLog(chalk.red("Client now sending OpenSecureChannel"));
            const isInitial = true;
            this._open_secure_channel_request(isInitial, callback);
        });
    }

    private _backoff_completion(
        err: Error | undefined,
        lastError: Error | undefined,
        transport: ClientTCP_transport,
        callback: ErrorCallback
    ) {
        if (this.__call) {
            // console log =
            transport.numberOfRetry = transport.numberOfRetry || 0;
            transport.numberOfRetry += this.__call.getNumRetries();
            this.__call.removeAllListeners();
            this.__call = null;

            if (err) {
                callback(lastError || err);
            } else {
                callback();
            }
        }
    }

    private _connect(transport: ClientTCP_transport, endpointUrl: string, _i_callback: ErrorCallback) {
        if (this.__call && this.__call._cancelBackoff) {
            return;
        }

        const on_connect = (err?: Error) => {
            debugLog("Connection => err", err ? err.message : "null");
            // force Backoff to fail if err is not ECONNRESET or ECONNREFUSED
            // this mean that the connection to the server has succeeded but for some reason
            // the server has denied the connection
            // the cause could be:
            //   - invalid protocol version specified by client
            //   - server going to shutdown
            //   - server too busy -
            //   - server shielding itself from a DDOS attack
            if (err) {
                let should_abort = this._isDisconnecting;

                if (err.message.match(/ECONNRESET/)) {
                    should_abort = true;
                }
                if (err.message.match(/BadProtocolVersionUnsupported/)) {
                    should_abort = true;
                }
                this.lastError = err;

                if (this.__call) {
                    // connection cannot be establish ? if not, abort the backoff process
                    if (should_abort) {
                        debugLog(" Aborting backoff process prematurely - err = ", err.message);
                        this.__call.abort();
                    } else {
                        debugLog(" backoff - keep trying - err = ", err.message);
                    }
                }
            }
            _i_callback(err);
        };

        transport.connect(endpointUrl, on_connect);
    }

    private _establish_connection(transport: ClientTCP_transport, endpointUrl: string, callback: ErrorCallback) {
        transport.protocolVersion = this.protocolVersion;

        this.lastError = undefined;

        if (this.connectionStrategy.maxRetry === 0) {
            debugLog(chalk.cyan("max Retry === 0 =>  No backoff required -> call the _connect function directly"));
            this.__call = 0;
            return this._connect(transport, endpointUrl, callback);
        }

        const connectFunc = (callback2: ErrorCallback) => {
            return this._connect(transport, endpointUrl, callback2);
        };
        const completionFunc = (err?: Error) => {
            return this._backoff_completion(err, this.lastError, transport, callback);
        };

        this.__call = backoff.call(connectFunc, completionFunc);

        if (this.connectionStrategy.maxRetry >= 0) {
            const maxRetry = Math.max(this.connectionStrategy.maxRetry, 1);
            debugLog(chalk.cyan("backoff will failed after "), maxRetry);
            this.__call.failAfter(maxRetry);
        } else {
            // retry will be infinite
            debugLog(chalk.cyan("backoff => starting a infinite retry"));
        }

        const onBackoffFunc = (retryCount: number, delay: number) => {
            debugLog(
                chalk.bgWhite.cyan(" Backoff #"),
                retryCount,
                "delay = ",
                delay,
                " ms",
                " maxRetry ",
                this.connectionStrategy.maxRetry
            );
            // Do something when backoff starts, e.g. show to the
            // user the delay before next reconnection attempt.
            /**
             * @event backoff
             * @param retryCount: number
             * @param delay: number
             */
            this.emit("backoff", retryCount, delay);
        };

        this.__call.on("backoff", onBackoffFunc);

        this.__call.on("abort", () => {
            debugLog(chalk.bgWhite.cyan(` abort #   after ${this.__call.getNumRetries()} retries.`));
            // Do something when backoff starts, e.g. show to the
            // user the delay before next reconnection attempt.
            /**
             * @event backoff
             */
            this.emit("abort");
            setImmediate(() => {
                this._backoff_completion(undefined, new Error("Connection abandoned"), transport, callback);
            });
        });

        this.__call.setStrategy(new backoff.ExponentialStrategy(this.connectionStrategy));
        this.__call.start();
    }

    private _renew_security_token() {
        debugLog("ClientSecureChannelLayer#_renew_security_token");

        if (!this.isValid()) {
            // this may happen if the communication has been closed by the client or the sever
            console.log("Invalid socket => Communication has been lost, cannot renew token");
            return;
        }

        const isInitial = false;
        this._open_secure_channel_request(isInitial, (err?: Error | null) => {
            /* istanbul ignore else */
            if (!err) {
                debugLog(" token renewed");
                /**
                 * notify the observers that the security has been renewed
                 * @event security_token_renewed
                 */
                this.emit("security_token_renewed");
            } else {
                debugLog("ClientSecureChannelLayer: Warning: securityToken hasn't been renewed -> err ", err);
                // XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX CHECK ME !!!
                this.closeWithError(new Error("Restarting because Request has timed out during OpenSecureChannel"), () => {
                    /* */
                });
            }
        });
    }

    private _on_receive_message_chunk(messageChunk: Buffer) {
        /* istanbul ignore next */
        if (doDebug1) {
            const _stream = new BinaryStream(messageChunk);
            const messageHeader = readMessageHeader(_stream);
            debugLog("CLIENT RECEIVED " + chalk.yellow(JSON.stringify(messageHeader) + ""));
            debugLog("\n" + hexDump(messageChunk));
            debugLog(messageHeaderToString(messageChunk));
        }
        this.messageBuilder.feed(messageChunk);
    }

    /**
     * @method makeRequestId
     * @return  newly generated request id
     * @private
     */
    private makeRequestId(): number {
        this._lastRequestId += 1;
        return this._lastRequestId;
    }

    /**
     * internal version of _performMessageTransaction.
     *
     * @method _performMessageTransaction
     * @private
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

    private _performMessageTransaction(msgType: string, request: Request, callback: PerformTransactionCallback) {
        assert(typeof callback === "function");

        if (!this.isValid()) {
            return callback(new Error("ClientSecureChannelLayer => Socket is closed !"));
        }

        let localCallback: PerformTransactionCallback | null = callback;

        let timeout = request.requestHeader.timeoutHint || ClientSecureChannelLayer.defaultTransactionTimeout;
        timeout = Math.max(ClientSecureChannelLayer.minTransactionTimeout, timeout);

        // adjust request timeout
        request.requestHeader.timeoutHint = timeout;

        /* istanbul ignore next */
        if (doDebug) {
            debugLog("Adjusted timeout = ", request.requestHeader.timeoutHint);
        }
        let timerId: any = null;

        let hasTimedOut = false;

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
                    this.securityToken ? this.securityToken!.tokenId : "x"
                );
            }
            if (response && doTraceClientRequestContent) {
                console.log(response.toString());
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
                /**
                 * notify the observers that a server response has been received on the channel
                 * @event  receive_response
                 * @param response {Object} the response object
                 */
                this.emit("receive_response", response);
            }
            assert(!err || err instanceof Error);

            delete this._requests[request.requestHeader.requestHandle];
            // invoke user callback if it has not been intercepted first ( by a abrupt disconnection for instance )
            try {
                localCallback.call(this, err, response);
            } catch (err1) {
                console.log("ERROR !!! callback has thrown en error ", err1);
                callback(err);
            } finally {
                localCallback = null;
            }
        };

        timerId = setTimeout(() => {
            timerId = null;
            debugLog(" Timeout .... waiting for response for ", request.constructor.name, request.requestHeader.toString());
            debugLog(" Timeout was ", timeout, "ms");
            hasTimedOut = true;
            modified_callback(new Error("Transaction has timed out ( timeout = " + timeout + " ms)"));
            this._timeout_request_count += 1;
            /**
             * notify the observer that the response from the request has not been
             * received within the timeoutHint specified
             * @event timed_out_request
             * @param message_chunk {Object}  the message chunk
             */
            this.emit("timed_out_request", request);

            // xx // XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX CHECK ME !!!
            // xx this.closeWithError(new Error("Restarting because Request has timed out (1)"), () => { });
        }, timeout);

        const transaction_data = {
            callback: modified_callback,
            msgType: msgType,
            request: request,
            timerId: timerId
        };

        this._internal_perform_transaction(transaction_data);
    }

    /**
     *
     * @param transactionData
     * @param transactionData.msgType
     * @param transactionData.request
     * @param transactionData.callback
     * @private
     */

    private _internal_perform_transaction(transactionData: TransactionData) {
        assert(typeof transactionData.callback === "function");

        if (!this._transport) {
            setTimeout(() => {
                transactionData.callback(new Error("Client not connected"));
            }, 100);
            return;
        }
        assert(this._transport, " must have a valid transport");

        const msgType = transactionData.msgType;
        const request = transactionData.request;

        assert(msgType.length === 3);
        // get a new requestId
        const requestHandle = this.makeRequestId();

        /* istanbul ignore next */
        if (request.requestHeader.requestHandle !== requestHandleNotSetValue) {
            console.log(
                chalk.bgRed.white("xxxxx   >>>>>> request has already been set with a requestHandle"),
                requestHandle,
                request.requestHeader.requestHandle,
                request.constructor.name
            );
            console.log(Object.keys(this._requests).join(" "));
            console.log(new Error("Investigate me"));
            process.exit(6);
        }

        request.requestHeader.requestHandle = requestHandle;

        /* istanbul ignore next */
        if (doTraceClientMessage) {
            traceClientRequestMessage(request, this.channelId, this._counter);
        }

        const requestData: RequestData = {
            callback: transactionData.callback,
            msgType: msgType,
            request: request,

            bytesRead: 0,
            bytesWritten_after: 0,
            bytesWritten_before: this.bytesWritten,

            _tick0: 0,
            _tick1: 0,
            _tick2: 0,
            _tick3: 0,
            _tick4: 0,
            key: "",

            chunk_count: 0
        };

        this._requests[requestHandle] = requestData;

        /* istanbul ignore next */
        if (doPerfMonitoring) {
            const stats = requestData;
            // record tick0 : before request is being sent to server
            stats._tick0 = get_clock_tick();
        }

        this._sendSecureOpcUARequest(msgType, request, requestHandle);
    }

    private _send_chunk(requestId: number, chunk: Buffer | null) {
        const requestData = this._requests[requestId];

        if (chunk) {
            /**
             * notify the observer that a message chunk is about to be sent to the server
             * @event send_chunk
             * @param message_chunk {Object}  the message chunk
             */
            this.emit("send_chunk", chunk);

            /* istanbul ignore next */
            if (checkChunks) {
                verify_message_chunk(chunk);
                debugLog(chalk.yellow("CLIENT SEND chunk "));
                debugLog(chalk.yellow(messageHeaderToString(chunk)));
                debugLog(chalk.red(hexDump(chunk)));
            }
            assert(this._transport);
            this._transport?.write(chunk);
            requestData.chunk_count += 1;
        } else {
            // last chunk ....

            /* istanbul ignore next */
            if (checkChunks) {
                debugLog(chalk.yellow("CLIENT SEND done."));
            }
            if (requestData) {
                if (doPerfMonitoring) {
                    requestData._tick1 = get_clock_tick();
                }
                requestData.bytesWritten_after = this.bytesWritten;
            }
        }
    }

    private _construct_security_header() {
        this.receiverCertificate = this.serverCertificate ? Buffer.from(this.serverCertificate) : null;
        let securityHeader = null;
        switch (this.securityMode) {
            case MessageSecurityMode.Sign:
            case MessageSecurityMode.SignAndEncrypt: {
                assert(this.securityPolicy !== SecurityPolicy.None);
                // get the thumbprint of the client certificate
                const receiverCertificateThumbprint = getThumbprint(this.receiverCertificate);

                securityHeader = new AsymmetricAlgorithmSecurityHeader({
                    receiverCertificateThumbprint, // thumbprint of the public key used to encrypt the message
                    securityPolicyUri: toURI(this.securityPolicy),

                    /**
                     * The X.509 v3 Certificate assigned to the sending application Instance.
                     *  This is a DER encoded blob.
                     * The structure of an X.509 v3 Certificate is defined in X.509 v3.
                     * The DER format for a Certificate is defined in X690
                     * This indicates what Private Key was used to sign the MessageChunk.
                     * The Stack shall close the channel and report an error to the application if the SenderCertificate is too large for the buffer size supported by the transport layer.
                     * This field shall be null if the Message is not signed.
                     * If the Certificate is signed by a CA, the DER encoded CA Certificate may be
                     * appended after the Certificate in the byte array. If the CA Certificate is also
                     * signed by another CA this process is repeated until the entire Certificate chain
                     *  is in the buffer or if MaxSenderCertificateSize limit is reached (the process
                     * stops after the last whole Certificate that can be added without exceeding
                     * the MaxSenderCertificateSize limit).
                     * Receivers can extract the Certificates from the byte array by using the Certificate
                     *  size contained in DER header (see X.509 v3).
                     */
                    senderCertificate: this.getCertificateChain() // certificate of the private key used to sign the message
                });

                if (dumpSecurityHeader) {
                    console.log("HEADER !!!! ", securityHeader.toString());
                }
                break;
            }
            default:
                /* istanbul ignore next */
                assert(false, "invalid security mode");
        }
        this.securityHeader = securityHeader;
    }

    private _get_security_options_for_OPN() {
        if (this.securityMode === MessageSecurityMode.None) {
            return null;
        }

        this._construct_security_header();
        this.messageChunker.securityHeader = this.securityHeader;

        const senderPrivateKey = this.getPrivateKey();

        if (!senderPrivateKey) {
            throw new Error("invalid senderPrivateKey");
        }

        const cryptoFactory = getCryptoFactory(this.securityPolicy);

        if (!cryptoFactory) {
            return null; // may be a not yet supported security Policy
        }

        assert(cryptoFactory, "expecting a cryptoFactory");
        assert(typeof cryptoFactory.asymmetricSign === "function");

        const options: any = {};

        options.signatureLength = rsa_length(senderPrivateKey);

        options.signBufferFunc = (chunk: Buffer) => {
            const s = cryptoFactory.asymmetricSign(chunk, senderPrivateKey);
            assert(s.length === options.signatureLength);
            return s;
        };

        // istanbul ignore next
        if (!this.receiverPublicKey) {
            throw new Error(" invalid receiverPublicKey");
        }
        const keyLength = rsa_length(this.receiverPublicKey);
        options.plainBlockSize = keyLength - cryptoFactory.blockPaddingSize;
        options.cipherBlockSize = keyLength;

        const receiverPublicKey = this.receiverPublicKey;
        options.encryptBufferFunc = (chunk: Buffer): Buffer => {
            return cryptoFactory.asymmetricEncrypt(chunk, receiverPublicKey);
        };

        return options;
    }

    private _get_security_options_for_MSG() {
        if (this.securityMode === MessageSecurityMode.None) {
            return null;
        }

        // istanbul ignore next
        if (!this.derivedKeys || !this.derivedKeys.derivedClientKeys) {
            throw new Error("internal error expecting valid derivedKeys");
        }

        const derivedClientKeys = this.derivedKeys.derivedClientKeys;
        assert(derivedClientKeys, "expecting valid derivedClientKeys");
        return getOptionsForSymmetricSignAndEncrypt(this.securityMode, derivedClientKeys);
    }

    private _sendSecureOpcUARequest(msgType: string, request: Request, requestId: number) {
        const tokenId = this.securityToken ? this.securityToken.tokenId : 0;

        // assert(this.channelId !== 0 , "channel Id cannot be null");

        let options: ChunkMessageOptions = {
            channelId: this.channelId,
            chunkSize: 0,
            requestId,
            tokenId,

            cipherBlockSize: 0,
            plainBlockSize: 0,
            sequenceHeaderSize: 0,
            signatureLength: 0
        };

        // use chunk size that has been negotiated by the transport layer
        if (this._transport?.parameters && this._transport?.parameters.sendBufferSize) {
            options.chunkSize = this._transport.parameters.sendBufferSize;
        }

        /* istanbul ignore next */
        if (request.requestHeader.requestHandle !== options.requestId) {
            debugLog(
                chalk.red.bold("------------------------------------- Invalid request id"),
                request.requestHeader.requestHandle,
                options.requestId
            );
        }

        request.requestHeader.returnDiagnostics = 0x0;

        /* istanbul ignore next */
        if (doTraceClientRequestContent) {
            console.log(
                chalk.yellow.bold("------------------------------------- Client Sending a request  "),
                request.constructor.name,
                "h=",
                request.requestHeader.requestHandle,
                " channel id ",
                this.channelId,
                " securityToken=",
                this.securityToken! ? this.securityToken!.tokenId : "x"
            );
        }
        if (doTraceClientRequestContent) {
            console.log(request.toString());
        }

        const security_options = msgType === "OPN" ? this._get_security_options_for_OPN() : this._get_security_options_for_MSG();
        if (security_options) {
            options = {
                ...options,
                ...security_options
            };
        }

        /**
         * notify the observer that a client request is being sent the server
         * @event send_request
         * @param request {Request}
         */
        this.emit("send_request", request);

        this.messageChunker.chunkSecureMessage(msgType, options, request as BaseUAObject, (chunk: Buffer | null) =>
            this._send_chunk(requestId, chunk)
        );
    }
}
