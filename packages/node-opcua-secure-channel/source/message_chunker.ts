/**
 * @module node-opcua-secure-channel
 */
// tslint:disable:max-line-length

import { assert } from "node-opcua-assert";
import { encodeExpandedNodeId } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import { DerivedKeys } from "node-opcua-crypto";
import { BaseUAObject } from "node-opcua-factory";
import { AsymmetricAlgorithmSecurityHeader, SymmetricAlgorithmSecurityHeader } from "node-opcua-service-secure-channel";
import { timestamp } from "node-opcua-utils";
import { make_errorLog, make_warningLog } from "node-opcua-debug";
import { SequenceHeader } from "node-opcua-chunkmanager";

import { SecureMessageChunkManager, SecureMessageChunkManagerOptions, SecurityHeader } from "./secure_message_chunk_manager";
import { SequenceNumberGenerator } from "./sequence_number_generator";

const doTraceChunk = process.env.NODEOPCUADEBUG && process.env.NODEOPCUADEBUG.indexOf("CHUNK") >= 0;
const errorLog = make_errorLog("secure_channel");
const warningLog = make_warningLog("secure_channel");

export interface MessageChunkerOptions {
    securityHeader?: SecurityHeader;
    derivedKeys?: DerivedKeys | null;
    maxMessageSize?: number;
    maxChunkCount?: number;
}

export type MessageCallbackFunc = (err: Error | null, chunk: Buffer | null) => void;

export interface ChunkMessageOptions extends SecureMessageChunkManagerOptions {
    tokenId: number;
}

/**
 * @class MessageChunker
 * @param options {Object}
 * @param options.securityHeader  {Object} SecurityHeader
 * @param [options.derivedKeys] {Object} derivedKeys
 * @constructor
 */
export class MessageChunker {
    public static defaultMaxMessageSize: number = 16 * 1024 * 1024;
    public static readonly defaultChunkCount: number = 0; // 0 => no limits

    public securityHeader?: AsymmetricAlgorithmSecurityHeader | SymmetricAlgorithmSecurityHeader | null;

    private readonly sequenceNumberGenerator: SequenceNumberGenerator;
    private _stream?: BinaryStream;
    private derivedKeys?: DerivedKeys | null;
    public maxMessageSize: number;
    public maxChunkCount: number;

    constructor(options?: MessageChunkerOptions) {
        options = options || {};
        this.sequenceNumberGenerator = new SequenceNumberGenerator();
        this.maxMessageSize = options.maxMessageSize || MessageChunker.defaultMaxMessageSize;
        this.maxChunkCount = options.maxChunkCount === undefined ? MessageChunker.defaultChunkCount : options.maxChunkCount;
        this.update(options);
    }

    public dispose(): void {
        this.securityHeader = null;
        this.derivedKeys = undefined;
        this._stream = undefined;
    }

    /***
     * update security information
     */
    public update(options?: MessageChunkerOptions): void {
        options = options || {};
        options.securityHeader =
            options.securityHeader ||
            new AsymmetricAlgorithmSecurityHeader({
                securityPolicyUri: "http://opcfoundation.org/UA/SecurityPolicy#None"
            });

        assert(options !== null && typeof options === "object");
        assert(options.securityHeader !== null && typeof options.securityHeader === "object");

        this.securityHeader = options.securityHeader;
        this.derivedKeys = options.derivedKeys || undefined;
    }

    public chunkSecureMessage(
        msgType: string,
        options: ChunkMessageOptions,
        message: BaseUAObject,
        messageChunkCallback: MessageCallbackFunc
    ): void {
        assert(typeof messageChunkCallback === "function");

        const makeAbandonChunk = () => {
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

            stream.writeUInt32(options.channelId || 0); // secure channel id

            const securityHeader = new SymmetricAlgorithmSecurityHeader({
                tokenId: options.tokenId
            });
            securityHeader.encode(stream);

            const sequenceHeader = new SequenceHeader({
                sequenceNumber: this.sequenceNumberGenerator.next(),
                requestId: options.requestId /// fix me
            });
            sequenceHeader.encode(stream);

            // write chunk length
            const length = stream.length;
            stream.length = 4;
            stream.writeUInt32(length);
            stream.length = length;
            return buffer;
        };
        // calculate message size ( with its  encodingDefaultBinary)
        const binSize = message.binaryStoreSize() + 4;
        const stream = new BinaryStream(binSize);
        this._stream = stream;

        encodeExpandedNodeId(message.schema.encodingDefaultBinary!, stream);
        message.encode(stream);

        let securityHeader;
        if (msgType === "OPN") {
            securityHeader = this.securityHeader;
        } else {
            securityHeader = new SymmetricAlgorithmSecurityHeader({ tokenId: options.tokenId });
        }

        const chunkManager = new SecureMessageChunkManager(msgType, options, securityHeader || null, this.sequenceNumberGenerator);

        const { chunkCount, totalLength } = chunkManager.evaluateTotalLengthAndChunks(stream.buffer.length);
        if (this.maxChunkCount > 0 && chunkCount > this.maxChunkCount) {
            errorLog(
                `[NODE-OPCUA-E10] message chunkCount ${chunkCount} exceeds the negotiated maximum chunk count ${this.maxChunkCount}, message current size is ${totalLength}`
            );
            return messageChunkCallback(
                new Error("message chunkCount exceeds the negotiated maximum message count"),
                makeAbandonChunk()
            );
        }
        if (this.maxMessageSize > 0 && totalLength > this.maxMessageSize) {
            errorLog(
                `[NODE-OPCUA-E11] message size ${totalLength} exceeds the negotiated message size ${this.maxMessageSize} nb chunks ${chunkCount}`
            );

            return messageChunkCallback(new Error("message size exceeds the negotiated message size"), makeAbandonChunk());
        }

        let nbChunks = 0;
        let totalSize = 0;
        chunkManager
            .on("chunk", (messageChunk: Buffer) => {
                nbChunks++;
                totalSize += messageChunk.length;

                if (this.maxChunkCount && nbChunks > this.maxChunkCount) {
                    errorLog(
                        `[NODE-OPCUA-E09] message chunkCount ${nbChunks} exceeds the negotiated maximum message count ${this.maxChunkCount}, message current size is ${totalSize}`
                    );
                }
                messageChunkCallback(null, messageChunk);
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
                        binSize.toString().padStart(6)
                    );
                }

                if (totalSize > this.maxMessageSize) {
                    errorLog(
                        `[NODE-OPCUA-E07] message size ${totalSize} exceeds the negotiated message size ${this.maxMessageSize} nb chunks ${nbChunks}`
                    );
                }
                messageChunkCallback(null, null);
            });

        chunkManager.write(stream.buffer, stream.buffer.length);

        chunkManager.end();
    }
}
