/* eslint-disable max-statements */
/**
 * @module node-opcua-secure-channel
 */
import * as crypto from "crypto";
import { EventEmitter } from "events";
import { Socket } from "net";
import { callbackify } from "util";
import * as chalk from "chalk";

import { assert } from "node-opcua-assert";
import {
    Certificate,
    exploreCertificateInfo,
    extractPublicKeyFromCertificate,
    makeSHA1Thumbprint,
    PrivateKeyPEM,
    PublicKeyLength,
    rsa_length,
    exploreCertificate,
    hexDump
} from "node-opcua-crypto";

import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
import { BaseUAObject } from "node-opcua-factory";
import { analyze_object_binary_encoding } from "node-opcua-packet-analyzer";
import {
    ChannelSecurityToken,
    hasTokenExpired,
    MessageSecurityMode,
    SymmetricAlgorithmSecurityHeader
} from "node-opcua-service-secure-channel";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { ServerTCP_transport, StatusCodes2 } from "node-opcua-transport";
import { get_clock_tick, timestamp } from "node-opcua-utils";
import { Callback2, ErrorCallback } from "node-opcua-status-code";

import { EndpointDescription } from "node-opcua-service-endpoints";
import { ICertificateManager } from "node-opcua-certificate-manager";
import { ObjectRegistry } from "node-opcua-object-registry";
import { doTraceIncomingChunk } from "node-opcua-transport";

import { SecureMessageChunkManagerOptions, SecurityHeader } from "../secure_message_chunk_manager";

import { getThumbprint, ICertificateKeyPairProvider, Request, Response } from "../common";
import { MessageBuilder, ObjectFactory } from "../message_builder";
import { ChunkMessageOptions, MessageChunker } from "../message_chunker";
import {
    computeDerivedKeys,
    DerivedKeys1,
    fromURI,
    getOptionsForSymmetricSignAndEncrypt,
    SecureMessageChunkManagerOptionsPartial,
    SecurityPolicy
} from "../security_policy";

import {
    AsymmetricAlgorithmSecurityHeader,
    OpenSecureChannelRequest,
    OpenSecureChannelResponse,
    SecurityTokenRequestType,
    ServiceFault
} from "../services";

import {
    doPerfMonitoring,
    doTraceServerMessage,
    ServerTransactionStatistics,
    traceRequestMessage,
    traceResponseMessage,
    _dump_transaction_statistics
} from "../utils";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const warningLog = make_warningLog(__filename);

let gLastChannelId = 0;

function getNextChannelId() {
    gLastChannelId += 1;
    return gLastChannelId;
}

export interface ServerSecureChannelParent extends ICertificateKeyPairProvider {
    certificateManager: ICertificateManager;

    getCertificate(): Certificate;

    getCertificateChain(): Certificate;

    getPrivateKey(): PrivateKeyPEM;

    getEndpointDescription(
        securityMode: MessageSecurityMode,
        securityPolicy: SecurityPolicy,
        endpointUri: string | null
    ): EndpointDescription | null;
}

export interface ServerSecureChannelLayerOptions {
    parent: ServerSecureChannelParent;
    /**
     * timeout in milliseconds [default = 30000]
     */
    timeout?: number;
    /**
     * default secure token life time in milliseconds [default = 300000]
     */
    defaultSecureTokenLifetime?: number;
    objectFactory?: ObjectFactory;
}

export interface IServerSession {
    keepAlive?: () => void;
    status: string;
    incrementTotalRequestCount(): void;
    incrementRequestErrorCounter(counterName: string): void;
    incrementRequestTotalCounter(counterName: string): void;
}
export interface Message {
    request: Request;
    requestId: number;
    securityHeader?: SecurityHeader;
    channel?: ServerSecureChannelLayer;
    session?: IServerSession;
    session_statusCode?: StatusCode;
}

function isValidSecurityPolicy(securityPolicy: SecurityPolicy) {
    switch (securityPolicy) {
        case SecurityPolicy.None:
        case SecurityPolicy.Basic128Rsa15:
        case SecurityPolicy.Basic256:
        case SecurityPolicy.Basic256Sha256:
        case SecurityPolicy.Aes128_Sha256_RsaOaep:
        case SecurityPolicy.Aes256_Sha256_RsaPss:
            return StatusCodes.Good;
        default:
            return StatusCodes.BadSecurityPolicyRejected;
    }
}

/**
 * returns true if the nonce is null or zero (all bytes set to 0)
 */
export function isEmptyNonce(nonce: Buffer): boolean {
    const countZero = nonce.reduce((accumulator: number, currentValue: number) => accumulator + (currentValue === 0 ? 1 : 0), 0);
    return countZero === nonce.length;
}
const g_alreadyUsedNonce: any = {};
export function nonceAlreadyBeenUsed(nonce?: Buffer): boolean {
    if (!nonce || isEmptyNonce(nonce)) {
        return false;
    }
    const hash = nonce.toString("base64");
    if (Object.prototype.hasOwnProperty.call(g_alreadyUsedNonce, hash)) {
        return true;
    }
    g_alreadyUsedNonce[hash] = {
        time: new Date()
    };
    return false;
}

export interface IServerSessionBase {
    sessionTimeout: number;
    sessionName: string;
    clientLastContactTime: number;
    status: string;
}

/**
 * @class ServerSecureChannelLayer
 * @extends EventEmitter
 * @uses MessageBuilder
 * @uses MessageChunker
 */
export class ServerSecureChannelLayer extends EventEmitter {
    public static throttleTime = 100;

    private static g_MinimumSecureTokenLifetime = 2500;
    private static g_counter = 0;
    private _counter: number = ServerSecureChannelLayer.g_counter++;

    public get securityTokenCount(): number {
        assert(typeof this.lastTokenId === "number");
        return this.lastTokenId;
    }

    public get remoteAddress(): string {
        return this._remoteAddress;
    }

    public get remotePort(): number {
        return this._remotePort;
    }

    /**
     *
     */
    public get aborted(): boolean {
        return this._abort_has_been_called;
    }

    /**
     * the number of bytes read so far by this channel
     */
    public get bytesRead(): number {
        return this.transport ? this.transport.bytesRead : 0;
    }

    /**
     * the number of bytes written so far by this channel
     */
    public get bytesWritten(): number {
        return this.transport ? this.transport.bytesWritten : 0;
    }

    public get transactionsCount(): number {
        return this._transactionsCount;
    }

    /**
     * true when the secure channel has been opened successfully
     *
     */
    public get isOpened(): boolean {
        return !!this.clientCertificate;
    }

    /**
     * true when the secure channel is assigned to a active session
     */
    public get hasSession(): boolean {
        return Object.keys(this.sessionTokens).length > 0;
    }

    public get certificateManager(): ICertificateManager {
        return this.parent!.certificateManager!;
    }

    /**
     * The unique hash key to identify this secure channel
     * @property hashKey
     */
    public get hashKey(): number {
        return this.__hash;
    }

    public static registry = new ObjectRegistry({});
    public _on_response: ((msgType: string, response: Response, message: Message) => void) | null;
    public sessionTokens: { [key: string]: IServerSessionBase };
    public channelId: number | null;
    public timeout: number;

    public messageBuilder?: MessageBuilder;

    public receiverCertificate: Buffer | null;
    public clientCertificate: Buffer | null;
    public clientNonce: Buffer | null;
    /**
     * the channel message security mode
     */
    public securityMode: MessageSecurityMode;
    /**
     * the channel message security policy
     */
    public securityPolicy: SecurityPolicy = SecurityPolicy.Invalid;
    public securityHeader: AsymmetricAlgorithmSecurityHeader | null;
    public clientSecurityHeader?: SecurityHeader;

    private readonly __hash: number;
    private parent: ServerSecureChannelParent | null;
    private readonly protocolVersion: number;
    private lastTokenId: number;
    private readonly defaultSecureTokenLifetime: number;
    private securityToken: ChannelSecurityToken;
    private serverNonce: Buffer | null;
    private receiverPublicKey: string | null;
    private receiverPublicKeyLength: number;
    private readonly messageChunker: MessageChunker;

    private timeoutId: NodeJS.Timer | null;
    private _securityTokenTimeout: NodeJS.Timer | null;
    private _transactionsCount: number;
    private revisedLifetime: number;
    private readonly transport: ServerTCP_transport;
    private derivedKeys?: DerivedKeys1;

    private objectFactory?: ObjectFactory;
    private last_transaction_stats?: ServerTransactionStatistics;
    private _tick0: number;
    private _tick1: number;
    private _tick2: number;
    private _tick3: number;

    private _bytesRead_before: number;
    private _bytesWritten_before: number;

    private _remoteAddress: string;
    private _remotePort: number;
    private _abort_has_been_called: boolean;
    private __verifId: any;
    private _transport_socket_close_listener?: any;

    public constructor(options: ServerSecureChannelLayerOptions) {
        super();

        this._on_response = null;
        this.__verifId = {};
        this._abort_has_been_called = false;
        this._remoteAddress = "";
        this._remotePort = 0;
        this.receiverCertificate = null;
        this.receiverPublicKey = null;
        this.receiverPublicKeyLength = 0;
        this.clientCertificate = null;
        this.clientNonce = null;

        this.transport = new ServerTCP_transport();

        this.__hash = getNextChannelId();
        assert(this.__hash > 0);

        this.channelId = null;

        this.revisedLifetime = 0;

        this.parent = options.parent;

        this.protocolVersion = 0;

        this.lastTokenId = 0;

        this.timeout = options.timeout || 30000; // connection timeout

        this.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 600000;
        debugLog(
            "server secure channel layer timeout = ",
            this.timeout,
            "defaultSecureTokenLifetime = ",
            this.defaultSecureTokenLifetime
        );

        // uninitialized securityToken
        this.securityToken = new ChannelSecurityToken({
            channelId: this.__hash,
            revisedLifetime: 0,
            tokenId: 0
        });

        assert(this.securityToken.channelId > 0);

        this.serverNonce = null; // will be created when needed

        // at first use a anonymous connection
        this.securityHeader = new AsymmetricAlgorithmSecurityHeader({
            receiverCertificateThumbprint: null,
            securityPolicyUri: "http://opcfoundation.org/UA/SecurityPolicy#None",
            senderCertificate: null
        });

        this.messageChunker = new MessageChunker({
            securityHeader: this.securityHeader, // for OPN
            maxMessageSize: this.transport.maxMessageSize,
            maxChunkCount: this.transport.maxChunkCount
        });

        this._tick0 = 0;
        this._tick1 = 0;
        this._tick2 = 0;
        this._tick3 = 0;
        this._bytesRead_before = 0;
        this._bytesWritten_before = 0;

        this.securityMode = MessageSecurityMode.Invalid;

        this.timeoutId = null;
        this._securityTokenTimeout = null;

        this._transactionsCount = 0;

        this.sessionTokens = {};

        this.objectFactory = options.objectFactory;

        // xx #422 self.setMaxListeners(200); // increase the number of max listener
    }

    private _build_message_builder() {
        this.messageBuilder = new MessageBuilder({
            name: "server",
            objectFactory: this.objectFactory,
            privateKey: this.getPrivateKey(),
            maxChunkSize: this.transport.receiveBufferSize,
            maxChunkCount: this.transport.maxChunkCount,
            maxMessageSize: this.transport.maxMessageSize
        });
        debugLog(" this.transport.maxChunkCount", this.transport.maxChunkCount);
        debugLog(" this.transport.maxMessageSize", this.transport.maxMessageSize);

        this.messageBuilder.on("error", (err, statusCode) => {
            warningLog("ServerSecureChannel:MessageBuilder: ", err.message);

            // istanbul ignore next
            if (doDebug) {
                debugLog(chalk.red("Error "), err.message, err.stack);
                debugLog(chalk.red("Server is now closing socket, without further notice"));
            }

            this.transport.sendErrorMessage(statusCode, err.message);

            // close socket immediately
            this.close(undefined);
        });
    }

    public dispose(): void {
        debugLog("ServerSecureChannelLayer#dispose");
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        assert(!this.timeoutId, "timeout must have been cleared");
        assert(!this._securityTokenTimeout, "_securityTokenTimeout must have been cleared");

        this.parent = null;
        this.serverNonce = null;
        this.objectFactory = undefined;

        if (this.messageBuilder) {
            this.messageBuilder.dispose();
            this.messageBuilder = undefined;
        }
        this.securityHeader = null;

        if (this.messageChunker) {
            this.messageChunker.dispose();
            // xx this.messageChunker = null;
        }
        if (this.transport) {
            this.transport.dispose();
            (this as any).transport = undefined;
        }
        this.channelId = 0xdeadbeef;
        this.timeoutId = null;
        this.sessionTokens = {};
        this.removeAllListeners();
    }

    public abruptlyInterrupt(): void {
        const clientSocket = this.transport._socket;
        if (clientSocket) {
            clientSocket.end();
            clientSocket.destroy();
        }
    }

    /**
     * the endpoint associated with this secure channel
     *
     */
    public getEndpointDescription(
        securityMode: MessageSecurityMode,
        securityPolicy: SecurityPolicy,
        endpointUri: string | null
    ): EndpointDescription | null {
        if (!this.parent) {
            return null; // throw new Error("getEndpointDescription - no parent");
        }
        return this.parent.getEndpointDescription(this.securityMode, securityPolicy, endpointUri);
    }

    public setSecurity(securityMode: MessageSecurityMode, securityPolicy: SecurityPolicy): void {
        if (!this.messageBuilder) {
            this._build_message_builder();
        }
        assert(this.messageBuilder);
        // TODO verify that the endpoint really supports this mode
        this.messageBuilder!.setSecurity(securityMode, securityPolicy);
    }

    /**
     * @method getCertificateChain
     * @return the X509 DER form certificate
     */
    public getCertificateChain(): Certificate {
        if (!this.parent) {
            throw new Error("expecting a valid parent");
        }
        return this.parent.getCertificateChain();
    }

    /**
     * @method getCertificate
     * @return  the X509 DER form certificate
     */
    public getCertificate(): Certificate {
        if (!this.parent) {
            throw new Error("expecting a valid parent");
        }
        return this.parent.getCertificate();
    }

    public getSignatureLength(): PublicKeyLength {
        const firstCertificateInChain = this.getCertificate();
        const cert = exploreCertificateInfo(firstCertificateInChain);
        return cert.publicKeyLength; // 1024 bits = 128Bytes or 2048=256Bytes
    }

    /**
     * @method getPrivateKey
     * @return the privateKey
     */
    public getPrivateKey(): PrivateKeyPEM {
        if (!this.parent) {
            return "<invalid>";
            // throw new Error("getPrivateKey : cannot get PrivateKey");
        }
        return this.parent.getPrivateKey();
    }

    /**
     * @method init
     * @async
     * @param socket
     * @param callback
     */
    public init(socket: Socket, callback: ErrorCallback): void {
        this.transport.timeout = this.timeout;
        debugLog("Setting socket timeout to ", this.transport.timeout);

        this.transport.init(socket, (err?: Error) => {
            if (err) {
                callback(err);
            } else {
                this._build_message_builder();

                this._rememberClientAddressAndPort();

                // adjust sizes;
                this.messageChunker.maxMessageSize = this.transport.maxMessageSize;
                this.messageChunker.maxChunkCount = this.transport.maxChunkCount;

                // bind low level TCP transport to messageBuilder
                this.transport.on("chunk", (messageChunk: Buffer) => {
                    // istanbul ignore next
                    if (doTraceIncomingChunk) {
                        console.log(hexDump(messageChunk));
                    }
                    this.messageBuilder!.feed(messageChunk);
                });
                debugLog("ServerSecureChannelLayer : Transport layer has been initialized");
                debugLog("... now waiting for OpenSecureChannelRequest...");

                ServerSecureChannelLayer.registry.register(this);

                this._wait_for_open_secure_channel_request(callback, this.timeout);
            }
        });

        // detect transport closure
        this._transport_socket_close_listener = (err?: Error) => {
            debugLog("transport has send socket_closed event " + (err ? err.message : "null"));
            this._abort();
        };
        this.transport.on("socket_closed", this._transport_socket_close_listener);
    }

    /**
     * @method send_response
     * @async
     * @param msgType
     * @param response
     * @param message
     * @param callback
     */
    public send_response(msgType: string, response: Response, message: Message, callback?: ErrorCallback): void {
        const request = message.request;
        const requestId = message.requestId;
        assert(requestId !== 0);

        if (this.aborted) {
            debugLog("channel has been terminated , cannot send responses");
            return callback && callback(new Error("Aborted"));
        }

        // istanbul ignore next
        if (doDebug) {
            assert(request.schema);
            assert(requestId > 0);
            // verify that response for a given requestId is only sent once.
            if (!this.__verifId) {
                this.__verifId = {};
            }
            assert(!this.__verifId[requestId], " response for requestId has already been sent !! - Internal Error");
            this.__verifId[requestId] = requestId;
        }

        if (doPerfMonitoring) {
            // record tick : send response received.
            this._tick2 = get_clock_tick();
        }

        // istanbul ignore next
        if (!this.securityToken) {
            throw new Error("Internal error");
        }

        let options = {
            channelId: this.securityToken.channelId,
            chunkSize: this.transport.receiveBufferSize,
            requestId,
            tokenId: this.securityToken.tokenId
        };

        const securityOptions = msgType === "OPN" ? this._get_security_options_for_OPN() : this._get_security_options_for_MSG();
        if (securityOptions) {
            options = {
                ...options,
                ...securityOptions
            };
        }

        response.responseHeader.requestHandle = request.requestHeader.requestHandle;

        /* istanbul ignore next */
        if (0 && doDebug) {
            // tslint:disable-next-line: no-console
            console.log(" options ", options);
            analyze_object_binary_encoding(response as any as BaseUAObject);
        }

        /* istanbul ignore next */
        if (doTraceServerMessage) {
            traceResponseMessage(response, this.securityToken.channelId, this._counter);
        }

        if (this._on_response) {
            this._on_response(msgType, response, message);
        }

        this._transactionsCount += 1;

        this.messageChunker.chunkSecureMessage(
            msgType,
            options as ChunkMessageOptions,
            response as any as BaseUAObject,
            (err: Error | null, messageChunk: Buffer | null) => {
                if (err) {
                    // the response would be too large !!!!
                    warningLog("Error while chunking response message : ", err.message);
                    this._send_chunk(callback, messageChunk);
                    /* this.send_response(
                        "MSG",
                        new ServiceFault({
                            responseHeader: {
                                requestHandle: request.requestHeader.requestHandle,
                                serviceResult: StatusCodes.BadTcpMessageTooLarge
                            }
                        }),
                        message,
                        callback
                    );
                    */
                } else {
                    this._send_chunk(callback, messageChunk);
                }
            }
        );
    }

    private _sendFatalErrorAndAbort(statusCode: StatusCode, description: string, message: Message, callback: ErrorCallback): void {
        this.transport.abortWithError(statusCode, description, () => {
            this.close(() => {
                callback(new Error(description + " statusCode = " + statusCode.toString()));
            });
        });
    }

    public getRemoteIPAddress(): string {
        return (this.transport?._socket as Socket)?.remoteAddress || "";
    }

    public getRemotePort(): number {
        return (this.transport?._socket as Socket)?.remotePort || 0;
    }

    public getRemoteFamily(): string {
        return (this.transport?._socket as Socket)?.remoteFamily || "";
    }

    /**
     * Abruptly close a Server SecureChannel ,by terminating the underlying transport.
     *
     *
     * @method close
     * @async
     * @param callback
     */
    public close(callback?: ErrorCallback): void {
        if (!this.transport) {
            if (typeof callback === "function") {
                callback();
            }
            return;
        }
        debugLog("ServerSecureChannelLayer#close");
        // close socket
        this.transport.disconnect(() => {
            this._abort();
            if (typeof callback === "function") {
                callback();
            }
        });
    }

    public has_endpoint_for_security_mode_and_policy(securityMode: MessageSecurityMode, securityPolicy: SecurityPolicy): boolean {
        if (!this.parent) {
            return true;
        }
        const endpoint_desc = this.getEndpointDescription(securityMode, securityPolicy, null);
        return endpoint_desc !== null;
    }

    public _rememberClientAddressAndPort(): void {
        if (this.transport && this.transport._socket) {
            this._remoteAddress = this.transport._socket.remoteAddress || "";
            this._remotePort = this.transport._socket.remotePort || 0;
        }
    }

    private _stop_security_token_watch_dog() {
        if (this._securityTokenTimeout) {
            clearTimeout(this._securityTokenTimeout);
            this._securityTokenTimeout = null;
        }
    }

    private _start_security_token_watch_dog() {
        // install securityToken timeout watchdog
        this._securityTokenTimeout = setTimeout(() => {
            warningLog(
                " Security token has really expired and shall be discarded !!!! (lifetime is = ",
                this.securityToken.revisedLifetime,
                ")"
            );
            warningLog(" Server will now refuse message with token ", this.securityToken.tokenId);
            this._securityTokenTimeout = null;
        }, (this.securityToken.revisedLifetime * 120) / 100);
    }

    private _add_new_security_token() {
        this._stop_security_token_watch_dog();
        this.lastTokenId += 1;

        this.channelId = this.__hash;
        assert(this.channelId > 0);

        const securityToken = new ChannelSecurityToken({
            channelId: this.channelId,
            createdAt: new Date(), // now
            revisedLifetime: this.revisedLifetime,
            tokenId: this.lastTokenId // todo ?
        });

        assert(!hasTokenExpired(securityToken));
        assert(isFinite(securityToken.revisedLifetime));

        this.securityToken = securityToken;

        debugLog("SecurityToken", securityToken.tokenId);

        this._start_security_token_watch_dog();
    }

    private _prepare_security_token(openSecureChannelRequest: OpenSecureChannelRequest) {
        this.securityToken = null as any as ChannelSecurityToken;
        if (openSecureChannelRequest.requestType === SecurityTokenRequestType.Renew) {
            this._stop_security_token_watch_dog();
        } else if (openSecureChannelRequest.requestType === SecurityTokenRequestType.Issue) {
            // TODO
        } else {
            // Invalid requestType
        }
        this._add_new_security_token();
    }

    private _set_lifetime(requestedLifetime: number) {
        assert(isFinite(requestedLifetime));

        // revised lifetime
        this.revisedLifetime = requestedLifetime;
        if (this.revisedLifetime === 0) {
            this.revisedLifetime = this.defaultSecureTokenLifetime;
        } else {
            this.revisedLifetime = Math.min(this.defaultSecureTokenLifetime, this.revisedLifetime);
            this.revisedLifetime = Math.max(ServerSecureChannelLayer.g_MinimumSecureTokenLifetime, this.revisedLifetime);
        }

        // xx console.log('requestedLifetime,self.defaultSecureTokenLifetime, self.revisedLifetime',requestedLifetime,self.defaultSecureTokenLifetime, self.revisedLifetime);
    }

    private _stop_open_channel_watch_dog() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }

    private _cleanup_pending_timers() {
        // there is no need for the security token expiration event to trigger anymore
        this._stop_security_token_watch_dog();
        this._stop_open_channel_watch_dog();
    }

    private _cancel_wait_for_open_secure_channel_request_timeout() {
        this._stop_open_channel_watch_dog();
    }

    private _install_wait_for_open_secure_channel_request_timeout(callback: ErrorCallback, timeout: number) {
        assert(isFinite(timeout));
        assert(typeof callback === "function");

        this.timeoutId = setTimeout(() => {
            this.timeoutId = null;
            const err = new Error("Timeout waiting for OpenChannelRequest (timeout was " + timeout + " ms)");
            debugLog(err.message);
            this.close(() => {
                callback(err);
            });
        }, timeout);
    }

    private _on_initial_open_secure_channel_request(
        callback: ErrorCallback,
        request: Request,
        msgType: string,
        requestId: number,
        channelId: number
    ) {
        /* istanbul ignore next */
        if (doTraceServerMessage) {
            traceRequestMessage(request, channelId, this._counter);
        }

        /* istanbul ignore next */
        if (!(this.messageBuilder && this.messageBuilder.sequenceHeader && this.messageBuilder.securityHeader)) {
            return this._on_OpenSecureChannelRequestError(
                StatusCodes.BadCommunicationError,
                "internal error",
                { request, requestId },
                callback
            );
        }

        const message = {
            request,
            requestId,
            securityHeader: this.messageBuilder.securityHeader
        };

        requestId = this.messageBuilder.sequenceHeader.requestId;
        if (requestId <= 0) {
            return this._on_OpenSecureChannelRequestError(
                StatusCodes.BadCommunicationError,
                "Invalid requestId",
                message,
                callback
            );
        }
        this.clientSecurityHeader = message.securityHeader;

        let description;

        // expecting a OpenChannelRequest as first communication message
        if (!(request instanceof OpenSecureChannelRequest)) {
            description = "Expecting OpenSecureChannelRequest";
            warningLog(chalk.red("ERROR"), "BadCommunicationError: expecting a OpenChannelRequest as first communication message");
            return this._on_OpenSecureChannelRequestError(StatusCodes.BadCommunicationError, description, message, callback);
        }

        // check that the request is a OpenSecureChannelRequest
        /* istanbul ignore next */
        if (doDebug) {
            debugLog(this.messageBuilder.sequenceHeader.toString());
            debugLog(this.messageBuilder.securityHeader.toString());
        }

        const asymmetricSecurityHeader = this.messageBuilder.securityHeader as AsymmetricAlgorithmSecurityHeader;

        const securityPolicy = message.securityHeader
            ? fromURI(asymmetricSecurityHeader.securityPolicyUri)
            : SecurityPolicy.Invalid;

        // check security header
        const securityPolicyStatus: StatusCode = isValidSecurityPolicy(securityPolicy);
        if (securityPolicyStatus !== StatusCodes.Good) {
            description = " Unsupported securityPolicyUri " + asymmetricSecurityHeader.securityPolicyUri;
            warningLog("BadSecurityPolicyRejected: Unsupported securityPolicyUri", securityPolicy);
            return this._on_OpenSecureChannelRequestError(securityPolicyStatus, description, message, callback);
        }
        // check certificate

        this.securityMode = request.securityMode;
        this.securityPolicy = securityPolicy;

        this.messageBuilder.securityMode = this.securityMode;

        const hasEndpoint = this.has_endpoint_for_security_mode_and_policy(this.securityMode, securityPolicy);

        if (!hasEndpoint) {
            // there is no
            description = " This server doesn't not support  " + securityPolicy.toString() + " " + this.securityMode.toString();
            return this._on_OpenSecureChannelRequestError(StatusCodes.BadSecurityPolicyRejected, description, message, callback);
        }

        this.messageBuilder
            .on("message", (request, msgType, requestId, channelId) => {
                this._on_common_message(request as Request, msgType, requestId, channelId);
            })
            .on("error", (err: Error, statusCode: StatusCode, requestId: number | null) => {
                /** */
                this.transport.sendErrorMessage(statusCode, err.message);
                this.close();
            })
            .on("startChunk", () => {
                if (doPerfMonitoring) {
                    // record tick 0: when the first chunk is received
                    this._tick0 = get_clock_tick();
                }
            });

        // handle initial OpenSecureChannelRequest
        this._process_certificates(message, (err: Error | null, statusCode?: StatusCode) => {
            // istanbul ignore next
            if (err || !statusCode) {
                description = "Internal Error " + err?.message;
                return this._on_OpenSecureChannelRequestError(StatusCodes.BadInternalError, description, message, callback);
            }

            if (statusCode !== StatusCodes.Good) {
                const description = "Sender Certificate Error";
                debugLog(chalk.cyan(description), chalk.bgCyan.yellow(statusCode!.toString()));
                // OPCUA specification v1.02 part 6 page 42 $6.7.4
                // If an error occurs after the  Server  has verified  Message  security  it  shall  return a  ServiceFault  instead
                // of a OpenSecureChannel  response. The  ServiceFault  Message  is described in  Part  4,   7.28.
                if (
                    statusCode !== StatusCodes.BadCertificateIssuerRevocationUnknown &&
                    statusCode !== StatusCodes.BadCertificateRevocationUnknown &&
                    statusCode !== StatusCodes.BadCertificateTimeInvalid &&
                    statusCode !== StatusCodes.BadCertificateUseNotAllowed
                ) {
                    statusCode = StatusCodes.BadSecurityChecksFailed;
                }
                return this._on_OpenSecureChannelRequestError(statusCode, description, message, callback);
            }
            this._handle_OpenSecureChannelRequest(statusCode!, message, callback);
        });
    }

    private _wait_for_open_secure_channel_request(callback: ErrorCallback, timeout: number) {
        this._install_wait_for_open_secure_channel_request_timeout(callback, timeout);

        const errorHandler = (err: Error) => {
            this._cancel_wait_for_open_secure_channel_request_timeout();

            this.messageBuilder!.removeListener("message", messageHandler);
            this.close(() => {
                callback(new Error("/Expecting OpenSecureChannelRequest to be valid " + err.message));
            });
        };
        const messageHandler = (request: Request, msgType: string, requestId: number, channelId: number) => {
            this._cancel_wait_for_open_secure_channel_request_timeout();
            this.messageBuilder!.removeListener("error", errorHandler);
            this._on_initial_open_secure_channel_request(callback, request, msgType, requestId, channelId);
        };
        this.messageBuilder!.once("error", errorHandler);
        this.messageBuilder!.once("message", messageHandler);
    }

    private _send_chunk(callback: ErrorCallback | undefined, messageChunk: Buffer | null) {
        if (messageChunk) {
            this.transport.write(messageChunk);
        } else {
            if (doPerfMonitoring) {
                // record tick 3 : transaction completed.
                this._tick3 = get_clock_tick();
            }

            if (callback) {
                setImmediate(callback);
            }

            /* istanbul ignore next */
            if (doPerfMonitoring) {
                this._record_transaction_statistics();
                // dump some statistics about transaction ( time and sizes )
                _dump_transaction_statistics(this.last_transaction_stats);
            }
            this.emit("transaction_done");
        }
    }

    private _get_security_options_for_OPN(): SecureMessageChunkManagerOptions | null {
        // install sign & sign-encrypt behavior
        if (this.securityMode === MessageSecurityMode.Sign || this.securityMode === MessageSecurityMode.SignAndEncrypt) {
            const cryptoFactory = this.messageBuilder!.cryptoFactory;
            /* istanbul ignore next */
            if (!cryptoFactory) {
                throw new Error("Internal Error");
            }
            assert(cryptoFactory, "ServerSecureChannelLayer must have a crypto strategy");
            assert(this.receiverPublicKeyLength >= 0);

            const receiverPublicKey = this.receiverPublicKey;
            if (!receiverPublicKey) {
                // this could happen if certificate was wrong
                // throw new Error("Invalid receiverPublicKey");
                return null;
            }
            const options = {
                cipherBlockSize: this.receiverPublicKeyLength,
                plainBlockSize: this.receiverPublicKeyLength - cryptoFactory.blockPaddingSize,
                signatureLength: this.getSignatureLength(),

                encryptBufferFunc: (chunk: Buffer) => {
                    return cryptoFactory.asymmetricEncrypt(chunk, receiverPublicKey);
                },

                signBufferFunc: (chunk: Buffer) => {
                    const signed = cryptoFactory.asymmetricSign(chunk, this.getPrivateKey());
                    assert(signed.length === options.signatureLength);
                    return signed;
                }
            };
            return options as SecureMessageChunkManagerOptions; // partial
        }
        return null;
    }

    private _get_security_options_for_MSG(): SecureMessageChunkManagerOptionsPartial | null {
        if (this.securityMode === MessageSecurityMode.None) {
            return null;
        }
        const cryptoFactory = this.messageBuilder!.cryptoFactory;

        /* istanbul ignore next */
        if (!cryptoFactory || !this.derivedKeys) {
            return null;
        }

        assert(cryptoFactory, "ServerSecureChannelLayer must have a crypto strategy");
        assert(this.derivedKeys.derivedServerKeys);
        const derivedServerKeys = this.derivedKeys.derivedServerKeys;
        if (!derivedServerKeys) {
            return null;
        }
        return getOptionsForSymmetricSignAndEncrypt(this.securityMode, derivedServerKeys);
    }

    /**
     * _process_certificates extracts client public keys from client certificate
     *  and store them in self.receiverPublicKey and self.receiverCertificate
     *  it also caches self.receiverPublicKeyLength.
     *
     *  so they can be used by security channel.
     *
     * @method _process_certificates
     * @param message the message coming from the client
     * @param callback
     * @private
     * @async
     */

    private _process_certificates(message: Message, callback: Callback2<StatusCode>): void {
        const asymmSecurityHeader = message.securityHeader as AsymmetricAlgorithmSecurityHeader;

        // verify certificate
        const certificate = asymmSecurityHeader ? asymmSecurityHeader.senderCertificate : null;
        this.checkCertificateCallback(certificate!, (err: Error | null, statusCode?: StatusCode) => {
            if (err) {
                return callback(err);
            }
            //
            this.receiverPublicKey = null;
            this.receiverPublicKeyLength = 0;
            this.receiverCertificate = asymmSecurityHeader ? asymmSecurityHeader.senderCertificate : null;
            // get the clientCertificate for convenience
            this.clientCertificate = this.receiverCertificate;

            // ignore receiverCertificate that have a zero length
            /* istanbul ignore next */
            if (this.receiverCertificate && this.receiverCertificate.length === 0) {
                this.receiverCertificate = null;
            }

            if (this.receiverCertificate) {
                // extract public key
                extractPublicKeyFromCertificate(this.receiverCertificate, (err, key) => {
                    if (!err) {
                        if (key) {
                            this.receiverPublicKey = key;
                            this.receiverPublicKeyLength = rsa_length(key);
                        }
                        callback(null, statusCode);
                    } else {
                        callback(err);
                    }
                });
            } else {
                this.receiverPublicKey = null;
                callback(null, statusCode);
            }
        });
    }

    private _prepare_security_header(request: OpenSecureChannelRequest, message: Message): AsymmetricAlgorithmSecurityHeader | null {
        let securityHeader: AsymmetricAlgorithmSecurityHeader;
        // senderCertificate:
        //    The X509v3 certificate assigned to the sending application instance.
        //    This is a DER encoded blob.
        //    This indicates what private key was used to sign the MessageChunk.
        //    This field shall be null if the message is not signed.
        // receiverCertificateThumbprint:
        //    The thumbprint of the X509v3 certificate assigned to the receiving application
        //    The thumbprint is the SHA1 digest of the DER encoded form of the certificate.
        //    This indicates what public key was used to encrypt the MessageChunk
        //   This field shall be null if the message is not encrypted.
        switch (request.securityMode) {
            case MessageSecurityMode.None:
                securityHeader = new AsymmetricAlgorithmSecurityHeader({
                    receiverCertificateThumbprint: null, // message not encrypted
                    securityPolicyUri: "http://opcfoundation.org/UA/SecurityPolicy#None",
                    senderCertificate: null // message not signed
                });

                break;
            case MessageSecurityMode.Sign:
            case MessageSecurityMode.SignAndEncrypt:
            default: {
                if (!this.parent) {
                    warningLog("Cannot find parent of SecureChannel !!!!!!!! ");
                    return null;
                }
                const receiverCertificateThumbprint = getThumbprint(this.receiverCertificate);

                const asymmClientSecurityHeader = this.clientSecurityHeader as AsymmetricAlgorithmSecurityHeader;

                // istanbul ignore next
                securityHeader = new AsymmetricAlgorithmSecurityHeader({
                    receiverCertificateThumbprint, // message not encrypted (????)
                    securityPolicyUri: asymmClientSecurityHeader.securityPolicyUri,
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
            }
        }
        return securityHeader;
    }

    protected checkCertificateCallback(
        certificate: Certificate | null,
        callback: (err: Error | null, statusCode?: StatusCode) => void
    ): void {
        /** */
    }

    protected async checkCertificate(certificate: Certificate | null): Promise<StatusCode> {
        if (!certificate) {
            return StatusCodes.Good;
        }
        // istanbul ignore next
        if (!this.certificateManager) {
            return StatusCodes.BadInternalError;
        }
        const statusCode = await this.certificateManager.checkCertificate(certificate);
        if (statusCode === StatusCodes.Good) {
            const certInfo = exploreCertificate(certificate!);
            if (!certInfo.tbsCertificate.extensions?.keyUsage?.dataEncipherment) {
                return StatusCodes.BadCertificateUseNotAllowed;
            }
            if (!certInfo.tbsCertificate.extensions?.keyUsage?.digitalSignature) {
                return StatusCodes.BadCertificateUseNotAllowed;
            }
        }
        return statusCode;
    }

    private _handle_OpenSecureChannelRequest(serviceResult: StatusCode, message: Message, callback: ErrorCallback) {
        const request = message.request as OpenSecureChannelRequest;
        const requestId: number = message.requestId;
        if (!(requestId !== 0 && requestId > 0)) {
            warningLog("OpenSecureChannelRequest: requestId");
            return this._sendFatalErrorAndAbort(StatusCodes2.BadTcpInternalError, "invalid request", message, callback);
        }

        // let prepare self.securityHeader;
        this.securityHeader = this._prepare_security_header(request, message);

        /* istanbul ignore next */
        if (!this.securityHeader) {
            warningLog("Cannot find SecurityHeader !!!!!!!! ");
            return this._sendFatalErrorAndAbort(StatusCodes2.BadSecurityChecksFailed, "invalid request", message, callback);
        }
        
        this.clientNonce = request.clientNonce;

        if (nonceAlreadyBeenUsed(this.clientNonce)) {
            warningLog(chalk.red("SERVER with secure connection: Nonce has already been used"), this.clientNonce.toString("hex"));
            serviceResult = StatusCodes.BadNonceInvalid;
        }

        this._set_lifetime(request.requestedLifetime);

        this._prepare_security_token(request);

        const cryptoFactory = this.messageBuilder!.cryptoFactory;
        if (cryptoFactory) {
            // serverNonce: A random number that shall not be used in any other request. A new
            //    serverNonce shall be generated for each time a SecureChannel is renewed.
            //    This parameter shall have a length equal to key size used for the symmetric
            //    encryption algorithm that is identified by the securityPolicyUri.
            this.serverNonce = crypto.randomBytes(cryptoFactory.symmetricKeyLength);

            if (this.clientNonce.length !== this.serverNonce.length) {
                warningLog(
                    chalk.red("warning client Nonce length doesn't match server nonce length"),
                    this.clientNonce.length,
                    " !== ",
                    this.serverNonce.length
                );
                // what can we do
                // - just ignore it ?
                // - or adapt serverNonce length to clientNonce Length ?
                // xx self.serverNonce = crypto.randomBytes(self.clientNonce.length);
                // - or adapt clientNonce length to serverNonce Length ?
                // xx self.clientNonce = self.clientNonce.slice(0,self.serverNonce.length);
                //
                // - or abort connection ? << LET BE SAFE AND CHOOSE THIS ONE !
                serviceResult = StatusCodes.BadSecurityModeRejected; // ToDo check code
            }
            // expose derivedKey to use for symmetric sign&encrypt
            // to help us decrypting and verifying messages received from client
            this.derivedKeys = computeDerivedKeys(cryptoFactory, this.serverNonce, this.clientNonce);
        }

        const derivedClientKeys = this.derivedKeys ? this.derivedKeys.derivedClientKeys : null;
        this.messageBuilder!.pushNewToken(this.securityToken, derivedClientKeys);

        const derivedServerKeys = this.derivedKeys ? this.derivedKeys.derivedServerKeys : undefined;

        this.messageChunker.update({
            // for OPN
            securityHeader: this.securityHeader,

            // derived keys for symmetric encryption of standard MSG
            // to sign and encrypt MSG sent to client
            derivedKeys: derivedServerKeys
        });

        let description;

        // If the SecurityMode is not None then the Server shall verify that a SenderCertificate and a
        // ReceiverCertificateThumbprint were specified in the SecurityHeader.
        if (this.securityMode !== MessageSecurityMode.None) {
            /* istanbul ignore next */
            if (!this.clientSecurityHeader) {
                throw new Error("Internal Error");
            }
            if (!this._check_receiverCertificateThumbprint(this.clientSecurityHeader)) {
                description =
                    "Server#OpenSecureChannelRequest : Invalid receiver certificate thumbprint : the thumbprint doesn't match server certificate !";
                warningLog(chalk.cyan(description));
                serviceResult = StatusCodes.BadCertificateInvalid;
            }
        }

        const response: Response = new OpenSecureChannelResponse({
            responseHeader: { serviceResult },

            securityToken: this.securityToken,
            serverNonce: this.serverNonce || undefined,
            serverProtocolVersion: this.protocolVersion
        });

        if (doTraceServerMessage) {
            console.log("Transport maxMessageSize = ", this.transport.maxMessageSize);
            console.log("Transport maxChunkCount = ", this.transport.maxChunkCount);
        }
        this.send_response("OPN", response, message, (/*err*/) => {
            const responseHeader = response.responseHeader;
            if (responseHeader.serviceResult !== StatusCodes.Good) {
                warningLog("OpenSecureChannelRequest Closing communication ", responseHeader.serviceResult.toString());
                this.close();
            }
            callback();
        });
    }

    private _abort() {
        debugLog("ServerSecureChannelLayer#_abort");

        if (this._abort_has_been_called) {
            debugLog("Warning => ServerSecureChannelLayer#_abort has already been called");
            return;
        }

        ServerSecureChannelLayer.registry.unregister(this);

        this._abort_has_been_called = true;

        this._cleanup_pending_timers();
        /**
         * notify the observers that the SecureChannel has aborted.
         * the reason could be :
         *   - a CloseSecureChannelRequest has been received.
         *   - a invalid message has been received
         * the event is sent after the underlying transport layer has been closed.
         *
         * @event abort
         */
        this.emit("abort");
        debugLog("ServerSecureChannelLayer emitted abort event");
    }

    private _record_transaction_statistics() {
        this._bytesRead_before = this._bytesRead_before || 0;
        this._bytesWritten_before = this._bytesWritten_before || 0;

        this.last_transaction_stats = {
            bytesRead: this.bytesRead - this._bytesRead_before,
            bytesWritten: this.bytesWritten - this._bytesWritten_before,

            lap_reception: this._tick1 - this._tick0,

            lap_processing: this._tick2 - this._tick1,

            lap_emission: this._tick3 - this._tick2
        };

        // final operation in statistics
        this._bytesRead_before = this.bytesRead;
        this._bytesWritten_before = this.bytesWritten;
    }

    private _on_common_message(request: Request, msgType: string, requestId: number, channelId: number) {
        /* istanbul ignore next */
        if (doTraceServerMessage) {
            traceRequestMessage(request, channelId, this._counter);
        }

        /* istanbul ignore next */
        if (this.messageBuilder!.sequenceHeader === null) {
            throw new Error("Internal Error");
        }

        requestId = this.messageBuilder!.sequenceHeader.requestId;

        const message: Message = {
            channel: this,
            request,
            requestId
        };

        if (msgType === "CLO" && request.schema.name === "CloseSecureChannelRequest") {
            this.close();
        } else if (msgType === "OPN" && request.schema.name === "OpenSecureChannelRequest") {
            // intercept client request to renew security Token
            this._handle_OpenSecureChannelRequest(StatusCodes.Good, message, (/* err?: Error*/) => {
                /** */
            });
        } else {
            if (request.schema.name === "CloseSecureChannelRequest") {
                warningLog("WARNING : RECEIVED a CloseSecureChannelRequest with msgType=", msgType);
                this.close();
            } else {
                if (doPerfMonitoring) {
                    // record tick 1 : after message has been received, before message processing
                    this._tick1 = get_clock_tick();
                }

                if (this.securityToken && channelId !== this.securityToken.channelId) {
                    // response = new ServiceFault({responseHeader: {serviceResult: certificate_status}});
                    debugLog("Invalid channelId detected =", channelId, " <> ", this.securityToken.channelId);
                    return this._sendFatalErrorAndAbort(
                        StatusCodes.BadCommunicationError,
                        "Invalid Channel Id specified " + this.securityToken.channelId,
                        message,
                        () => {
                            /** */
                        }
                    );
                }

                /**
                 * notify the observer that a OPCUA message has been received.
                 * It is up to one observer to call send_response or _send_ServiceFault_and_abort to complete
                 * the transaction.
                 *
                 * @event message
                 * @param message
                 */
                this.emit("message", message);
            }
        }
    }

    /**
     * @method _check_receiverCertificateThumbprint
     * verify that the receiverCertificateThumbprint send by the client
     * matching the CertificateThumbPrint of the server
     * @param clientSecurityHeader
     * @return true if the receiver certificate thumbprint matches the server certificate
     * @private
     */
    private _check_receiverCertificateThumbprint(clientSecurityHeader: SecurityHeader): boolean {
        if (clientSecurityHeader instanceof SymmetricAlgorithmSecurityHeader) {
            return true; // nothing we can do here
        }

        if (clientSecurityHeader.receiverCertificateThumbprint) {
            // check if the receiverCertificateThumbprint is my certificate thumbprint
            const serverCertificate = this.getCertificate();
            const myCertificateThumbPrint = makeSHA1Thumbprint(serverCertificate);
            const thisIsMyCertificate =
                myCertificateThumbPrint.toString("hex") === clientSecurityHeader.receiverCertificateThumbprint.toString("hex");
            if (doDebug && !thisIsMyCertificate) {
                debugLog(
                    "receiverCertificateThumbprint do not match server certificate",
                    myCertificateThumbPrint.toString("hex") +
                        " <> " +
                        clientSecurityHeader.receiverCertificateThumbprint.toString("hex")
                );
            }
            return thisIsMyCertificate;
        }
        return true;
    }

    // Bad_CertificateHostNameInvalid            The HostName used to connect to a Server does not match a HostName in the
    //                                           Certificate.
    // Bad_CertificateIssuerRevocationUnknown    It was not possible to determine if the Issuer Certificate has been revoked.
    // Bad_CertificateIssuerUseNotAllowed        The Issuer Certificate may not be used for the requested operation.
    // Bad_CertificateIssuerTimeInvalid          An Issuer Certificate has expired or is not yet valid.
    // Bad_CertificateIssuerRevoked              The Issuer Certificate has been revoked.
    // Bad_CertificateInvalid                    The certificate provided as a parameter is not valid.
    // Bad_CertificateRevocationUnknown          It was not possible to determine if the Certificate has been revoked.
    // Bad_CertificateRevoked                    The Certificate has been revoked.
    // Bad_CertificateTimeInvalid                The Certificate has expired or is not yet valid.
    // Bad_CertificateUriInvalid                 The URI specified in the ApplicationDescription does not match the URI in the Certificate.
    // Bad_CertificateUntrusted                  The Certificate is not trusted.
    // Bad_CertificateUseNotAllowed              The Certificate may not be used for the requested operation.

    // Bad_RequestTypeInvalid     The security token request type is not valid.
    // Bad_SecurityModeRejected   The security mode does not meet the requirements set by the Server.
    // Bad_SecurityPolicyRejected The security policy does not meet the requirements set by the Server.
    // Bad_SecureChannelIdInvalid
    // Bad_NonceInvalid

    private _on_OpenSecureChannelRequestError(
        serviceResult: StatusCode,
        description: string,
        message: Message,
        callback: ErrorCallback
    ) {
        debugLog("ServerSecureChannel sendError: ", serviceResult.toString(), description, message.request.constructor.name);

        // turn of security mode as we haven't manage to set it to
        this.securityMode = MessageSecurityMode.None;
        // setTimeout(() => {
        this._sendFatalErrorAndAbort(serviceResult, description, message, callback);
        // }, ServerSecureChannelLayer.throttleTime); // Throttling keep connection on hold for a while.
    }
}

(ServerSecureChannelLayer as any).prototype.checkCertificateCallback = callbackify(
    (ServerSecureChannelLayer as any).prototype.checkCertificate
);
