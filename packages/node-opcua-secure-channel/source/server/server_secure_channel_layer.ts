/* eslint-disable max-statements */
/**
 * @module node-opcua-secure-channel
 */
import { createPublicKey, randomBytes } from "crypto";
import { EventEmitter } from "events";
import { Socket } from "net";
import { callbackify } from "util";
import chalk from "chalk";

import { assert } from "node-opcua-assert";
import {
    Certificate,
    exploreCertificateInfo,
    extractPublicKeyFromCertificate,
    makeSHA1Thumbprint,
    PublicKeyLength,
    rsaLengthPublicKey,
    rsaLengthPrivateKey,
    exploreCertificate,
    hexDump,
    PublicKey,
    PrivateKey,
    split_der
} from "node-opcua-crypto/web";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { BaseUAObject } from "node-opcua-factory";
import { analyze_object_binary_encoding } from "node-opcua-packet-analyzer";
import {
    ChannelSecurityToken,
    hasTokenExpired,
    MessageSecurityMode,
    SymmetricAlgorithmSecurityHeader
} from "node-opcua-service-secure-channel";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { IHelloAckLimits, ISocketLike, ServerTCP_transport, StatusCodes2 } from "node-opcua-transport";
import { get_clock_tick, timestamp } from "node-opcua-utils";
import { Callback2, ErrorCallback } from "node-opcua-status-code";
import { EndpointDescription } from "node-opcua-service-endpoints";
import { ICertificateManager } from "node-opcua-certificate-manager";
import { ObjectRegistry } from "node-opcua-object-registry";
import { doTraceIncomingChunk } from "node-opcua-transport";
import { getPartialCertificateChain } from "node-opcua-common";
import { SecurityHeader } from "../secure_message_chunk_manager";
import { getThumbprint, ICertificateKeyPairProvider, Request, Response } from "../common";
import { invalidPrivateKey, MessageBuilder, ObjectFactory } from "../message_builder";
import { ChunkMessageParameters, MessageChunker } from "../message_chunker";
import {
    coerceSecurityPolicy,
    computeDerivedKeys,
    DerivedKeys1,
    fromURI,
    getCryptoFactory,
    getOptionsForSymmetricSignAndEncrypt,
    SecureMessageData,
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
import { TokenStack } from "../token_stack";

const debugLog = make_debugLog("SecureChannel");
const errorLog = make_errorLog("SecureChannel");
const doDebug = checkDebugFlag("SecureChannel");
const warningLog = make_warningLog("SecureChannel");

const allowNullRequestId = true;
let gLastChannelId = 0;

function getNextChannelId() {
    gLastChannelId += 1;
    return gLastChannelId;
}

export interface ServerSecureChannelParent extends ICertificateKeyPairProvider {
    certificateManager: ICertificateManager;

    getCertificate(): Certificate;

    getCertificateChain(): Certificate;

    getPrivateKey(): PrivateKey;

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

    adjustTransportLimits?: (hello: IHelloAckLimits) => IHelloAckLimits;
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
    securityHeader: SecurityHeader;
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

export type Nonce = Buffer;
/**
 * returns true if the nonce is null or zero (all bytes set to 0)
 */
export function isEmptyNonce(nonce: Nonce): boolean {
    const countZero = nonce.reduce((accumulator: number, currentValue: number) => accumulator + (currentValue === 0 ? 1 : 0), 0);
    return countZero === nonce.length;
}
const g_alreadyUsedNonce: any = {};
export function nonceAlreadyBeenUsed(nonce?: Nonce): boolean {
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
 */
export class ServerSecureChannelLayer extends EventEmitter {
    public static throttleTime = 100;

    private static g_MinimumSecureTokenLifetime = 2500;
    private static g_counter = 0;
    #counter: number = ServerSecureChannelLayer.g_counter++;
    #status: "new" | "connecting" | "open" | "closing" | "closed" = "new";

    public beforeHandleOpenSecureChannelRequest = async (): Promise<void> => { };
    public get securityTokenCount(): number {
        assert(typeof this.#lastTokenId === "number");
        return this.#lastTokenId;
    }

    public get remoteAddress(): string {
        return this.#_remoteAddress;
    }

    public get remotePort(): number {
        return this.#_remotePort;
    }

    /**
     *
     */
    public get aborted(): boolean {
        return this.#abort_has_been_called;
    }

    /**
     * the number of bytes read so far by this channel
     */
    public get bytesRead(): number {
        return this.#transport ? this.#transport.bytesRead : 0;
    }

    /**
     * the number of bytes written so far by this channel
     */
    public get bytesWritten(): number {
        return this.#transport ? this.#transport.bytesWritten : 0;
    }

    public get transactionsCount(): number {
        return this.#transactionsCount;
    }

    /**
     * true when the secure channel has been opened successfully
     *
     */
    public get isOpened(): boolean {
        return this.#status === "open";
    }

    /**
     * true when the secure channel is assigned to a active session
     */
    public get hasSession(): boolean {
        return Object.keys(this.sessionTokens).length > 0;
    }

    public get certificateManager(): ICertificateManager {
        return this.#parent!.certificateManager!;
    }

    /**
     * The unique hash key to identify this secure channel
     * @property hashKey
     */
    public get hashKey(): number {
        return this.channelId;
    }

    public static registry = new ObjectRegistry();
    public _on_response: ((msgType: string, response: Response, message: Message) => void) | null;
    public sessionTokens: { [key: string]: IServerSessionBase };
    public channelId: number;
    public timeout: number;

    #messageBuilder?: MessageBuilder;

    public get clientCertificate(): Certificate | null {
        return this.#clientCertificate;
    }
    /**
     * the channel message security mode
     */
    public securityMode: MessageSecurityMode;
    /**
     * the channel message security policy
     */
    public securityPolicy: SecurityPolicy = SecurityPolicy.Invalid;

    #parent: ServerSecureChannelParent | null;
    readonly #protocolVersion: number;
    #lastTokenId: number;
    readonly #defaultSecureTokenLifetime: number;
    #clientCertificate: Certificate | null;
    #clientPublicKey: PublicKey | null;
    #clientPublicKeyLength: number;
    readonly #messageChunker: MessageChunker;

    #timeoutId: NodeJS.Timeout | null;
    #open_secure_channel_onceClose: ErrorCallback | null = null;
    #securityTokenTimeout: NodeJS.Timeout | null;
    #transactionsCount: number;
    readonly #transport: ServerTCP_transport;
    #objectFactory?: ObjectFactory;
    #last_transaction_stats?: ServerTransactionStatistics;
    #startReceiveTick: number;
    #endReceiveTick: number;
    #startSendResponseTick: number;
    #endSendResponseTick: number;
    #_bytesRead_before: number;
    #_bytesWritten_before: number;
    #_remoteAddress: string;
    #_remotePort: number;
    #abort_has_been_called: boolean;
    #idVerification: any;
    #transport_socket_close_listener?: any;
    #tokenStack: TokenStack;

    public get status() {
        return this.#status;
    }
    public constructor(options: ServerSecureChannelLayerOptions) {
        super();

        this._on_response = null;
        this.#idVerification = {};
        this.#abort_has_been_called = false;
        this.#_remoteAddress = "";
        this.#_remotePort = 0;
        this.#clientPublicKey = null;
        this.#clientPublicKeyLength = 0;
        this.#clientCertificate = null;
        this.#transport = new ServerTCP_transport({ adjustLimits: options.adjustTransportLimits });

        this.channelId = getNextChannelId();
        this.#tokenStack = new TokenStack(this.channelId);

        this.#parent = options.parent;

        this.#protocolVersion = 0;

        this.#lastTokenId = 0;

        this.timeout = options.timeout || 30000; // connection timeout

        this.#defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 600000;
        // istanbul ignore next
        doDebug &&
            debugLog(
                "server secure channel layer timeout = ",
                this.timeout,
                "defaultSecureTokenLifetime = ",
                this.#defaultSecureTokenLifetime
            );

        // at first use a anonymous connection
        const securityHeader = new AsymmetricAlgorithmSecurityHeader({
            receiverCertificateThumbprint: null,
            securityPolicyUri: SecurityPolicy.None,
            senderCertificate: null
        });

        this.#startReceiveTick = 0;
        this.#endReceiveTick = 0;
        this.#startSendResponseTick = 0;
        this.#endSendResponseTick = 0;
        this.#_bytesRead_before = 0;
        this.#_bytesWritten_before = 0;

        this.securityMode = MessageSecurityMode.Invalid;
        // use to send response
        this.#messageChunker = new MessageChunker({
            securityHeader, // for OPN
            securityMode: MessageSecurityMode.Invalid,
            maxMessageSize: this.#transport.maxMessageSize,
            maxChunkCount: this.#transport.maxChunkCount
        });

        this.#timeoutId = null;
        this.#securityTokenTimeout = null;

        this.#transactionsCount = 0;

        this.sessionTokens = {};

        this.#objectFactory = options.objectFactory;

        // xx #422 self.setMaxListeners(200); // increase the number of max listener
    }

    public getTransportSettings() {
        return { maxMessageSize: this.#transport.maxMessageSize };
    }

    public dispose(): void {
        debugLog("ServerSecureChannelLayer#dispose");
        this.#_stop_open_channel_watch_dog();
        assert(!this.#timeoutId, "timeout must have been cleared");
        assert(!this.#securityTokenTimeout, "_securityTokenTimeout must have been cleared");

        this.#parent = null;
        this.#objectFactory = undefined;

        if (this.#messageBuilder) {
            this.#messageBuilder.dispose();
            this.#messageBuilder = undefined;
        }

        if (this.#messageChunker) {
            this.#messageChunker.dispose();
        }
        if (this.#transport) {
            this.#transport.dispose();
            (this as any).transport = undefined;
        }
        this.channelId = 0xdeadbeef;
        this.#timeoutId = null;
        this.sessionTokens = {};
        this.removeAllListeners();
    }

    public abruptlyInterrupt(): void {
        const clientSocket = this.#transport._socket;
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
        if (!this.#parent) {
            return null; // throw new Error("getEndpointDescription - no parent");
        }
        return this.#parent.getEndpointDescription(this.securityMode, securityPolicy, endpointUri);
    }

    public setSecurity(securityMode: MessageSecurityMode, securityPolicy: SecurityPolicy): void {
        if (!this.#messageBuilder) {
            this.#_build_message_builder();
        }
        assert(this.#messageBuilder);
        // TODO verify that the endpoint really supports this mode
        this.#messageBuilder!.setSecurity(securityMode, securityPolicy);
    }

    /**

     * @return the X509 DER form certificate
     */
    public getCertificateChain(): Certificate {
        if (!this.#parent) {
            throw new Error("expecting a valid parent");
        }
        return this.#parent.getCertificateChain();
    }

    /**

     * @return  the X509 DER form certificate
     */
    public getCertificate(): Certificate {
        if (!this.#parent) {
            throw new Error("expecting a valid parent");
        }
        return this.#parent.getCertificate();
    }

    public getSignatureLength(): PublicKeyLength {
        const firstCertificateInChain = this.getCertificate();
        const cert = exploreCertificateInfo(firstCertificateInChain);
        return cert.publicKeyLength; // 1024 bits = 128Bytes or 2048=256Bytes
    }

    /**

     * @return the privateKey
     */
    public getPrivateKey(): PrivateKey {
        if (!this.#parent) {
            return invalidPrivateKey;
        }
        return this.#parent.getPrivateKey();
    }

    /**
     * 
     */
    public init(socket: ISocketLike, callback: ErrorCallback): void {
        this.#transport.timeout = this.timeout;
        debugLog("Setting socket timeout to ", this.#transport.timeout);

        this.#transport.init(socket, (err?: Error | null) => {
            if (err) {
                callback(err);
            } else {
                this.#_build_message_builder();

                this.#_rememberClientAddressAndPort();

                // adjust sizes;
                this.#messageChunker.maxMessageSize = this.#transport.maxMessageSize;
                this.#messageChunker.maxChunkCount = this.#transport.maxChunkCount;

                // bind low level TCP transport to messageBuilder
                this.#transport.on("chunk", (messageChunk: Buffer) => {
                    // istanbul ignore next
                    if (doTraceIncomingChunk) {
                        console.log(hexDump(messageChunk));
                    }
                    this.#messageBuilder!.feed(messageChunk);
                });
                debugLog("ServerSecureChannelLayer : Transport layer has been initialized");
                debugLog("... now waiting for OpenSecureChannelRequest...");

                ServerSecureChannelLayer.registry.register(this);

                this.#_wait_for_open_secure_channel_request(this.timeout);
                callback();
            }
        });

        // detect transport closure
        this.#transport_socket_close_listener = (err?: Error) => {
            debugLog("transport has send 'close' event " + (err ? err.message : "null"));
            this.#_abort();
        };
        this.#transport.on("close", this.#transport_socket_close_listener);
    }

    /**
     * @internal
     */
    public send_response(msgType: string, response: Response, message: Message, callback?: ErrorCallback): void {
        const request = message.request;
        const requestId = message.requestId;
        assert(allowNullRequestId || requestId !== 0);

        if (this.aborted) {
            debugLog("channel has been terminated , cannot send responses");
            return callback && callback(new Error("Aborted"));
        }

        // istanbul ignore next
        if (doDebug) {
            assert(request.schema);
            assert(allowNullRequestId || requestId > 0);
            // verify that response for a given requestId is only sent once.
            if (!this.#idVerification) {
                this.#idVerification = {};
            }
            assert(!this.#idVerification[requestId], " response for requestId has already been sent !! - Internal Error");
            this.#idVerification[requestId] = requestId;
        }

        if (doPerfMonitoring) {
            // record tick : send response received.
            this.#startSendResponseTick = get_clock_tick();
        }

        const tokenId = message.securityHeader instanceof SymmetricAlgorithmSecurityHeader ? message.securityHeader.tokenId : 0;
        const channelId = this.channelId;
        const securityHeader = message.securityHeader!;

        const securityOptions =
            msgType === "OPN" ? this.#_get_security_options_for_OPN() : this.#_get_security_options_for_MSG(tokenId);

        const chunkSize = this.#transport.receiveBufferSize;
        let options: ChunkMessageParameters = {
            channelId,
            securityOptions: {
                chunkSize,
                requestId,
                // to be adjusted
                signatureLength: 0,
                plainBlockSize: 0,
                cipherBlockSize: 0,
                sequenceHeaderSize: 0,
                ...securityOptions
            },
            securityHeader
        };

        response.responseHeader.requestHandle = request.requestHeader.requestHandle;

        if (message.request.requestHeader.returnDiagnostics === 0) {
            response.responseHeader.serviceDiagnostics = null;
        } else {
            // #  to do
        }
        /* istanbul ignore next */
        if (0 && doDebug) {
            debugLog(" options ", options);
            analyze_object_binary_encoding(response as any as BaseUAObject);
        }

        /* istanbul ignore next */
        if (doTraceServerMessage) {
            traceResponseMessage(response, tokenId, channelId, this.#counter);
        }

        if (this._on_response) {
            this._on_response(msgType, response, message);
        }

        this.#transactionsCount += 1;

        this.#messageChunker.securityMode = this.securityMode;

        const statusCode = this.#messageChunker.chunkSecureMessage(msgType, options, response as BaseUAObject, (chunk) => {
            if (chunk) {
                this.#_send_chunk(chunk);
            } else {
                /* istanbul ignore next */
                if (doPerfMonitoring) {
                    // record tick 3 : transaction completed.
                    this.#endSendResponseTick = get_clock_tick();
                    this.#_record_transaction_statistics();
                    // dump some statistics about transaction ( time and sizes )
                    _dump_transaction_statistics(this.#last_transaction_stats);
                }
                callback && callback();
                this.emit("transaction_done");
            }
        });
        if (statusCode.isNotGood()) {
            // the message has not been sent, we need to raise an exception
            return this.send_response(
                msgType,
                new ServiceFault({ responseHeader: { serviceResult: statusCode } }),
                message,
                callback
            );
        }
    }

    public getRemoteIPAddress(): string {
        return (this.#transport?._socket as Socket)?.remoteAddress || "";
    }

    public getRemotePort(): number {
        return (this.#transport?._socket as Socket)?.remotePort || 0;
    }

    public getRemoteFamily(): string {
        return (this.#transport?._socket as Socket)?.remoteFamily || "";
    }

    /**
     * Abruptly close a Server SecureChannel ,by terminating the underlying transport.
     *
     */
    public close(callback?: ErrorCallback): void {
        callback = callback || (() => { });
        if (!this.#transport) {
            if (typeof callback === "function") {
                callback();
            }
            return;
        }
        debugLog("ServerSecureChannelLayer#close");
        this.#status = "closing";
        // close socket
        this.#transport.disconnect(() => {
            this.#status = "closed";
            this.#_abort();
            if (typeof callback === "function") {
                callback();
            }
        });
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
        if (statusCode.isGood()) {
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

    #_build_message_builder() {
        // use to receive client requests
        this.#messageBuilder = new MessageBuilder(this.#tokenStack.clientKeyProvider(), {
            name: "server",
            objectFactory: this.#objectFactory,
            privateKey: this.getPrivateKey(),
            maxChunkSize: this.#transport.receiveBufferSize,
            maxChunkCount: this.#transport.maxChunkCount,
            maxMessageSize: this.#transport.maxMessageSize
        });
        debugLog(" this.transport.maxChunkCount", this.#transport.maxChunkCount);
        debugLog(" this.transport.maxMessageSize", this.#transport.maxMessageSize);

        this.#messageBuilder.on("error", (err, statusCode) => {
            warningLog("ServerSecureChannel:MessageBuilder: ", err.message, statusCode.toString());
            // istanbul ignore next
            if (doDebug) {
                debugLog(chalk.red("Error "), err.message, err.stack);
                debugLog(chalk.red("Server is now closing socket, without further notice"));
            }

            this.#transport.sendErrorMessage(statusCode, err.message);
            // close socket immediately
            this.close(() => {
                /* */
            });
        });
    }

    #_sendFatalErrorAndAbort(statusCode: StatusCode, description: string, message: Message, callback: ErrorCallback): void {
        this.#transport.sendErrorMessage(statusCode, description);
        if (!this.#transport) {
            return callback(new Error("Transport has been closed"));
        }
        this.#status = "closing";
        this.#transport.disconnect(() => {
            this.close(() => {
                this.#status = "closed";
                callback(new Error(description + " statusCode = " + statusCode.toString()));
            });
        });
    }

    #_has_endpoint_for_security_mode_and_policy(securityMode: MessageSecurityMode, securityPolicy: SecurityPolicy): boolean {
        if (!this.#parent) {
            return true;
        }
        const endpoint_desc = this.getEndpointDescription(securityMode, securityPolicy, null);
        return endpoint_desc !== null;
    }

    #_rememberClientAddressAndPort(): void {
        if (this.#transport && this.#transport._socket) {
            this.#_remoteAddress = this.#transport._socket.remoteAddress || "";
            this.#_remotePort = this.#transport._socket.remotePort || 0;
        }
    }

    #_stop_security_token_watch_dog() {
        if (this.#securityTokenTimeout) {
            clearTimeout(this.#securityTokenTimeout);
            this.#securityTokenTimeout = null;
        }
    }

    #_start_security_token_watch_dog(securityToken: ChannelSecurityToken) {
        // install securityToken timeout watchdog
        this.#securityTokenTimeout = setTimeout(
            () => {
                warningLog(
                    " Security token has really expired and shall be discarded !!!! (lifetime is = ",
                    securityToken.revisedLifetime,
                    ")"
                );
                warningLog(" Server will now refuse message with token ", securityToken.tokenId);
                this.#securityTokenTimeout = null;
            },
            (securityToken.revisedLifetime * 125) / 100
        );
    }

    #_prepare_security_token(
        openSecureChannelRequest: OpenSecureChannelRequest,
        derivedKeys: DerivedKeys1 | null
    ): ChannelSecurityToken {
        const adjustLifetime = (requestedLifetime: number) => {
            let revisedLifetime = requestedLifetime;
            if (revisedLifetime === 0) {
                revisedLifetime = this.#defaultSecureTokenLifetime;
            } else {
                revisedLifetime = Math.min(this.#defaultSecureTokenLifetime, revisedLifetime);
                revisedLifetime = Math.max(ServerSecureChannelLayer.g_MinimumSecureTokenLifetime, revisedLifetime);
            }
            return revisedLifetime;
        };

        if (openSecureChannelRequest.requestType === SecurityTokenRequestType.Renew) {
            this.#_stop_security_token_watch_dog();
        }

        const requestedLifetime = openSecureChannelRequest.requestedLifetime;
        const revisedLifetime = adjustLifetime(requestedLifetime);

        doDebug && debugLog("revisedLifeTime = ", revisedLifetime, "requestedLifeTime = ", requestedLifetime);

        this.#lastTokenId += 1;
        const securityToken = new ChannelSecurityToken({
            channelId: this.channelId,
            createdAt: new Date(), // now
            revisedLifetime,
            tokenId: this.#lastTokenId // todo ?
        });

        if (hasTokenExpired(securityToken)) {
            warningLog("Token has already expired", securityToken);
        }
        this.#_start_security_token_watch_dog(securityToken);
        this.#tokenStack.pushNewToken(securityToken, derivedKeys);
        return securityToken;
    }

    #_stop_open_channel_watch_dog() {
        if (this.#timeoutId) {
            clearTimeout(this.#timeoutId);
            this.#timeoutId = null;
        }
        if (this.#open_secure_channel_onceClose) {
            this.#transport.removeListener("close", this.#open_secure_channel_onceClose!);
            this.#open_secure_channel_onceClose = null;
        }
    }

    #_cleanup_pending_timers() {
        // there is no need for the security token expiration event to trigger anymore
        this.#_stop_security_token_watch_dog();
        this.#_stop_open_channel_watch_dog();
    }

    #_cancel_wait_for_open_secure_channel_request_timeout() {
        this.#_stop_open_channel_watch_dog();
    }

    #_install_wait_for_open_secure_channel_request_timeout(timeout: number) {

        this.#open_secure_channel_onceClose = (err?: Error) => {
            this.#open_secure_channel_onceClose = null;
            this.#_stop_open_channel_watch_dog();
            this.close(() => {
                const err = new Error("Timeout waiting for OpenChannelRequest (A) (timeout was " + timeout + " ms)");
                this.emit("abort", err);
            });
        };
        this.#transport.prependOnceListener("close", this.#open_secure_channel_onceClose);
        this.#timeoutId = setTimeout(() => {
            this.#timeoutId = null;
            this.#_stop_open_channel_watch_dog();
            const err = new Error("Timeout waiting for OpenChannelRequest (B) (timeout was " + timeout + " ms)");
            debugLog(err.message);
            this.close(() => {
              // 
            });
        }, timeout);
    }

    #_on_initial_open_secure_channel_request(
        request: Request,
        requestId: number,
        channelId: number
    ) {
        this.#status = "connecting";

        /* istanbul ignore next */
        if (doTraceServerMessage) {
            traceRequestMessage(request as Request, channelId, this.#counter);
        }

        /* istanbul ignore next */
        if (!(this.#messageBuilder && this.#messageBuilder.sequenceHeader && this.#messageBuilder.securityHeader)) {
            const securityHeader = new AsymmetricAlgorithmSecurityHeader({ securityPolicyUri: SecurityPolicy.None });
            return this.#_on_OpenSecureChannelRequestError(
                StatusCodes.BadCommunicationError,
                "internal error",
                { request, requestId, securityHeader }
            );
        }

        const message = {
            request,
            requestId,
            securityHeader: this.#messageBuilder.securityHeader
        };

        //xx  requestId = this.messageBuilder.sequenceHeader.requestId;
        /* istanbul ignore next */
        if (requestId < 0) {
            return this.#_on_OpenSecureChannelRequestError(
                StatusCodes.BadCommunicationError,
                "Invalid requestId",
                message
            );
        }

        let description: string = "";

        // expecting a OpenChannelRequest as first communication message
        /* istanbul ignore next */
        if (!(request instanceof OpenSecureChannelRequest)) {
            description = "Expecting OpenSecureChannelRequest";
            return this.#_on_OpenSecureChannelRequestError(StatusCodes.BadCommunicationError, description, message);
        }

        // check that the request is a OpenSecureChannelRequest

        /* istanbul ignore next */
        if (doDebug) {
            debugLog(this.#messageBuilder.sequenceHeader.toString());
            debugLog(this.#messageBuilder.securityHeader.toString());
            debugLog(request.toString());
        }

        const asymmetricSecurityHeader = this.#messageBuilder.securityHeader as AsymmetricAlgorithmSecurityHeader;

        const securityMode = request.securityMode;
        this.securityMode = securityMode;
        this.#messageBuilder.securityMode = securityMode;

        const securityPolicy = message.securityHeader
            ? fromURI(asymmetricSecurityHeader.securityPolicyUri)
            : SecurityPolicy.Invalid;

        // check security header
        const securityPolicyStatus: StatusCode = isValidSecurityPolicy(securityPolicy);
        if (securityPolicyStatus !== StatusCodes.Good) {
            description = " Unsupported securityPolicyUri " + asymmetricSecurityHeader.securityPolicyUri;
            return this.#_on_OpenSecureChannelRequestError(securityPolicyStatus, description, message);
        }

        const hasEndpoint = this.#_has_endpoint_for_security_mode_and_policy(securityMode, securityPolicy);
        if (!hasEndpoint) {
            // there is no
            description = " This server doesn't not support  " + securityPolicy.toString() + " " + securityMode.toString();
            return this.#_on_OpenSecureChannelRequestError(StatusCodes.BadSecurityPolicyRejected, description, message);
        }

        this.#messageBuilder
            .on("message", (request, msgType, securityHeader, requestId, channelId) => {
                this.#_on_common_message(request as Request, msgType, securityHeader, requestId, channelId);
            })
            .on("error", (err: Error, statusCode: StatusCode, requestId: number | null) => {
                /** */
                this.#transport.sendErrorMessage(statusCode, err.message);
                this.close(() => {
                    /** */
                });
            })
            .on("startChunk", () => {
                /* istanbul ignore next */
                if (doPerfMonitoring) {
                    // record tick 0: when the first chunk is received
                    this.#startReceiveTick = get_clock_tick();
                }
            });

        // handle initial OpenSecureChannelRequest
        this.#_process_certificates(message, (err: Error | null, statusCode?: StatusCode) => {
            // istanbul ignore next
            if (err || !statusCode) {
                description = "Internal Error " + err?.message;
                return this.#_on_OpenSecureChannelRequestError(statusCode || StatusCodes.BadInternalError, description, message);
            }

            if (statusCode.isNotGood()) {
                warningLog("Sender Certificate thumbprint ", getThumbprint(asymmetricSecurityHeader.senderCertificate));
                // OPCUA specification v1.02 part 6 page 42 $6.7.4
                // If an error occurs after the  Server  has verified  Message  security  it  shall  return a  ServiceFault  instead
                // of a OpenSecureChannel  response. The  ServiceFault  Message  is described in  Part  4,   7.28.
                if (
                    statusCode.isNot(StatusCodes.BadCertificateIssuerRevocationUnknown) &&
                    statusCode.isNot(StatusCodes.BadCertificateRevocationUnknown) &&
                    statusCode.isNot(StatusCodes.BadCertificateTimeInvalid) &&
                    statusCode.isNot(StatusCodes.BadCertificateUseNotAllowed)
                ) {
                    statusCode = StatusCodes.BadSecurityChecksFailed;
                }
                // Those are not considered as error but as a warning
                //    BadCertificateIssuerRevocationUnknown,
                //    BadCertificateRevocationUnknown,
                //    BadCertificateTimeInvalid,
                //    BadCertificateUseNotAllowed
                //
                // the client will decided what to do next
                return this.#_on_OpenSecureChannelRequestError(statusCode!, "certificate invalid", message);
            }
            this.#_handle_OpenSecureChannelRequest(message);
        });
    }

    #_wait_for_open_secure_channel_request(timeout: number) {
        this.#_install_wait_for_open_secure_channel_request_timeout(timeout);

        const errorHandler = (err: Error) => {
            this.#_cancel_wait_for_open_secure_channel_request_timeout();

            if (this.#messageBuilder) {
                this.#messageBuilder.removeListener("message", messageHandler);
                const err = new Error("/Expecting OpenSecureChannelRequest to be valid ");
                this.emit("abort", err);
            }
        };

        const messageHandler = (
            request: BaseUAObject,
            msgType: string,
            securityHeader: SecurityHeader,
            requestId: number,
            channelId: number
        ) => {
            this.#_cancel_wait_for_open_secure_channel_request_timeout();
            this.#messageBuilder!.removeListener("error", errorHandler);
            this.#_on_initial_open_secure_channel_request(request as Request, requestId, channelId);
        };
        this.#messageBuilder!.prependOnceListener("error", errorHandler);
        this.#messageBuilder!.once("message", messageHandler);
    }

    write(messageChunk: Buffer) {
        this.#transport.write(messageChunk);
    }
    #_send_chunk(messageChunk: Buffer) {
        this.write(messageChunk);
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
        const cryptoFactory = getCryptoFactory(this.#messageBuilder!.securityPolicy!);
        /* istanbul ignore next */
        if (!cryptoFactory) {
            throw new Error("Internal Error: ServerSecureChannelLayer must have a crypto strategy");
        }

        assert(this.#clientPublicKeyLength >= 0);

        const receiverPublicKey = this.#clientPublicKey;
        if (!receiverPublicKey) {
            // this could happen if certificate was wrong
            // throw new Error("Invalid receiverPublicKey");
            return null;
        }
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
        const derivedKeys = this.#tokenStack.getTokenDerivedKeys(tokenId);
        // istanbul ignore next
        if (!derivedKeys || !derivedKeys.derivedServerKeys) {
            errorLog("derivedKeys not set but security mode = ", MessageSecurityMode[this.securityMode]);
            return null;
        }
        const options = getOptionsForSymmetricSignAndEncrypt(this.securityMode, derivedKeys.derivedServerKeys);
        return options;
    }

    /**
     * _process_certificates extracts client public keys from client certificate
     *  and store them in self.receiverPublicKey and self.receiverCertificate
     *  it also caches self.receiverPublicKeyLength.
     *
     *  so they can be used by security channel.
     */

    #_process_certificates(message: Message, callback: Callback2<StatusCode>): void {
        const asymmSecurityHeader = message.securityHeader as AsymmetricAlgorithmSecurityHeader;

        // verify certificate
        let clientCertificate = asymmSecurityHeader ? asymmSecurityHeader.senderCertificate : null;
        this.checkCertificate(clientCertificate)
            .then((statusCode: StatusCode) => {

                if (statusCode.isNotGood()) {
                    const description = "Sender Certificate Error " + statusCode.toString();
                    warningLog(chalk.cyan(description), chalk.bgCyan.yellow(statusCode!.toString()));
                    const chain = split_der(clientCertificate!);
                    warningLog(
                        "Sender Certificate = ",
                        chain.map((c) => getThumbprint(clientCertificate)?.toString("hex")).join("\n")
                    );
                }

                this.#clientCertificate = null;
                this.#clientPublicKey = null;
                this.#clientPublicKeyLength = 0;

                // ignore receiverCertificate that have a zero length
                /* istanbul ignore next */
                if (clientCertificate && clientCertificate.length === 0) {
                    clientCertificate = null;
                }

                if (clientCertificate) {
                    // extract public key
                    extractPublicKeyFromCertificate(clientCertificate, (err, keyPem) => {
                        if (!err) {
                            if (keyPem) {
                                this.#clientCertificate = clientCertificate;
                                this.#clientPublicKey = createPublicKey(keyPem);
                                this.#clientPublicKeyLength = rsaLengthPublicKey(keyPem);
                            }
                            callback(null, statusCode);
                        } else {
                            callback(err);
                        }
                    });
                } else {
                    this.#clientPublicKey = null;
                    callback(null, statusCode);
                }
            }).catch((err) => callback(err));
    }

    #_prepare_response_security_header(request: OpenSecureChannelRequest, message: Message): AsymmetricAlgorithmSecurityHeader {
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
        const evaluateReceiverThumbprint = () => {
            if (this.securityMode === MessageSecurityMode.None) {
                return null;
            }
            const part1 = split_der(this.#clientCertificate!)[0];
            const receiverCertificateThumbprint = getThumbprint(part1);
            return receiverCertificateThumbprint;
        };

        switch (request.securityMode) {
            case MessageSecurityMode.None:
                this.securityPolicy = SecurityPolicy.None;
                securityHeader = new AsymmetricAlgorithmSecurityHeader({
                    receiverCertificateThumbprint: null, // message not encrypted
                    securityPolicyUri: SecurityPolicy.None,
                    senderCertificate: null // message not signed
                });
                break;
            case MessageSecurityMode.Sign:
            case MessageSecurityMode.SignAndEncrypt:
            default: {
                const receiverCertificateThumbprint = evaluateReceiverThumbprint();
                const asymmClientSecurityHeader = message.securityHeader as AsymmetricAlgorithmSecurityHeader;
                this.securityPolicy = coerceSecurityPolicy(asymmClientSecurityHeader.securityPolicyUri || SecurityPolicy.Invalid);
                const maxSenderCertificateSize = undefined;
                const partialCertificateChain = getPartialCertificateChain(this.getCertificateChain(), maxSenderCertificateSize);

                if (this.securityPolicy === SecurityPolicy.Invalid) {
                    warningLog("Invalid Security Policy", this.securityPolicy);
                }

                // istanbul ignore next
                securityHeader = new AsymmetricAlgorithmSecurityHeader({
                    securityPolicyUri: asymmClientSecurityHeader.securityPolicyUri,
                    /**
                     * The thumbprint of the X.509 v3 Certificate assigned to the receiving application Instance.
                     * The thumbprint is the CertificateDigest of the DER encoded form of the Certificate.
                     * This indicates what public key was used to encrypt the MessageChunk.
                     * This field shall be null if the Message is not encrypted.
                     */
                    receiverCertificateThumbprint,
                    /**
                     * The X.509 v3 Certificate assigned to the sending application Instance.
                     *  This is a DER encoded blob.
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
            }
        }
        return securityHeader;
    }

    #_check_client_nonce(clientNonce: Nonce): StatusCode {
        if (this.securityMode !== MessageSecurityMode.None) {
            const cryptoFactory = getCryptoFactory(this.#messageBuilder!.securityPolicy);
            if (!cryptoFactory) {
                return StatusCodes.BadSecurityModeRejected;
            }
            if (clientNonce.length !== cryptoFactory.symmetricKeyLength) {
                warningLog(
                    chalk.red("warning client Nonce length doesn't match server nonce length"),
                    clientNonce.length,
                    " !== ",
                    cryptoFactory.symmetricKeyLength
                );
                // what can we do
                // - just ignore it ?
                // - or adapt serverNonce length to clientNonce Length ?
                // xx self.serverNonce = crypto.randomBytes(self.clientNonce.length);
                // - or adapt clientNonce length to serverNonce Length ?
                // xx self.clientNonce = self.clientNonce.subarray(0,self.serverNonce.length);
                //
                // - or abort connection ? << LET BE SAFE AND CHOOSE THIS ONE !
                return StatusCodes.BadSecurityModeRejected; // ToDo check code
            }

            /* istanbul ignore next */
            if (nonceAlreadyBeenUsed(clientNonce)) {
                warningLog(
                    chalk.red("OPCUAServer with secure connection: this client nonce has already been used"),
                    clientNonce.toString("hex")
                );
                return StatusCodes.BadNonceInvalid;
            }
        }
        return StatusCodes.Good;
    }
    #_make_serverNonce(): Nonce | null {
        if (this.securityMode !== MessageSecurityMode.None) {
            const cryptoFactory = getCryptoFactory(this.#messageBuilder!.securityPolicy)!;
            // serverNonce: A random number that shall not be used in any other request. A new
            //    serverNonce shall be generated for each time a SecureChannel is renewed.
            //    This parameter shall have a length equal to key size used for the symmetric
            //    encryption algorithm that is identified by the securityPolicyUri.
            return randomBytes(cryptoFactory.symmetricKeyLength);
        }
        return null;
    }
    #_make_derivedKeys(serverNonce: Nonce | null, clientNonce: Nonce | null): DerivedKeys1 | null {
        if (this.securityMode !== MessageSecurityMode.None) {
            if (!serverNonce || !clientNonce) {
                throw new Error("Internal Error");
            }
            const cryptoFactory = getCryptoFactory(this.#messageBuilder!.securityPolicy)!;
            return computeDerivedKeys(cryptoFactory, serverNonce, clientNonce);
        }
        return null;
    }
    #_handle_OpenSecureChannelRequest(messageRequest: Message) {
        this.beforeHandleOpenSecureChannelRequest().then(() => {
            let description;
            // If the SecurityMode is not None then the Server shall verify that a SenderCertificate and a
            // ReceiverCertificateThumbprint were specified in the SecurityHeader.
            /* istanbul ignore next */
            if (!messageRequest.securityHeader) {
                throw new Error("Internal Error");
            }

            const request = messageRequest.request as OpenSecureChannelRequest;
            const requestId = messageRequest.requestId;

            // let prepare self.securityHeader;
            const securityHeader = this.#_prepare_response_security_header(request, messageRequest);

            /* istanbul ignore next */
            if (!(requestId !== 0 && requestId > 0)) {
                warningLog("OpenSecureChannelRequest: requestId");
                return this.#_on_OpenSecureChannelRequestError(
                    StatusCodes2.BadTcpInternalError,
                    "invalid request",
                    messageRequest
                );
            }

            const statusCodeClientNonce = this.#_check_client_nonce(request.clientNonce);
            if (statusCodeClientNonce.isNotGood()) {
                return this.#_on_OpenSecureChannelRequestError(statusCodeClientNonce, "invalid nonce", messageRequest);
            }

            if (!this.#_check_receiverCertificateThumbprint(messageRequest.securityHeader)) {
                description =
                    "Server#OpenSecureChannelRequest : Invalid receiver certificate thumbprint : the thumbprint doesn't match server certificate !";
                return this.#_on_OpenSecureChannelRequestError(
                    StatusCodes.BadCertificateInvalid,
                    description,
                    messageRequest
                );
            }

            const serverNonce = this.#_make_serverNonce();
            const derivedKeys = this.#_make_derivedKeys(serverNonce, request.clientNonce);
            const securityToken: ChannelSecurityToken = this.#_prepare_security_token(request, derivedKeys);
            const response: Response = new OpenSecureChannelResponse({
                responseHeader: { serviceResult: StatusCodes.Good },
                securityToken: securityToken,
                serverNonce: serverNonce || undefined,
                serverProtocolVersion: this.#protocolVersion
            });
            /* istanbul ignore next */
            if (doTraceServerMessage) {
                console.log("Transport maxMessageSize = ", this.#transport.maxMessageSize);
                console.log("Transport maxChunkCount  = ", this.#transport.maxChunkCount);
            }

            const messageResponse = {
                ...messageRequest,
                securityHeader: securityHeader
            };

            this.send_response("OPN", response, messageResponse, (err) => {
                const responseHeader = response.responseHeader;
                if (responseHeader.serviceResult !== StatusCodes.Good) {
                    warningLog("OpenSecureChannelRequest Closing communication ", responseHeader.serviceResult.toString());
                    this.#status = "closing";
                    this.close();
                } else {
                    this.#status = "open";
                }
            });
        });
    }

    #_abort() {
        this.#status = "closed";

        debugLog("ServerSecureChannelLayer#_abort");

        if (this.#abort_has_been_called) {
            debugLog("Warning => ServerSecureChannelLayer#_abort has already been called");
            return;
        }

        ServerSecureChannelLayer.registry.unregister(this);

        this.#abort_has_been_called = true;

        this.#_cleanup_pending_timers();
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

    #_record_transaction_statistics() {
        this.#_bytesRead_before = this.#_bytesRead_before || 0;
        this.#_bytesWritten_before = this.#_bytesWritten_before || 0;

        this.#last_transaction_stats = {
            bytesRead: this.bytesRead - this.#_bytesRead_before,
            bytesWritten: this.bytesWritten - this.#_bytesWritten_before,

            lap_reception: this.#endReceiveTick - this.#startReceiveTick,

            lap_processing: this.#startSendResponseTick - this.#endReceiveTick,

            lap_emission: this.#endSendResponseTick - this.#startSendResponseTick
        };

        // final operation in statistics
        this.#_bytesRead_before = this.bytesRead;
        this.#_bytesWritten_before = this.bytesWritten;
    }
    #_on_common_message(request: Request, msgType: string, securityHeader: SecurityHeader, requestId: number, channelId: number) {
        /* istanbul ignore next */
        if (doTraceServerMessage) {
            traceRequestMessage(request, channelId, this.#counter);
        }

        /* istanbul ignore next */
        if (this.#messageBuilder!.sequenceHeader === null) {
            throw new Error("Internal Error");
        }

        requestId = this.#messageBuilder!.sequenceHeader.requestId;

        const message: Message = {
            channel: this,
            request,
            securityHeader,
            requestId
        };
        if (msgType === "CLO" /* && request.schema.name === "CloseSecureChannelRequest" */) {
            this.close();
        } else if (msgType === "OPN" && request.schema.name === "OpenSecureChannelRequest") {
            // intercept client request to renew security Token
            this.#_handle_OpenSecureChannelRequest(message);
        } else {
            if (request.schema.name === "CloseSecureChannelRequest") {
                warningLog("WARNING : RECEIVED a CloseSecureChannelRequest with msgType=", msgType);
                this.close();
            } else {
                /* istanbul ignore next */
                if (doPerfMonitoring) {
                    // record tick 1 : after message has been received, before message processing
                    this.#endReceiveTick = get_clock_tick();
                }

                const getTokenId = (securityHeader: SecurityHeader): number => {
                    if (securityHeader instanceof SymmetricAlgorithmSecurityHeader) {
                        return securityHeader.tokenId;
                    }
                    return 0;
                };
                const tokenId = getTokenId(securityHeader);

                const securityToken = this.#tokenStack.getToken(tokenId);
                if (!securityToken) {
                    const _tokenStack = this.#tokenStack;
                    const description = `cannot find security token ${tokenId}  ${msgType}`;
                    return this.#_sendFatalErrorAndAbort(StatusCodes.BadCommunicationError, description, message, () => { });
                }
                if (securityToken && channelId !== securityToken.channelId) {
                    // response = new ServiceFault({responseHeader: {serviceResult: certificate_status}});
                    const description = `Invalid channelId specified = ${channelId}  <> ${securityToken.channelId}`;
                    return this.#_sendFatalErrorAndAbort(StatusCodes.BadCommunicationError, description, message, () => {
                        /** */
                    });
                }
                /**
                 * notify the observer that a OPCUA message has been received.
                 * It is up to one observer to call send_response or _send_ServiceFault_and_abort to complete
                 * the transaction.
                 */
                this.emit("message", message);
            }
        }
    }

    /**
     * verify that the receiverCertificateThumbprint send by the client
     * matching the CertificateThumbPrint of the server
     */
    #_check_receiverCertificateThumbprint(clientSecurityHeader: SecurityHeader): boolean {
        if (clientSecurityHeader instanceof SymmetricAlgorithmSecurityHeader) {
            return true; // nothing we can do here
        }

        if (clientSecurityHeader.receiverCertificateThumbprint) {
            // check if the receiverCertificateThumbprint is my certificate thumbprint
            const serverCertificate = this.getCertificate();
            const myCertificateThumbPrint = makeSHA1Thumbprint(serverCertificate);
            const myCertificateThumbPrintHex = myCertificateThumbPrint.toString("hex");
            const receiverCertificateThumbprintHex = clientSecurityHeader.receiverCertificateThumbprint.toString("hex");
            const thisIsMyCertificate = myCertificateThumbPrintHex === receiverCertificateThumbprintHex;
            if (doDebug && !thisIsMyCertificate) {
                debugLog(
                    "receiverCertificateThumbprint do not match server certificate",
                    receiverCertificateThumbprintHex + " <> " + myCertificateThumbPrintHex
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

    #_on_OpenSecureChannelRequestError(serviceResult: StatusCode, description: string, message: Message) {
        warningLog("ServerSecureChannel sendError: ", serviceResult.toString(), { description }, message.request.constructor.name);
        this.securityMode = MessageSecurityMode.None;
        this.#status = "closing";

        setTimeout(() => {
            this.send_response(
                "ERR",
                new ServiceFault({
                    responseHeader: {
                        serviceResult,
                        timestamp: new Date(),
                        stringTable: [description, serviceResult.toString()]
                    }
                }),
                message,
                () => {
                    setTimeout(() => {
                        this.close();
                    }, 1000);
                }
            );
        }, ServerSecureChannelLayer.throttleTime); // Throttling keep connection on hold for a while.
    }
}
