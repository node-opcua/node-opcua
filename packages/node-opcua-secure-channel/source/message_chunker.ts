/**
 * @module node-opcua-secure-channel
 */

import type { Mode } from "node-opcua-chunkmanager";
import { make_errorLog, make_warningLog } from "node-opcua-debug";
import type { BaseUAObject } from "node-opcua-factory";
import { MessageSecurityMode, SymmetricAlgorithmSecurityHeader } from "node-opcua-service-secure-channel";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { timestamp } from "node-opcua-utils";

import { SecureChunkWriter } from "./secure_chunk_writer.js";
import {
    SecureMessageChunkManager,
    type SecureMessageChunkManagerOptions,
    type SecurityHeader
} from "./secure_message_chunk_manager.js";
import { SequenceNumberGenerator } from "./sequence_number_generator.js";

const doTraceChunk = process.env.NODEOPCUADEBUG && process.env.NODEOPCUADEBUG.indexOf("CHUNK") >= 0;
const errorLog = make_errorLog("secure_channel");
const _warningLog = make_warningLog("secure_channel");

export interface MessageChunkerOptions {
    securityHeader?: SecurityHeader;
    securityMode: MessageSecurityMode;
    maxMessageSize?: number;
    maxChunkCount?: number;
}

export type MessageCallbackFunc = (chunk: Buffer | null) => void;

export interface ChunkMessageParameters {
    channelId: number;
    securityHeader: SecurityHeader;
    securityOptions: SecureMessageChunkManagerOptions;
}

export class MessageChunker {
    /** the maxMessageSize of a chunker created without one */
    public static defaultMaxMessageSize: number = 16 * 1024 * 1024;
    public static readonly defaultChunkCount: number = 0; // 0 => no limits
    /** floor for the growable encode buffer, so tiny messages do not keep reallocating */
    public static readonly minimumMessageSizeHint: number = SecureChunkWriter.minimumMessageSizeHint;
    /** the largest encode buffer kept from one message to the next */
    public static readonly maxRetainedEncodeBufferSize: number = SecureChunkWriter.maxRetainedEncodeBufferSize;

    /** the writer of the symmetric messages of the current token, see #writerFor */
    #writer: SecureChunkWriter | null = null;
    /**
     * set while a message signed asynchronously (a remote HSM/KMS key) waits for its signature: its
     * sequence numbers are taken, so a message chunked meanwhile, with later sequence numbers, must not
     * reach the wire before it (the peer requires them in order). Its sends wait in #deferredSends.
     */
    #asyncInFlight: Promise<void> | null = null;
    #deferredSends: (() => void)[] = [];
    #draining = false;

    public maxMessageSize: number;
    public maxChunkCount: number;
    public securityMode: MessageSecurityMode;
    readonly #sequenceNumberGenerator: SequenceNumberGenerator = new SequenceNumberGenerator();
    constructor(options?: MessageChunkerOptions) {
        options = options || { securityMode: MessageSecurityMode.Invalid };
        this.securityMode = options.securityMode || MessageSecurityMode.None;
        this.maxMessageSize = options.maxMessageSize || MessageChunker.defaultMaxMessageSize;
        this.maxChunkCount = options.maxChunkCount === undefined ? MessageChunker.defaultChunkCount : options.maxChunkCount;
    }

    public dispose(): void {
        this.#writer = null;
        this.#deferredSends = [];
    }

    /**
     * a SecureMessageChunkManager for a message of `messageLength` bytes, sharing this chunker's
     * sequence numbers, after the maxChunkCount and maxMessageSize checks.
     *
     * Deprecated: the chunker writes every message with a {@link SecureChunkWriter}, which produces the
     * same bytes. Kept for code that drives the chunk managers itself; to be removed in the next major
     * version.
     */
    public prepareChunk(
        msgType: string,
        params: ChunkMessageParameters,
        messageLength: number
    ): { statusCode: StatusCode; chunkManager: SecureMessageChunkManager | null } {
        try {
            const chunkManager = new SecureMessageChunkManager(
                this.securityMode as unknown as Mode,
                msgType,
                params.channelId,
                params.securityOptions,
                params.securityHeader,
                this.#sequenceNumberGenerator
            );
            const { chunkCount, totalLength } = chunkManager.evaluateTotalLengthAndChunks(messageLength);
            if (this.maxChunkCount > 0 && chunkCount > this.maxChunkCount) {
                errorLog(
                    `[NODE-OPCUA-E10] message chunkCount ${chunkCount} exceeds the negotiated maximum chunk count ${this.maxChunkCount}, message current size is ${totalLength}`
                );
                return { statusCode: StatusCodes.BadTcpMessageTooLarge, chunkManager: null };
            }
            // OPC 10000-6 v1.05.07 §7.1.2.3/7.1.2.4: "The Message size is calculated using the
            // unencrypted Message body."
            if (this.maxMessageSize > 0 && messageLength > this.maxMessageSize) {
                errorLog(
                    `[NODE-OPCUA-E11] message body ${messageLength} exceeds the negotiated message size ${this.maxMessageSize} nb chunks ${chunkCount}`
                );
                return { statusCode: StatusCodes.BadTcpMessageTooLarge, chunkManager: null };
            }
            return { statusCode: StatusCodes.Good, chunkManager };
        } catch (_err) {
            return { statusCode: StatusCodes.BadTcpInternalError, chunkManager: null };
        }
    }

    /**
     * The largest message body the chunker accepts with these parameters, or 0 when neither
     * limit applies: the negotiated maxMessageSize, and maxChunkCount times what one chunk
     * carries under the channel's security. The second is the tighter one whenever a peer
     * derives its chunk count as maxMessageSize / bufferSize, as the CTT does, because every
     * chunk also spends bytes on headers.
     */
    public maxBodySize(_msgType: string, params: ChunkMessageParameters): number {
        const byMessageSize = this.maxMessageSize > 0 ? this.maxMessageSize : Number.POSITIVE_INFINITY;
        let byChunkCount = Number.POSITIVE_INFINITY;
        if (this.maxChunkCount > 0) {
            const options = params.securityOptions;
            const secure = this.securityMode !== MessageSecurityMode.None;
            byChunkCount =
                this.maxChunkCount *
                SecureChunkWriter.computeMaxBodySize(
                    SecureChunkWriter.headerSize(params.securityHeader),
                    options.chunkSize || 8192,
                    secure ? options.signatureLength || 0 : 0,
                    secure ? options.plainBlockSize || 0 : 0,
                    secure ? options.cipherBlockSize || 0 : 0
                );
        }
        const limit = Math.min(byMessageSize, byChunkCount);
        return Number.isFinite(limit) ? limit : 0;
    }

    /**
     * writes `message` as one or more chunks, handed to `messageChunkCallback` in order, then
     * `null`; returns a bad StatusCode, without calling back, when the message cannot be sent
     * (too large for the negotiated limits, or security options the chunker cannot apply).
     * A signature produced asynchronously needs {@link chunkSecureMessageAsync}.
     */
    public chunkSecureMessage(
        msgType: string,
        params: ChunkMessageParameters,
        message: BaseUAObject,
        messageChunkCallback: MessageCallbackFunc
    ): StatusCode {
        if (params.securityOptions.signBufferAsyncFunc && this.securityMode !== MessageSecurityMode.None) {
            errorLog(`[NODE-OPCUA-E12] ${msgType}: an asynchronous signature needs chunkSecureMessageAsync`);
            return StatusCodes.BadInternalError;
        }
        const writer = this.#writerFor(msgType, params);
        if (!writer) {
            return StatusCodes.BadTcpInternalError;
        }
        if (this.#asyncInFlight || this.#draining) {
            // sequence numbers are taken now; the chunks leave after the message in flight, in order
            const chunks: Buffer[] = [];
            const statusCode = writer.writeMessage(msgType, params.securityOptions.requestId, message, (chunk) =>
                chunks.push(chunk)
            );
            if (statusCode === StatusCodes.Good) {
                this.#deferredSends.push(() => this.#deliver(msgType, chunks, messageChunkCallback));
            }
            return statusCode;
        }
        const trace = doTraceChunk ? this.#trace(msgType, messageChunkCallback) : null;
        const statusCode = writer.writeMessage(
            msgType,
            params.securityOptions.requestId,
            message,
            trace ? trace.send : messageChunkCallback
        );
        if (statusCode !== StatusCodes.Good) {
            return statusCode;
        }
        if (trace) {
            trace.finish();
        } else {
            messageChunkCallback(null);
        }
        return StatusCodes.Good;
    }

    /**
     * {@link chunkSecureMessage} for an asynchronous signature (the OPN signature produced by a
     * remote HSM/KMS provider): the chunks are delivered to the callback, in order, once all are
     * signed, and the returned promise settles after the final `null` callback. A provider failure
     * rejects and delivers nothing. Messages chunked while it waits are delivered after it, in order.
     */
    public async chunkSecureMessageAsync(
        msgType: string,
        params: ChunkMessageParameters,
        message: BaseUAObject,
        messageChunkCallback: MessageCallbackFunc
    ): Promise<StatusCode> {
        // one asynchronous message at a time, after the deferred sends of the previous one
        while (this.#asyncInFlight || this.#draining) {
            await (this.#asyncInFlight ?? Promise.resolve());
        }
        let settled: () => void = () => {
            /* replaced below */
        };
        this.#asyncInFlight = new Promise<void>((resolve) => {
            settled = resolve;
        });
        try {
            const writer = this.#writerFor(msgType, params);
            if (!writer) {
                return StatusCodes.BadTcpInternalError;
            }
            const chunks: Buffer[] = [];
            const statusCode = await writer.writeMessageAsync(msgType, params.securityOptions.requestId, message, (chunk) =>
                chunks.push(chunk)
            );
            if (statusCode === StatusCodes.Good) {
                this.#deliver(msgType, chunks, messageChunkCallback);
            }
            return statusCode;
        } finally {
            this.#asyncInFlight = null;
            this.#drainDeferredSends();
            settled();
        }
    }

    /** the sends of the messages chunked while an asynchronous one was in flight, in order */
    #drainDeferredSends(): void {
        this.#draining = true;
        try {
            for (let send = this.#deferredSends.shift(); send; send = this.#deferredSends.shift()) {
                send();
            }
        } finally {
            this.#draining = false;
        }
    }

    /** the chunks of one message to the callback, then `null` */
    #deliver(msgType: string, chunks: Buffer[], messageChunkCallback: MessageCallbackFunc): void {
        const trace = doTraceChunk ? this.#trace(msgType, messageChunkCallback) : null;
        for (const chunk of chunks) {
            if (trace) {
                trace.send(chunk);
            } else {
                messageChunkCallback(chunk);
            }
        }
        if (trace) {
            trace.finish();
        } else {
            messageChunkCallback(null);
        }
    }

    /**
     * the writer of a message: for a symmetric one (MSG, CLO), the writer of the channel's current
     * token, kept from one message to the next while the token, its keys (the functions
     * getOptionsForSymmetricSignAndEncrypt makes once per keys) and the limits stay the same; for
     * OpenSecureChannel, a writer of its own. Null when the security options cannot be applied.
     */
    #writerFor(msgType: string, params: ChunkMessageParameters): SecureChunkWriter | null {
        const securityOptions = params.securityOptions;
        const securityHeader = params.securityHeader;
        const symmetric = securityHeader instanceof SymmetricAlgorithmSecurityHeader;
        if (symmetric && this.#writer?.isFor(this, params)) {
            return this.#writer;
        }
        if (!SecureChunkWriter.supports(this.securityMode, securityOptions)) {
            errorLog(`[NODE-OPCUA-E13] ${msgType}: security options that ${MessageSecurityMode[this.securityMode]} cannot apply`);
            return null;
        }
        const secure = this.securityMode !== MessageSecurityMode.None;
        try {
            const writer = new SecureChunkWriter({
                channelId: params.channelId,
                securityHeader,
                securityMode: this.securityMode,
                securityOptions: secure ? securityOptions : null,
                chunkSize: securityOptions.chunkSize,
                maxMessageSize: this.maxMessageSize,
                maxChunkCount: this.maxChunkCount,
                sequenceNumberGenerator: this.#sequenceNumberGenerator
            });
            if (symmetric) {
                if (this.#writer) {
                    writer.adoptEncodeBuffer(this.#writer);
                }
                this.#writer = writer;
            }
            return writer;
        } catch (err) {
            errorLog(`[NODE-OPCUA-E13] ${msgType}: ${(err as Error).message}`);
            return null;
        }
    }

    /** the callback of the chunks, counting them for the NODEOPCUADEBUG=CHUNK trace, and its final `null` */
    #trace(msgType: string, messageChunkCallback: MessageCallbackFunc): { send: (chunk: Buffer) => void; finish: () => void } {
        let nbChunks = 0;
        let totalSize = 0;
        return {
            send: (chunk) => {
                nbChunks++;
                totalSize += chunk.length;
                messageChunkCallback(chunk);
            },
            finish: () => {
                console.log(
                    timestamp(),
                    "   <$$ ",
                    msgType,
                    `nbChunk = ${nbChunks.toString().padStart(3)}`,
                    `totalLength = ${totalSize.toString().padStart(8)}`,
                    "maxChunkCount=",
                    this.maxChunkCount,
                    "maxMessageSize=",
                    this.maxMessageSize
                );
                messageChunkCallback(null);
            }
        };
    }
}
