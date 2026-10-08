/**
 * @module node-opcua-secure-channel
 */

import { encodeExpandedNodeId } from "node-opcua-basic-types";
import { BinaryStream, BinaryStreamMaxSizeExceededError } from "node-opcua-binary-stream";
import type { Mode } from "node-opcua-chunkmanager";
import { make_errorLog, make_warningLog } from "node-opcua-debug";
import type { BaseUAObject } from "node-opcua-factory";
import { MessageSecurityMode, SymmetricAlgorithmSecurityHeader } from "node-opcua-service-secure-channel";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { timestamp } from "node-opcua-utils";

import {
    SecureMessageChunkManager,
    type SecureMessageChunkManagerOptions,
    type SecurityHeader
} from "./secure_message_chunk_manager.js";
import { SequenceNumberGenerator } from "./sequence_number_generator.js";

/** a single MSG chunk without security: message header (12), symmetric security header (4), sequence header (8) */
const PLAIN_HEADERS_SIZE = 24;

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
    public static defaultMaxMessageSize: number = 16 * 1024 * 1024;
    public static readonly defaultChunkCount: number = 0; // 0 => no limits
    /** floor for the growable encode buffer, so tiny messages do not keep reallocating */
    public static readonly minimumMessageSizeHint: number = 4 * 1024;

    /** size of the last message encoded on this chunker, used to size the next one */
    #messageSizeHint: number = MessageChunker.minimumMessageSizeHint;
    /** the largest encode buffer kept from one message to the next, see #takeEncodeBuffer */
    public static readonly maxRetainedEncodeBufferSize: number = 64 * 1024;
    #encodeBuffer: Buffer | null = null;

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
        this.#encodeBuffer = null;
    }

    /**
     * The buffer a message is encoded into is only read by the chunk manager, which copies
     * it into the chunks before `write` returns: it can serve the next message instead of
     * being allocated and collected for each one. It is taken here and given back by
     * #recycleEncodeBuffer, so a message encoded while another is in flight gets its own.
     */
    #takeEncodeBuffer(ceiling: number): BinaryStream {
        const buffer = this.#encodeBuffer;
        this.#encodeBuffer = null;
        return BinaryStream.createGrowable(buffer ?? Math.min(this.#messageSizeHint, ceiling), ceiling);
    }

    #recycleEncodeBuffer(stream: BinaryStream): void {
        if (stream.buffer.length <= MessageChunker.maxRetainedEncodeBufferSize) {
            this.#encodeBuffer = stream.buffer;
        }
    }

    #_build_chunk_manager(msgType: string, params: ChunkMessageParameters): SecureMessageChunkManager {
        const securityHeader = params.securityHeader;
        const channelId = params.channelId;
        const mode = this.securityMode as unknown as Mode;
        const chunkManager = new SecureMessageChunkManager(
            mode,
            msgType,
            channelId,
            params.securityOptions,
            securityHeader,
            this.#sequenceNumberGenerator
        );
        return chunkManager;
    }
    public prepareChunk(
        msgType: string,
        params: ChunkMessageParameters,
        messageLength: number
    ): { statusCode: StatusCode; chunkManager: SecureMessageChunkManager | null } {
        // calculate message size ( with its  encodingDefaultBinary)
        try {
            const chunkManager = this.#_build_chunk_manager(msgType, params);

            const { chunkCount, totalLength } = chunkManager.evaluateTotalLengthAndChunks(messageLength);

            if (this.maxChunkCount > 0 && chunkCount > this.maxChunkCount) {
                errorLog(
                    `[NODE-OPCUA-E10] message chunkCount ${chunkCount} exceeds the negotiated maximum chunk count ${this.maxChunkCount}, message current size is ${totalLength}`
                );
                errorLog(
                    `[NODE-OPCUA-E10] ${messageLength} totalLength = ${totalLength} chunkManager.maxBodySize = ${this.maxMessageSize}`
                );
                return { statusCode: StatusCodes.BadTcpMessageTooLarge, chunkManager: null };
            }
            // OPC 10000-6 v1.05.07 §7.1.2.3/7.1.2.4: "The Message size is calculated using the
            // unencrypted Message body." totalLength is whole chunks - headers, signature,
            // padding, the last one rounded up - and refused bodies the peer accepts.
            if (this.maxMessageSize > 0 && messageLength > this.maxMessageSize) {
                errorLog(
                    `[NODE-OPCUA-E11] message body ${messageLength} exceeds the negotiated message size ${this.maxMessageSize} nb chunks ${chunkCount}`
                );
                return { statusCode: StatusCodes.BadTcpMessageTooLarge, chunkManager: null };
            }
            return { statusCode: StatusCodes.Good, chunkManager: chunkManager };
        } catch (_err) {
            return { statusCode: StatusCodes.BadTcpInternalError, chunkManager: null };
        }
    }
    /**
     * The largest message body {@link prepareChunk} accepts with these parameters, or 0
     * when neither limit applies: the negotiated maxMessageSize, and maxChunkCount times
     * what one chunk carries under the channel's security. The second is the tighter one
     * whenever a peer derives its chunk count as maxMessageSize / bufferSize, as the CTT
     * does, because every chunk also spends bytes on headers.
     */
    public maxBodySize(msgType: string, params: ChunkMessageParameters): number {
        const byMessageSize = this.maxMessageSize > 0 ? this.maxMessageSize : Number.POSITIVE_INFINITY;
        const byChunkCount =
            this.maxChunkCount > 0
                ? this.maxChunkCount * this.#_build_chunk_manager(msgType, params).maxBodySize
                : Number.POSITIVE_INFINITY;
        const limit = Math.min(byMessageSize, byChunkCount);
        return Number.isFinite(limit) ? limit : 0;
    }

    /**
     * Encode the message and prepare the chunk manager, wired to the chunk
     * callback — the part {@link chunkSecureMessage} and
     * {@link chunkSecureMessageAsync} share.
     */
    /**
     * the message encoded (its encodingDefaultBinary, then its fields) after `prefix` bytes left for the
     * headers of a single chunk (see chunkSecureMessage); null with the StatusCode of a refusal
     */
    #encode(message: BaseUAObject, prefix: number): { stream: BinaryStream; messageLength: number } | StatusCode {
        const encodingDefaultBinary = message.schema.encodingDefaultBinary;
        if (!encodingDefaultBinary) {
            throw new Error(`message schema ${message.schema.name} has no encodingDefaultBinary`);
        }

        // Encode once, into a stream that grows as needed. The previous form ran the whole
        // object graph through a BinaryStreamSizeCalculator to learn the length and then
        // encoded it a second time; both passes traverse everything and cost about the
        // same, so sizing was roughly half the work.
        //
        // Growth is capped at the negotiated maximum message size, so encoding before the
        // oversize check cannot be used to make us allocate without bound.
        const ceiling = this.maxMessageSize > 0 ? this.maxMessageSize : MessageChunker.defaultMaxMessageSize;
        const stream = this.#takeEncodeBuffer(ceiling + prefix);
        stream.length = prefix;
        try {
            encodeExpandedNodeId(encodingDefaultBinary, stream);
            message.encode(stream);
        } catch (err) {
            if (err instanceof BinaryStreamMaxSizeExceededError) {
                errorLog(`[NODE-OPCUA-E11] ${message.schema.name}: ${err.message}`);
                return StatusCodes.BadTcpMessageTooLarge;
            }
            throw err;
        }
        const messageLength = stream.length - prefix;
        // remember the size so the next message on this channel usually fits without growing,
        // up to the size of buffer worth keeping: a rare large message grows its buffer instead
        this.#messageSizeHint = Math.min(
            Math.max(MessageChunker.minimumMessageSizeHint, messageLength),
            MessageChunker.maxRetainedEncodeBufferSize
        );
        return { stream, messageLength };
    }

    #_encode_and_prepare(
        msgType: string,
        params: ChunkMessageParameters,
        message: BaseUAObject,
        messageChunkCallback: MessageCallbackFunc
    ): { statusCode: StatusCode; chunkManager: SecureMessageChunkManager | null; stream: BinaryStream; messageLength: number } {
        const encoded = this.#encode(message, 0);
        if (!("stream" in encoded)) {
            return { statusCode: encoded, chunkManager: null, stream: null as unknown as BinaryStream, messageLength: 0 };
        }
        return this.#prepare(msgType, params, encoded.stream, encoded.messageLength, messageChunkCallback);
    }

    #prepare(
        msgType: string,
        params: ChunkMessageParameters,
        stream: BinaryStream,
        messageLength: number,
        messageChunkCallback: MessageCallbackFunc
    ): { statusCode: StatusCode; chunkManager: SecureMessageChunkManager | null; stream: BinaryStream; messageLength: number } {
        const failed = (statusCode: StatusCode) => ({
            statusCode,
            chunkManager: null,
            stream: null as unknown as BinaryStream,
            messageLength: 0
        });
        const { statusCode, chunkManager } = this.prepareChunk(msgType, params, messageLength);
        if (statusCode !== StatusCodes.Good) {
            return failed(statusCode);
        }
        if (!chunkManager) {
            return failed(StatusCodes.BadInternalError);
        }

        let nbChunks = 0;
        let totalSize = 0;
        chunkManager
            .on("chunk", (messageChunk: Buffer) => {
                nbChunks++;
                totalSize += messageChunk.length;
                messageChunkCallback(messageChunk);
            })
            .on("finished", () => {
                if (doTraceChunk) {
                    console.log(
                        timestamp(),
                        "   <$$ ",
                        msgType,
                        `nbChunk = ${nbChunks.toString().padStart(3)}`,
                        `totalLength = ${totalSize.toString().padStart(8)}`,
                        "l=",
                        messageLength.toString().padStart(6),
                        "maxChunkCount=",
                        this.maxChunkCount,
                        "maxMessageSize=",
                        this.maxMessageSize
                    );
                }
                messageChunkCallback(null);
            });

        return { statusCode: StatusCodes.Good, chunkManager, stream, messageLength };
    }

    public chunkSecureMessage(
        msgType: string,
        params: ChunkMessageParameters,
        message: BaseUAObject,
        messageChunkCallback: MessageCallbackFunc
    ): StatusCode {
        if (
            msgType === "MSG" &&
            this.securityMode === MessageSecurityMode.None &&
            params.securityHeader instanceof SymmetricAlgorithmSecurityHeader
        ) {
            return this.#chunkPlainMessage(params, params.securityHeader.tokenId, message, messageChunkCallback);
        }
        const { statusCode, chunkManager, stream, messageLength } = this.#_encode_and_prepare(
            msgType,
            params,
            message,
            messageChunkCallback
        );
        if (statusCode !== StatusCodes.Good || !chunkManager) {
            return statusCode;
        }
        // inject buffer to chunk manager.
        // note: the growable buffer is usually larger than the message, so the length must
        // come from the cursor - stream.buffer.length would ship uninitialised tail bytes
        chunkManager.write(stream.buffer, messageLength);
        this.#recycleEncodeBuffer(stream);
        chunkManager.end();
        return StatusCodes.Good;
    }

    /**
     * a MSG of a channel without security, as most responses are: encoded after room for its headers and,
     * when it fits one chunk, sent as that chunk, its headers written in place (OPC 10000-6 6.7.2: message
     * header, symmetric security header, sequence header) without the chunk managers. A larger message is
     * chunked by them as any other.
     */
    #chunkPlainMessage(
        params: ChunkMessageParameters,
        tokenId: number,
        message: BaseUAObject,
        messageChunkCallback: MessageCallbackFunc
    ): StatusCode {
        const encoded = this.#encode(message, PLAIN_HEADERS_SIZE);
        if (!("stream" in encoded)) return encoded;
        const { stream, messageLength } = encoded;
        const chunkSize = params.securityOptions.chunkSize || 8192;
        const total = PLAIN_HEADERS_SIZE + messageLength;
        if (total > chunkSize || (this.maxMessageSize > 0 && messageLength > this.maxMessageSize)) {
            const { statusCode, chunkManager } = this.#prepare("MSG", params, stream, messageLength, messageChunkCallback);
            if (statusCode !== StatusCodes.Good || !chunkManager) {
                return statusCode;
            }
            chunkManager.write(stream.buffer.subarray(PLAIN_HEADERS_SIZE), messageLength);
            this.#recycleEncodeBuffer(stream);
            chunkManager.end();
            return StatusCodes.Good;
        }
        // the chunk leaves this thread with the transport: its own buffer, the encode buffer is reused
        const chunk = Buffer.allocUnsafe(total);
        stream.buffer.copy(chunk, 0, 0, total);
        this.#recycleEncodeBuffer(stream);
        chunk[0] = 0x4d; // M
        chunk[1] = 0x53; // S
        chunk[2] = 0x47; // G
        chunk[3] = 0x46; // F: the final chunk
        chunk.writeUInt32LE(total, 4);
        chunk.writeUInt32LE(params.channelId, 8);
        chunk.writeUInt32LE(tokenId, 12);
        chunk.writeUInt32LE(this.#sequenceNumberGenerator.next(), 16);
        chunk.writeUInt32LE(params.securityOptions.requestId, 20);
        if (doTraceChunk) {
            console.log(
                timestamp(),
                "   <$$ ",
                "MSG",
                "nbChunk =   1",
                `totalLength = ${total.toString().padStart(8)}`,
                "l=",
                messageLength.toString().padStart(6)
            );
        }
        messageChunkCallback(chunk);
        messageChunkCallback(null);
        return StatusCodes.Good;
    }

    /**
     * {@link chunkSecureMessage} for an asynchronously-signing chunk manager
     * (the OPN signature produced by a remote HSM/KMS provider): chunks are
     * delivered to the callback as each one's signing settles, in order, and
     * the returned promise settles after the final `null` callback. A
     * provider failure rejects.
     */
    public async chunkSecureMessageAsync(
        msgType: string,
        params: ChunkMessageParameters,
        message: BaseUAObject,
        messageChunkCallback: MessageCallbackFunc
    ): Promise<StatusCode> {
        const { statusCode, chunkManager, stream, messageLength } = this.#_encode_and_prepare(
            msgType,
            params,
            message,
            messageChunkCallback
        );
        if (statusCode !== StatusCodes.Good || !chunkManager) {
            return statusCode;
        }
        chunkManager.write(stream.buffer, messageLength);
        this.#recycleEncodeBuffer(stream);
        await chunkManager.endAsync();
        return StatusCodes.Good;
    }
}
