import { assert } from "node-opcua-assert";
import { EventEmitter } from "events";

import { PacketAssembler, PacketInfo } from "node-opcua-packet-assembler";
import { BinaryStream } from "node-opcua-binary-stream";
import { readMessageHeader, SequenceHeader } from "node-opcua-chunkmanager";
import { createFastUninitializedBuffer } from "node-opcua-buffer-utils";
import { get_clock_tick } from "node-opcua-utils";

const doPerfMonitoring = false;

export function readRawMessageHeader(data: Buffer): PacketInfo {
    const messageHeader = readMessageHeader(new BinaryStream(data));
    return {
        length: messageHeader.length,
        messageHeader,
        extra: ""
    };
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

    readonly signatureLength: number;
    readonly options: { signatureLength?: number };
    readonly _packetAssembler: PacketAssembler;
    public channelId: number;

    public _tick0: number;
    public _tick1: number;

    private _securityDefeated: boolean;
    protected totalBodySize: number;
    public totalMessageSize: number;
    private _hasReceivedError: boolean;
    private blocks: Buffer[];
    protected messageChunks: Buffer[];
    protected messageHeader: any;
    private _expectedChannelId: number;
    public sequenceHeader: SequenceHeader | null;
    private offsetBodyStart: number;


    protected  _decodeMessageBody(fullMessageBody: Buffer): boolean {
        return true;
    }


    constructor(options?: { signatureLength?: number }) {

        super();

        this._tick0 = 0;
        this._tick1 = 0;
        this._hasReceivedError = false;
        this.blocks = [];
        this.messageChunks = [];
        this._expectedChannelId = 0;

        options = options || {};

        this.signatureLength = options.signatureLength || 0;

        this.options = options;

        this._packetAssembler = new PacketAssembler({
            readMessageFunc: readRawMessageHeader,
            minimumSizeInBytes: 0
        });

        this._packetAssembler.on("message", (messageChunk) => this._feed_messageChunk(messageChunk));

        this._packetAssembler.on("newMessage", (info, data) => {

            if (doPerfMonitoring) {
                // record tick 0: when the first data is received
                this._tick0 = get_clock_tick();
            }
            /**
             *
             * notify the observers that a new message is being built
             * @event start_chunk
             * @param info
             * @param data
             */
            this.emit("start_chunk", info, data);
        });

        this._securityDefeated = false;
        this.totalBodySize = 0;
        this.totalMessageSize = 0;
        this.channelId = 0;
        this.offsetBodyStart = 0;
        this.sequenceHeader = null;
        this._init_new();
    }

    dispose() {
        this.removeAllListeners();
    }

    private _init_new() {
        this._securityDefeated = false;
        this._hasReceivedError = false;
        this.totalBodySize = 0;
        this.totalMessageSize = 0;
        this.blocks = [];
        this.messageChunks = [];
    }

    protected _read_headers(binaryStream: BinaryStream): boolean {

        this.messageHeader = readMessageHeader(binaryStream);
        assert(binaryStream.length === 8, "expecting message header to be 8 bytes");

        this.channelId = binaryStream.readUInt32();
        assert(binaryStream.length === 12);

        // verifying secure ChannelId
        if (this._expectedChannelId && this.channelId !== this._expectedChannelId) {
            return this._report_error("Invalid secure channel Id");
        }
        return true;
    }

    /**
     * append a message chunk
     * @method _append
     * @param chunk {Buffer}
     * @private
     */
    private _append(chunk: Buffer): boolean {

        if (this._hasReceivedError) {
            // the message builder is in error mode and further message chunks should be discarded.
            return false;
        }

        this.messageChunks.push(chunk);
        this.totalMessageSize += chunk.length;

        const binaryStream = new BinaryStream(chunk);

        if (!this._read_headers(binaryStream)) {
            return false;
        }

        assert(binaryStream.length >= 12);

        // verify message chunk length
        if (this.messageHeader.length !== chunk.length) {
            return this._report_error(`Invalid messageChunk size: the provided chunk is ${chunk.length} bytes long but header specifies ${this.messageHeader.length}`);
        }

        // the start of the message body block
        const offsetBodyStart = binaryStream.length;

        // the end of the message body block
        const offsetBodyEnd = binaryStream.buffer.length;

        this.totalBodySize += (offsetBodyEnd - offsetBodyStart);
        this.offsetBodyStart = offsetBodyStart;

        // add message body to a queue
        // note : Buffer.slice create a shared memory !
        //        use Buffer.clone
        const sharedBuffer = chunk.slice(offsetBodyStart, offsetBodyEnd);
        const clonedBuffer = createFastUninitializedBuffer(sharedBuffer.length);

        sharedBuffer.copy(clonedBuffer, 0, 0);
        this.blocks.push(clonedBuffer);

        return true;
    }

    /**
     * Feed message builder with some data
     * @method feed
     * @param data
     */
    feed(data: Buffer) {
        if (!this._securityDefeated && !this._hasReceivedError) {
            this._packetAssembler.feed(data);
        }
    }

    private _feed_messageChunk(chunk: Buffer) {
        assert(chunk);
        const messageHeader = readMessageHeader(new BinaryStream(chunk));
        /**
         * notify the observers that new message chunk has been received
         * @event chunk
         * @param messageChunk {Buffer} the raw message chunk
         */
        this.emit("chunk", chunk);

        if (messageHeader.isFinal === "F") {

            // last message
            this._append(chunk);
            if (this._hasReceivedError) {
                return false;
            }

            const fullMessageBody: Buffer = this.blocks.length === 1 ? this.blocks[0] : Buffer.concat(this.blocks);

            if (doPerfMonitoring) {
                // record tick 1: when a complete message has been received ( all chunks assembled)
                this._tick1 = get_clock_tick();
            }
            /**
             * notify the observers that a full message has been received
             * @event full_message_body
             * @param full_message_body {Buffer} the full message body made of all concatenated chunks.
             */
            this.emit("full_message_body", fullMessageBody);


            this._decodeMessageBody(fullMessageBody);


            // be ready for next block
            this._init_new();
            return true;

        } else if (messageHeader.isFinal === "A") {
            return this._report_error("received and Abort Message");

        } else if (messageHeader.isFinal === "C") {
            return this._append(chunk);
        }

    }

    protected _report_error(errorMessage: string): false {

        this._hasReceivedError = true;
        /**
         * notify the observers that an error has occurred
         * @event error
         * @param error {Error} the error to raise
         */
        this.emit("error", new Error(errorMessage), this.sequenceHeader ? this.sequenceHeader.requestId : null);
        return false;
    }
}