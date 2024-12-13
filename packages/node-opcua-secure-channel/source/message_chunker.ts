/**
 * @module node-opcua-secure-channel
 */
// tslint:disable:max-line-length

import { assert } from "node-opcua-assert";
import { encodeExpandedNodeId, StatusCode, StatusCodes } from "node-opcua-basic-types";
import { BinaryStream, BinaryStreamSizeCalculator } from "node-opcua-binary-stream";
import { BaseUAObject } from "node-opcua-factory";
import { AsymmetricAlgorithmSecurityHeader, MessageSecurityMode, SymmetricAlgorithmSecurityHeader } from "node-opcua-service-secure-channel";
import { timestamp } from "node-opcua-utils";
import { make_errorLog, make_warningLog } from "node-opcua-debug";
import { Mode, SequenceHeader } from "node-opcua-chunkmanager";

import { SecureMessageChunkManager, SecureMessageChunkManagerOptions, SecurityHeader } from "./secure_message_chunk_manager";
import { SequenceNumberGenerator } from "./sequence_number_generator";

const doTraceChunk = process.env.NODEOPCUADEBUG && process.env.NODEOPCUADEBUG.indexOf("CHUNK") >= 0;
const errorLog = make_errorLog("secure_channel");
const warningLog = make_warningLog("secure_channel");

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

    public dispose(): void { }

    #makeAbandonChunk(params: ChunkMessageParameters) {
        const finalC = "A";
        const msgType = "MSG";
        const buffer = Buffer.alloc(
            // MSGA
            4 +
            // length
            4 +
            // secureChannelId
            4 +
            // tokenId
            4 +
            2 * 4
        );
        const stream = new BinaryStream(buffer);

        // message header --------------------------
        // ---------------------------------------------------------------
        // OPC UA Secure Conversation Message Header : Part 6 page 36
        // MessageType     Byte[3]
        // IsFinal         Byte[1]  C : intermediate, F: Final , A: Final with Error
        // MessageSize     UInt32   The length of the MessageChunk, in bytes. This value includes size of the message header.
        // SecureChannelId UInt32   A unique identifier for the ClientSecureChannelLayer assigned by the server.

        stream.writeUInt8(msgType.charCodeAt(0));
        stream.writeUInt8(msgType.charCodeAt(1));
        stream.writeUInt8(msgType.charCodeAt(2));
        stream.writeUInt8(finalC.charCodeAt(0));

        stream.writeUInt32(0); // will be written later

        stream.writeUInt32(params.channelId || 0); // secure channel id

        const securityHeader =
            params.securityHeader ||
            new SymmetricAlgorithmSecurityHeader({
                tokenId: 0
            });

        securityHeader.encode(stream);

        const sequenceHeader = new SequenceHeader({
            sequenceNumber: this.#sequenceNumberGenerator.next(),
            requestId: params.securityOptions.requestId /// fix me
        });
        sequenceHeader.encode(stream);

        // write chunk length
        const length = stream.length;
        stream.length = 4;
        stream.writeUInt32(length);
        stream.length = length;
        return buffer;
    }



    #_build_chunk_manager(msgType: string, params: ChunkMessageParameters): SecureMessageChunkManager {
        let securityHeader = params.securityHeader;
        if (msgType === "OPN") {
            assert(securityHeader instanceof AsymmetricAlgorithmSecurityHeader);
        } else if (msgType === "MSG") {
            assert(securityHeader instanceof SymmetricAlgorithmSecurityHeader);
        }
        const channelId = params.channelId;
        const mode = this.securityMode as unknown as Mode;
        const chunkManager = new SecureMessageChunkManager(mode, msgType, channelId, params.securityOptions, securityHeader, this.#sequenceNumberGenerator);
        return chunkManager;
    }
    public prepareChunk(msgType: string,
        params: ChunkMessageParameters,
        messageLength: number,
    ): { statusCode: StatusCode, chunkManager: SecureMessageChunkManager | null } {
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
        } catch (err) {
            return { statusCode: StatusCodes.BadTcpInternalError, chunkManager: null };
        }
    }
    public chunkSecureMessage(
        msgType: string,
        params: ChunkMessageParameters,
        message: BaseUAObject,
        messageChunkCallback: MessageCallbackFunc
    ): StatusCode {

        const calculateMessageLength = (message: BaseUAObject) => {
            const stream = new BinaryStreamSizeCalculator();
            encodeExpandedNodeId(message.schema.encodingDefaultBinary!, stream);
            message.encode(stream);
            return stream.length;
        }
        // evaluate the message size
        const messageLength = calculateMessageLength(message);

        const { statusCode, chunkManager } = this.prepareChunk(msgType, params, messageLength);
        if (statusCode !== StatusCodes.Good) {
            return statusCode;
        }
        if (!chunkManager) {
            return StatusCodes.BadInternalError;
        }

        let nbChunks = 0;
        let totalSize = 0;
        chunkManager.on("chunk", (messageChunk: Buffer) => {
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
                        "nbChunk = " + nbChunks.toString().padStart(3),
                        "totalLength = " + totalSize.toString().padStart(8),
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

        // create buffer to stream 
        const stream = new BinaryStream(messageLength);
        encodeExpandedNodeId(message.schema.encodingDefaultBinary!, stream);
        message.encode(stream);
        // inject buffer to chunk manager
        chunkManager.write(stream.buffer, stream.buffer.length);
        chunkManager.end();
        return StatusCodes.Good;
    }
}
