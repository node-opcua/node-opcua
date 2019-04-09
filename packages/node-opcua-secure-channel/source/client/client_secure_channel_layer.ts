/**
 * @module node-opcua-secure-channel
 */
// tslint:disable:variable-name
// tslint:disable:object-literal-shorthand
// tslint:disable:no-console
// tslint:disable:no-var-requires
// tslint:disable:max-line-length
import chalk from "chalk";
import { randomBytes } from "crypto";
import { EventEmitter } from "events";
import * as  _ from "underscore";

import {
    Certificate,
    convertPEMtoDER,
    extractPublicKeyFromCertificate,
    makeSHA1Thumbprint,
    Nonce,
    PrivateKey,
    PrivateKeyPEM,
    PublicKey,
    PublicKeyPEM,
    rsa_length
} from "node-opcua-crypto";

import { assert } from "node-opcua-assert";

import { BinaryStream } from "node-opcua-binary-stream";
import { get_clock_tick } from "node-opcua-utils";

import { readMessageHeader, verify_message_chunk } from "node-opcua-chunkmanager";
import { checkDebugFlag, hexDump, make_debugLog } from "node-opcua-debug";
import {
    coerceMessageSecurityMode,
    MessageSecurityMode
} from "node-opcua-service-secure-channel";
import { StatusCodes } from "node-opcua-status-code";
import { ClientTCP_transport } from "node-opcua-transport";

import {
    BaseUAObject
} from "node-opcua-factory";
import { MessageBuilder, SecurityToken } from "../message_builder";
import { ChunkMessageOptions, MessageChunker } from "../message_chunker";
import { messageHeaderToString } from "../message_header_to_string";
import {
    coerceSecurityPolicy,
    computeDerivedKeys,
    DerivedKeys1,
    getCryptoFactory,
    getOptionsForSymmetricSignAndEncrypt,
    SecurityPolicy, toURI
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
const backoff = require("backoff");

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const checkChunks = false;

const doTraceMessage = process.env.DEBUG && (process.env.DEBUG.indexOf("TRACE")) >= 0;
const doTraceStatistics = process.env.DEBUG && (process.env.DEBUG.indexOf("STATS")) >= 0;
const doPerfMonitoring = false;

import { ErrorCallback, ICertificateKeyPairProvider, Request, Response } from "../common";

const minTransactionTimeout = 30 * 1000;    // 30 sec
const defaultTransactionTimeout = 60 * 1000; // 1 minute

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

    assert(_.isFunction(requestData.callback));

    if (!response && !err && requestData.msgType !== "CLO") {
        // this case happens when CLO is called and when some pending transactions
        // remains in the queue...
        err = new Error(" Connection has been closed by client , but this transaction cannot be honored");
    }
    if (response && response instanceof ServiceFault) {

        response.responseHeader.stringTable = response.responseHeader.stringTable || [];
        response.responseHeader.stringTable = [response.responseHeader.stringTable.join("\n")];
        err = new Error(" ServiceFault returned by server " + response.toString() + " request = " + requestData.request.toString());
        (err as any).response = response;
        response = undefined;
    }

    const theCallbackFunction = requestData.callback;
    if (!theCallbackFunction) {
        throw new Error("Internal error");
    }
    assert((requestData.msgType === "CLO") || ((err && !response) || (!err && response)));

    // let set callback to undefined to prevent callback to be called again
    requestData.callback = undefined;

    theCallbackFunction(err, (!err && response !== null) ? response : undefined);

}

interface ClientTransactionStatistics {
    dump: () => void;
    request: Request;
    response: Response;
    bytesRead: number;
    bytesWritten: number;
    lap_transaction: number;
    lap_sending_request: number;
    lap_waiting_response: number;
    lap_receiving_response: number;
    lap_processing_response: number;
}

function _dump_transaction_statistics(stats: ClientTransactionStatistics) {

    function w(str: string | number) {
        return ("                  " + str).substr(-12);
    }

    console.log(chalk.green.bold("--------------------------------------------------------------------->> Stats"));
    console.log("   request                   : ",
      chalk.yellow(stats.request.schema.name.toString()), " / ",
      chalk.yellow(stats.response.schema.name.toString()), " - ",
      stats.response.responseHeader.serviceResult.toString());
    console.log("   Bytes Read                : ", w(stats.bytesRead), " bytes");
    console.log("   Bytes Written             : ", w(stats.bytesWritten), " bytes");
    console.log("   transaction duration      : ", w(stats.lap_transaction.toFixed(3)), " milliseconds");
    console.log("   time to send request      : ", w((stats.lap_sending_request).toFixed(3)), " milliseconds");
    console.log("   time waiting for response : ", w((stats.lap_waiting_response).toFixed(3)), " milliseconds");
    console.log("   time to receive response  : ", w((stats.lap_receiving_response).toFixed(3)), " milliseconds");
    console.log("   time processing response  : ", w((stats.lap_processing_response).toFixed(3)), " milliseconds");
    console.log(chalk.green.bold("---------------------------------------------------------------------<< Stats"));

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

    const maxRetry: number = (options.maxRetry === undefined) ? 10 : options.maxRetry;
    const initialDelay = options.initialDelay || 10;
    const maxDelay = options.maxDelay || 10000;
    const randomisationFactor = (options.randomisationFactor === undefined) ? 0 : options.randomisationFactor;

    return {
        initialDelay, maxDelay, maxRetry, randomisationFactor
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

    /* OPCUClientBase */
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

    /**
     * true if the secure channel is trying to establish the connection with the server. In this case, the client
     * may be in the middle of the b ackoff connection process.
     *
     */
    public get isConnecting(): boolean {
        return (!!this.__call);
    }

    get bytesRead(): number {
        return this._transport ? this._transport.bytesRead : 0;
    }

    get bytesWritten(): number {
        return this._transport ? this._transport.bytesWritten : 0;
    }

    get transactionsPerformed(): number {
        return this._lastRequestId;
    }

    get timedOutRequestCount(): number {
        return this._timedout_request_count;
    }

    public static defaultTransportTimeout = 60 * 1000; // 1 minute

    public protocolVersion: number;
    public readonly securityMode: MessageSecurityMode;
    public readonly securityPolicy: SecurityPolicy;
    public endpointUrl: string;

    private _lastRequestId: number;
    private _transport: any;
    private readonly parent: ClientSecureChannelParent;

    private clientNonce: any;
    private readonly messageChunker: MessageChunker;
    private readonly defaultSecureTokenLifetime: number;
    private readonly tokenRenewalInterval: number;
    private readonly serverCertificate: Certificate | null;
    private readonly messageBuilder: MessageBuilder;

    private _requests: { [key: string]: RequestData };

    private __in_normal_close_operation: boolean;
    private _timedout_request_count: number;
    private _securityTokenTimeoutId: NodeJS.Timer | null;
    private readonly transportTimeout: number;
    private channelId: number;
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
        this._transport = null;
        this._lastRequestId = 0;
        this.parent = options.parent;
        this.clientNonce = null; // will be created when needed

        this.protocolVersion = 0;

        this.messageChunker = new MessageChunker({
            derivedKeys: null
        });

        this.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 30000;
        this.tokenRenewalInterval = options.tokenRenewalInterval || 0;

        this.securityMode = coerceMessageSecurityMode(options.securityMode);

        this.securityPolicy = coerceSecurityPolicy(options.securityPolicy);

        this.serverCertificate = options.serverCertificate ? options.serverCertificate : null;

        if (this.securityMode !== MessageSecurityMode.None) {
            assert(this.serverCertificate as any instanceof Buffer,
              "Expecting a valid certificate when security mode is not None");
            assert(this.securityPolicy !== SecurityPolicy.None,
              "Security Policy None is not a valid choice");
        }

        this.messageBuilder = new MessageBuilder({
            name: "client",
            privateKey: this.getPrivateKey() || undefined,
            securityMode: this.securityMode
        });
        this._requests = {};

        this.messageBuilder
          .on("message", (response: any, msgType: string, requestId: number) =>
            this._on_message_received(response, msgType, requestId)
          )
          .on("start_chunk", () => {
              // record tick2: when the first response chunk is received
              // request_data._tick2 = get_clock_tick();
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
                  debugLog(" message was 2:", requestData ? requestData.request.toString() : "<null>");
              }
              // xx console.log(request_data.request.toString());
          });

        this.__in_normal_close_operation = false;

        this._timedout_request_count = 0;

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

    public isTransactionInProgress(): boolean {
        return Object.keys(this._requests).length > 0;
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

        assert(_.isFunction(callback));

        if (this.securityMode !== MessageSecurityMode.None) {

            if (!this.serverCertificate) {
                return callback(new Error("ClientSecureChannelLayer#create : expecting a  server certificate when securityMode is not None"));
            }

            // take the opportunity of this async method to perform some async pre-processing
            if (!this.receiverPublicKey) {

                extractPublicKeyFromCertificate(this.serverCertificate, (err: Error | null, publicKey?: PublicKeyPEM) => {
                    /* istanbul ignore next */
                    if (err) {
                        return callback(err);
                    }
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

        this._establish_connection(
          transport,
          endpointUrl,
          (err?: Error) => {

              if (err) {
                  debugLog(chalk.red("cannot connect to server"));
                  transport.dispose();
                  return callback(err);
              }

              this._on_connection(transport, callback);

          }
        );

    }

    public dispose() {
        this._cancel_security_token_watchdog();
        if (this.__call) {
            this.__call.abort();
        }
    }

    public abortConnection(callback: ErrorCallback) {
        assert(_.isFunction(callback));
        if (this.__call) {
            this.__call.once("abort", () => setTimeout(callback, 20));
            this.__call._cancelBackoff = true;
            this.__call.abort();
        } else {
            callback();
        }
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
        assert(_.isFunction(callback));
        this._performMessageTransaction("MSG", request, callback);
    }

    public isValid(): boolean {
        return this._transport !== null && this._transport.isValid();
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
        assert(_.isFunction(callback), "expecting a callback function, but got " + callback);

        // istanbul ignore next
        if (doDebug) {
            debugLog(" PENDING TRANSACTION = ",
              this.getDisplayName(),
              Object.keys(this._requests)
                .map((k) => this._requests[k].request.constructor.name).join(""));
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

        assert(_.isFunction(callback), "expecting a callback function, but got " + callback);

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

            if (!this._transport || this._transport.__disconnecting__) {
                this.dispose();
                return callback(new Error("Transport disconnected"));
            }
            this._performMessageTransaction("CLO", request, () => {
                this.dispose();
                callback();
            });
        });
    }

    private on_transaction_completed(transactionStatistics: ClientTransactionStatistics) {
        /* istanbul ignore next */
        if (doDebug) {
            // dump some statistics about transaction ( time and sizes )
            _dump_transaction_statistics(transactionStatistics);
        }
        this.emit("end_transaction", transactionStatistics);
    }

    private _on_message_received(response: Response, msgType: string, requestId: number) {

        assert(msgType !== "ERR");

        /* istanbul ignore next */
        if (doTraceMessage) {
            console.log(chalk.cyan.bold("xxxxx  <<<<<< _on_message_received "), requestId, response.schema.name);
        }

        const requestData = this._requests[requestId];

        if (!requestData) {
            console.log(chalk.cyan.bold("xxxxx  <<<<<< _on_message_received "), requestId, response.schema.name);
            throw new Error(" =>  invalid requestId =" + requestId);
        }

        debugLog(" Deleting self._request_data", requestId);
        delete this._requests[requestId];

        /* istanbul ignore next */
        if (response.responseHeader.requestHandle !== requestData.request.requestHeader.requestHandle) {
            const expected = requestData.request.requestHeader.requestHandle;
            const actual = response.responseHeader.requestHandle;
            const moreInfo = "Class = " + response.schema.name;
            console.log(chalk.red.bold(" WARNING SERVER responseHeader.requestHandle is invalid" +
              ": expecting 0x" + expected.toString(16) +
              "  but got 0x" + actual.toString(16) + " "), chalk.yellow(moreInfo));
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
        }    // store some statistics
        this._record_transaction_statistics(requestData);

        // notify that transaction is completed
        this.on_transaction_completed(this.last_transaction_stats);

    }

    private _record_transaction_statistics(requestData: RequestData) {

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
            request: requestData.request,
            response: requestData.response
        };

        if (doTraceStatistics) {
            _dump_transaction_statistics(this.last_transaction_stats);
        }
    }

    private _cancel_pending_transactions(err?: Error) {

        if (doDebug && this._requests) {
            debugLog("_cancel_pending_transactions  ",
              Object.keys(this._requests),
              this._transport ? this._transport.name : "no transport");
        }

        assert(err === null || err === undefined || _.isObject(err), "expecting valid error");

        if (this._requests) {

            Object.keys(this._requests).forEach((key: string) => {
                const requestData = this._requests[key];
                debugLog("Cancelling pending transaction ",
                  requestData.key, requestData.msgType,
                  requestData.request.schema.name);
                process_request_callback(requestData, err);
            });
        }

        this._requests = {};

    }

    private _on_transport_closed(err?: Error) {

        debugLog(" =>ClientSecureChannelLayer#_on_transport_closed");

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
        this._cancel_pending_transactions(err);
        this._transport = null;
    }

    private _on_security_token_about_to_expire() {

        if (!this.securityToken) {
            return;
        }

        debugLog(" client: Security Token ", this.securityToken.tokenId,
          " is about to expired, let's raise lifetime_75 event ");

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
        timeout = Math.min(timeout, lifeTime * 75 / 100);
        timeout = Math.max(timeout, 50); // at least one half second !

        if (doDebug) {
            debugLog(chalk.red.bold(" time until next security token renewal = "),
              timeout, "( lifetime = ", lifeTime + ") + tokenRenewalInterval" + this.tokenRenewalInterval);
        }
        assert(this._securityTokenTimeoutId === null);
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
        assert(_.isObject(cryptoFactory));
        return randomBytes(cryptoFactory.symmetricKeyLength);

    }

    private _open_secure_channel_request(isInitial: boolean, callback: ErrorCallback) {

        assert(this.securityMode !== MessageSecurityMode.Invalid, "invalid security mode");
        // from the specs:
        // The OpenSecureChannel Messages are not signed or encrypted if the SecurityMode is None. The
        // nonces  are ignored and should be set to null. The SecureChannelId and the TokenId are still
        // assigned but no security is applied to Messages exchanged via the channel.

        const msgType = "OPN";
        const requestType = (isInitial) ? SecurityTokenRequestType.Issue : SecurityTokenRequestType.Renew;

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

            if (response && response.responseHeader && response.responseHeader.serviceResult !== StatusCodes.Good) {
                err = new Error(response.responseHeader.serviceResult.toString());
            }
            if (!err && response) {

                const openSecureChannelResponse = response as OpenSecureChannelResponse;

                // record channelId for future transactions
                this.channelId = openSecureChannelResponse.securityToken.channelId;

                // todo : verify that server certificate is  valid
                // A self-signed application instance certificate does not need to be verified with a CA.
                // todo : verify that Certificate URI matches the ApplicationURI of the server

                assert(openSecureChannelResponse.securityToken.tokenId > 0 || msgType === "OPN",
                  "_sendSecureOpcUARequest: invalid token Id ");
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

        this._transport.on("close", (err: Error) => this._on_transport_closed(err));

        this._transport.on("connection_break", () => {
            debugLog(chalk.red("Client => CONNECTION BREAK  <="));
            this._on_transport_closed(new Error("Connection Break"));
        });

        this._transport.on("error", (err: Error) => {
            debugLog(" ERROR", err);
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
            // force Backoff to fail if err is not ECONNRESET or ECONNREFUSE
            // this mean that the connection to the server has succeeded but for some reason
            // the server has denied the connection
            // the cause could be:
            //   - invalid protocol version specified by client
            //   - server going to shutdown
            //   - server too busy -
            //   - server shielding itself from a DDOS attack
            if (err) {

                let should_abort = false;

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
                        debugLog(" Aborting backoff process prematurally - err = ", err.message);
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

    private _establish_connection(
      transport: ClientTCP_transport,
      endpointUrl: string,
      callback: ErrorCallback) {

        transport.protocolVersion = this.protocolVersion;

        this.lastError = undefined;

        if (this.connectionStrategy.maxRetry === 0) {
            debugLog(chalk.cyan("max Retry === 1 =>  No backoff required -> call the _connect function directly"));
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
            debugLog(chalk.bgWhite.cyan(" Backoff #"), retryCount, "delay = ", delay,
              " ms" , " maxRetry ", this.connectionStrategy.maxRetry);
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
        this._open_secure_channel_request(isInitial, (err?: Error) => {

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
            }
        });
    }

    private _on_receive_message_chunk(messageChunk: Buffer) {

        /* istanbul ignore next */
        if (doDebug) {
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

        assert(_.isFunction(callback));

        if (!this.isValid()) {
            return callback(new Error("ClientSecureChannelLayer => Socket is closed !"));
        }

        let localCallback: PerformTransactionCallback | null = callback;

        let timeout = request.requestHeader.timeoutHint || defaultTransactionTimeout;
        timeout = Math.max(minTransactionTimeout, timeout);

        let timerId: any = null;

        let hasTimedOut = false;

        const modified_callback = (err?: Error | null, response?: Response) => {

            /* istanbul ignore next */
            if (doDebug) {
                debugLog(chalk.cyan("------------------- client receiving response"), err);
                if (response) {
                    debugLog(response.toString());
                }
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
            assert(!err || (err instanceof Error));

            // invoke user callback if it has not been intercepted first ( by a abrupt disconnection for instance )
            try {
                localCallback.call(this, err, response);
            } catch (err) {
                console.log("ERROR !!! , please check here !!!! callback may be called twice !! ", err);
                callback(err);
            } finally {
                localCallback = null;
            }
        };

        timerId = setTimeout(() => {
            timerId = null;
            console.log(" Timeout .... waiting for response for ", request.constructor.name, request.requestHeader.toString());
            hasTimedOut = true;
            modified_callback(new Error("Transaction has timed out ( timeout = " + timeout + " ms)"));
            this._timedout_request_count += 1;
            /**
             * notify the observer that the response from the request has not been
             * received within the timeoutHint specified
             * @event timed_out_request
             * @param message_chunk {Object}  the message chunk
             */
            this.emit("timed_out_request", request);

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

        assert(_.isFunction(transactionData.callback));

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
        const requestId = this.makeRequestId();

        /* istanbul ignore next */
        if (doTraceMessage) {
            console.log(chalk.cyan("xxxxx   >>>>>>                     "), requestId, request.schema.name);
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

        this._requests[requestId] = requestData;
        if (doPerfMonitoring) {
            const stats = requestData;
            // record tick0 : before request is being sent to server
            stats._tick0 = get_clock_tick();
        }

        this._sendSecureOpcUARequest(msgType, request, requestId);

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
            if (doDebug && checkChunks) {
                verify_message_chunk(chunk);
                debugLog(chalk.yellow("CLIENT SEND chunk "));
                debugLog(chalk.yellow(messageHeaderToString(chunk)));
                debugLog(chalk.red(hexDump(chunk)));
            }
            assert(this._transport);
            this._transport.write(chunk);
            requestData.chunk_count += 1;

        } else {
            // last chunk ....

            /* istanbul ignore next */
            if (doDebug) {
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

        assert(this.hasOwnProperty("securityMode"));
        assert(this.hasOwnProperty("securityPolicy"));
        this.receiverCertificate = this.serverCertificate ? Buffer.from(this.serverCertificate) : null;

        let securityHeader = null;
        switch (this.securityMode) {
            case MessageSecurityMode.Sign:
            case MessageSecurityMode.SignAndEncrypt: {

                assert(this.securityPolicy !== SecurityPolicy.None);
                // get the thumbprint of the client certificate
                const thumbprint = this.receiverCertificate ? makeSHA1Thumbprint(this.receiverCertificate) : null;
                securityHeader = new AsymmetricAlgorithmSecurityHeader({
                    receiverCertificateThumbprint: thumbprint,       // thumbprint of the public key used to encrypt the message
                    securityPolicyUri: toURI(this.securityPolicy),
                    senderCertificate: this.getCertificateChain()  // certificate of the private key used to sign the message
                });

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
        assert(_.isFunction(cryptoFactory.asymmetricSign));

        const options: any = {};

        options.signatureLength = rsa_length(senderPrivateKey);

        options.signBufferFunc = (chunk: Buffer) => {
            const s = cryptoFactory.asymmetricSign(chunk, senderPrivateKey);
            assert(s.length === options.signatureLength);
            return s;
        };

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

        const options: ChunkMessageOptions = {
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
        if (this._transport.parameters && this._transport.parameters.sendBufferSize) {
            options.chunkSize = this._transport.parameters.sendBufferSize;
        }

        request.requestHeader.requestHandle = options.requestId;

        request.requestHeader.returnDiagnostics = 0x0;

        /* istanbul ignore next */
        if (doDebug) {
            debugLog(chalk.yellow.bold("------------------------------------- Client Sending a request"));
            debugLog(" CHANNEL ID ", this.channelId);
            debugLog(request.toString());
        }

        const security_options = (msgType === "OPN") ? this._get_security_options_for_OPN() : this._get_security_options_for_MSG();
        _.extend(options, security_options);

        /**
         * notify the observer that a client request is being sent the server
         * @event send_request
         * @param request {Request}
         */
        this.emit("send_request", request);

        this.messageChunker.chunkSecureMessage(msgType, options, request as BaseUAObject, (chunk: Buffer | null) =>
          this._send_chunk(requestId, chunk));

    }
}
