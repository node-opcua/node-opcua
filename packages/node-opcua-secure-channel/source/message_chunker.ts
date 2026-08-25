/**
 * @module node-opcua-secure-channel
 */

import { assert } from "node-opcua-assert";
import { encodeExpandedNodeId } from "node-opcua-basic-types";
import { BinaryStream, BinaryStreamMaxSizeExceededError } from "node-opcua-binary-stream";
import type { Mode } from "node-opcua-chunkmanager";
import { make_errorLog, make_warningLog } from "node-opcua-debug";
import type { BaseUAObject } from "node-opcua-factory";
import {
    AsymmetricAlgorithmSecurityHeader,
    MessageSecurityMode,
    SymmetricAlgorithmSecurityHeader
} from "node-opcua-service-secure-channel";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { timestamp } from "node-opcua-utils";

import {
    SecureMessageChunkManager,
    type SecureMessageChunkManagerOptions,
    type SecurityHeader
} from "./secure_message_chunk_manager";
import { SequenceNumberGenerator } from "./sequence_number_generator";

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

    public dispose(): void {}

    #_build_chunk_manager(msgType: string, params: ChunkMessageParameters): SecureMessageChunkManager {
        const securityHeader = params.securityHeader;
        if (msgType === "OPN") {
            assert(securityHeader instanceof AsymmetricAlgorithmSecurityHeader);
        } else if (msgType === "MSG") {
            assert(securityHeader instanceof SymmetricAlgorithmSecurityHeader);
        }
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
            if (this.maxMessageSize > 0 && totalLength > this.maxMessageSize) {
                errorLog(
                    `[NODE-OPCUA-E11] message size ${totalLength} exceeds the negotiated message size ${this.maxMessageSize} nb chunks ${chunkCount}`
                );
                return { statusCode: StatusCodes.BadTcpMessageTooLarge, chunkManager: null };
            }
            return { statusCode: StatusCodes.Good, chunkManager: chunkManager };
        } catch (_err) {
            return { statusCode: StatusCodes.BadTcpInternalError, chunkManager: null };
        }
    }
    public chunkSecureMessage(
        msgType: string,
        params: ChunkMessageParameters,
        message: BaseUAObject,
        messageChunkCallback: MessageCallbackFunc
    ): StatusCode {
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
        const stream = BinaryStream.createGrowable(Math.min(this.#messageSizeHint, ceiling), ceiling);
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
        const messageLength = stream.length;
        // remember the size so the next message on this channel usually fits without growing
        this.#messageSizeHint = Math.max(MessageChunker.minimumMessageSizeHint, messageLength);

        const { statusCode, chunkManager } = this.prepareChunk(msgType, params, messageLength);
        if (statusCode !== StatusCodes.Good) {
            return statusCode;
        }
        if (!chunkManager) {
            return StatusCodes.BadInternalError;
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

        // inject buffer to chunk manager.
        // note: the growable buffer is usually larger than the message, so the length must
        // come from the cursor - stream.buffer.length would ship uninitialised tail bytes
        chunkManager.write(stream.buffer, messageLength);
        chunkManager.end();
        return StatusCodes.Good;
    }
}
