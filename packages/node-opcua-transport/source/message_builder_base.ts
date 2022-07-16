/**
 * @module node-opcua-transport
 */
import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";

import { decodeStatusCode, decodeString, decodeUInt32 } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import { createFastUninitializedBuffer } from "node-opcua-buffer-utils";
import { readMessageHeader, SequenceHeader } from "node-opcua-chunkmanager";
import { make_errorLog, make_debugLog, make_warningLog, hexDump } from "node-opcua-debug";
import { MessageHeader, PacketAssembler, PacketInfo } from "node-opcua-packet-assembler";
import { StatusCode } from "node-opcua-status-code";
import { get_clock_tick } from "node-opcua-utils";
import { StatusCodes2 } from "./status_codes";
const doPerfMonitoring = process.env.NODEOPCUADEBUG && process.env.NODEOPCUADEBUG.indexOf("PERF") >= 0;

const errorLog = make_errorLog("MessageBuilder");
const debugLog = make_debugLog("MessageBuilder");
const warningLog = make_warningLog("MessageBuilder");

export function readRawMessageHeader(data: Buffer): PacketInfo {
    const messageHeader = readMessageHeader(new BinaryStream(data));
    return {
        extra: "",
        length: messageHeader.length,
        messageHeader
    };
}

export interface MessageBuilderBaseOptions {
    signatureLength?: number;
    maxMessageSize?: number;
    maxChunkCount?: number;
    maxChunkSize?: number;
}

export interface MessageBuilderBase {
    /**
     *
     * notify the observers that a new message is being built
     * @event start_chunk
     * @param info
     * @param data
     */

    on(eventName: "startChunk", eventHandler: (info: PacketInfo, data: Buffer) => void): this;
    /**
     * notify the observers that new message chunk has been received
     * @event chunk
     * @param messageChunk the raw message chunk
     */

    on(eventName: "chunk", eventHandler: (chunk: Buffer) => void): this;
    /**
     * notify the observers that an error has occurred
     * @event error
     * @param error the error to raise
     */

    on(eventName: "error", eventHandler: (err: Error, statusCode: StatusCode, requestId: number | null) => void): this;
    /**
     * notify the observers that a full message has been received
     * @event full_message_body
     * @param full_message_body the full message body made of all concatenated chunks.
     */
    on(eventName: "full_message_body", eventHandler: (fullMessageBody: Buffer) => void): this;

    /**
     *
     * @param eventName "abandon"
     * @param info
     * @param data
     */
    on(eventName: "abandon", eventHandler: (requestId: number) => void): this;

    emit(eventName: "startChunk", info: PacketInfo, data: Buffer): boolean;
    emit(eventName: "chunk", chunk: Buffer): boolean;
    emit(eventName: "error", err: Error, statusCode: StatusCode, requestId: number | null): boolean;
    emit(eventName: "full_message_body", fullMessageBody: Buffer): boolean;
    emit(eventName: "abandon", requestId: number): boolean;
}
/**
 * @class MessageBuilderBase
 * @extends EventEmitter
 * @uses PacketAssembler
 * @constructor
 * @param options {Object}
 * @param [options.signatureLength=0] {number}
 *
 */
export class MessageBuilderBase extends EventEmitter {
    public static defaultMaxChunkCount = 1000;
    public static defaultMaxMessageSize = 1024 * 64;
    public static defaultMaxChunkSize = 1024 * 8;

    public readonly signatureLength: number;
    public readonly maxMessageSize: number;
    public readonly maxChunkCount: number;
    public readonly maxChunkSize: number;

    public readonly options: MessageBuilderBaseOptions;
    public readonly _packetAssembler: PacketAssembler;
    public channelId: number;
    public totalMessageSize: number;
    public sequenceHeader: SequenceHeader | null;

    public _tick0: number;
    public _tick1: number;

    protected id: string;

    protected totalBodySize: number;
    protected messageChunks: Buffer[];
    protected messageHeader?: MessageHeader;

    private _securityDefeated: boolean;
    private _hasReceivedError: boolean;
    private blocks: Buffer[];
    private readonly _expectedChannelId: number;
    private offsetBodyStart: number;

    constructor(options?: MessageBuilderBaseOptions) {
        super();

        this.id = "";

        this._tick0 = 0;
        this._tick1 = 0;
        this._hasReceivedError = false;
        this.blocks = [];
        this.messageChunks = [];
        this._expectedChannelId = 0;

        options = options || {
            maxMessageSize: 0,
            maxChunkCount: 0,
            maxChunkSize: 0
        };

        this.signatureLength = options.signatureLength || 0;

        this.maxMessageSize = options.maxMessageSize || MessageBuilderBase.defaultMaxMessageSize;
        this.maxChunkCount = options.maxChunkCount || MessageBuilderBase.defaultMaxChunkCount;
        this.maxChunkSize = options.maxChunkSize || MessageBuilderBase.defaultMaxChunkSize;

        this.options = options;

        this._packetAssembler = new PacketAssembler({
            minimumSizeInBytes: 8,
            maxChunkSize: this.maxChunkSize,
            readChunkFunc: readRawMessageHeader
        });

        this._packetAssembler.on("chunk", (messageChunk) => this._feed_messageChunk(messageChunk));

        this._packetAssembler.on("startChunk", (info, data) => {
            if (doPerfMonitoring) {
                // record tick 0: when the first data is received
                this._tick0 = get_clock_tick();
            }
            this.emit("startChunk", info, data);
        });

        this._packetAssembler.on("error", (err) => {
            warningLog("packet assembler ", err.message);
            return this._report_error(StatusCodes2.BadTcpMessageTooLarge, "packet assembler: " + err.message);
        });

        this._securityDefeated = false;
        this.totalBodySize = 0;
        this.totalMessageSize = 0;
        this.channelId = 0;
        this.offsetBodyStart = 0;
        this.sequenceHeader = null;
        this._init_new();
    }

    public dispose(): void {
        this.removeAllListeners();
    }

    /**
     * Feed message builder with some data
     * @method feed
     * @param data
     */
    public feed(data: Buffer): void {
        if (!this._securityDefeated && !this._hasReceivedError) {
            this._packetAssembler.feed(data);
        }
    }

    protected _decodeMessageBody(fullMessageBody: Buffer): boolean {
        return true;
    }

    protected _read_headers(binaryStream: BinaryStream): boolean {
        try {
            this.messageHeader = readMessageHeader(binaryStream);
            assert(binaryStream.length === 8, "expecting message header to be 8 bytes");

            this.channelId = binaryStream.readUInt32();
            assert(binaryStream.length === 12);

            // verifying secure ChannelId
            if (this._expectedChannelId && this.channelId !== this._expectedChannelId) {
                return this._report_error(StatusCodes2.BadTcpSecureChannelUnknown, "Invalid secure channel Id");
            }
            return true;
        } catch (err) {
            return this._report_error(StatusCodes2.BadTcpInternalError, "_read_headers error " + (err as Error).message);
        }
    }

    protected _report_abandon(channelId: number, tokenId: number, sequenceHeader: SequenceHeader): false {
        // the server has not been able to send a complete message and has abandoned the request
        // the connection can probably continue
        this._hasReceivedError = false; ///
        this.emit("abandon", sequenceHeader.requestId);
        return false;
    }

    protected _report_error(statusCode: StatusCode, errorMessage: string): false {
        this._hasReceivedError = true;
        debugLog("Error  ", this.id, errorMessage);
        // xx errorLog(new Error());
        this.emit("error", new Error(errorMessage), statusCode, this.sequenceHeader?.requestId || null);
        return false;
    }

    private _init_new() {
        this._securityDefeated = false;
        this._hasReceivedError = false;
        this.totalBodySize = 0;
        this.totalMessageSize = 0;
        this.blocks = [];
        this.messageChunks = [];
    }

    /**
     * append a message chunk
     * @method _append
     * @param chunk
     * @private
     */
    private _append(chunk: Buffer): boolean {
        if (this._hasReceivedError) {
            // the message builder is in error mode and further message chunks should be discarded.
            return false;
        }

        if (this.messageChunks.length + 1 > this.maxChunkCount) {
            return this._report_error(StatusCodes2.BadTcpMessageTooLarge, `max chunk count exceeded: ${this.maxChunkCount}`);
        }

        this.messageChunks.push(chunk);
        this.totalMessageSize += chunk.length;

        if (this.totalMessageSize > this.maxMessageSize) {
            return this._report_error(StatusCodes2.BadTcpMessageTooLarge, `max message size exceeded: ${this.maxMessageSize}`);
        }

        const binaryStream = new BinaryStream(chunk);

        if (!this._read_headers(binaryStream)) {
            return this._report_error(StatusCodes2.BadTcpInternalError, `Invalid message header detected`);
        }

        assert(binaryStream.length >= 12);

        // verify message chunk length
        if (this.messageHeader!.length !== chunk.length) {
            // tslint:disable:max-line-length
            return this._report_error(
                StatusCodes2.BadTcpInternalError,
                `Invalid messageChunk size: the provided chunk is ${chunk.length} bytes long but header specifies ${
                    this.messageHeader!.length
                }`
            );
        }

        // the start of the message body block
        const offsetBodyStart = binaryStream.length;

        // the end of the message body block
        const offsetBodyEnd = binaryStream.buffer.length;

        this.totalBodySize += offsetBodyEnd - offsetBodyStart;
        this.offsetBodyStart = offsetBodyStart;

        // add message body to a queue
        // note : Buffer.slice create a shared memory !
        //        use Buffer.clone
        const sharedBuffer = chunk.slice(this.offsetBodyStart, offsetBodyEnd);
        const clonedBuffer = createFastUninitializedBuffer(sharedBuffer.length);

        sharedBuffer.copy(clonedBuffer, 0, 0);
        this.blocks.push(clonedBuffer);

        return true;
    }

    private _feed_messageChunk(chunk: Buffer): boolean {
        assert(chunk);
        const messageHeader = readMessageHeader(new BinaryStream(chunk));
        this.emit("chunk", chunk);

        if (messageHeader.isFinal === "F") {
            if (messageHeader.msgType === "ERR") {
                const binaryStream = new BinaryStream(chunk);
                binaryStream.length = 8;
                const errorCode = decodeStatusCode(binaryStream);
                const message = decodeString(binaryStream);
                this._report_error(errorCode, message || "Error message not specified");
                return true;
            } else {
                this._append(chunk);
                // last message
                if (this._hasReceivedError) {
                    return false;
                }

                const fullMessageBody: Buffer = this.blocks.length === 1 ? this.blocks[0] : Buffer.concat(this.blocks);

                if (doPerfMonitoring) {
                    // record tick 1: when a complete message has been received ( all chunks assembled)
                    this._tick1 = get_clock_tick();
                }
                this.emit("full_message_body", fullMessageBody);

                this._decodeMessageBody(fullMessageBody);
                // be ready for next block
                this._init_new();
                return true;
            }
        } else if (messageHeader.isFinal === "A") {
            try {
                // only valid for MSG, according to spec
                const stream = new BinaryStream(chunk);
                readMessageHeader(stream);
                assert(stream.length === 8);
                // instead of 
                //   const securityHeader = new SymmetricAlgorithmSecurityHeader();
                //   securityHeader.decode(stream);
                
                const channelId = stream.readUInt32();
                const tokenId = decodeUInt32(stream);

                const sequenceHeader = new SequenceHeader();
                sequenceHeader.decode(stream);
                
                return this._report_abandon(channelId, tokenId, sequenceHeader);
            } catch (err) {
                warningLog(hexDump(chunk));
                warningLog("Cannot interpret message chunk: ", (err as Error).message);
                return this._report_error(
                    StatusCodes2.BadTcpInternalError,
                    "Error decoding message header " + (err as Error).message
                );
            }
        } else if (messageHeader.isFinal === "C") {
            return this._append(chunk);
        }
        return false;
    }
}
