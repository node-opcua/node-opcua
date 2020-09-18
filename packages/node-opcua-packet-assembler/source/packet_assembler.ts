import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";

const doDebug = false;

/***
 * @class PacketAssembler
 * @constructor
 */

export interface MessageHeader {
    msgType: string;
    isFinal: string;
    length: number;
}

export interface PacketInfo {
    length: number;
    messageHeader: MessageHeader;
    extra: string;
}

export type ReadMessageFuncType = (data: Buffer) => PacketInfo;

export interface PacketAssemblerOptions {
    readMessageFunc: ReadMessageFuncType;

    // the minimum number of bytes that need to be received before the readMessageFunc can be called
    minimumSizeInBytes: number;
}

export class PacketAssembler extends EventEmitter {
    private readonly _stack: Buffer[];
    private expectedLength: number;
    private currentLength: number;
    private readonly readMessageFunc: ReadMessageFuncType;
    private readonly minimumSizeInBytes: number;
    private packetInfo?: PacketInfo;

    constructor(options: PacketAssemblerOptions) {
        super();
        this._stack = [];
        this.expectedLength = 0;
        this.currentLength = 0;
        this.readMessageFunc = options.readMessageFunc;
        this.minimumSizeInBytes = options.minimumSizeInBytes || 8;
        assert(typeof this.readMessageFunc === "function", "packet assembler requires a readMessageFunc");
    }

    public feed(data: Buffer) {
        let messageChunk;

        if (this.expectedLength === 0 && this.currentLength + data.length >= this.minimumSizeInBytes) {
            // we are at a start of a block and there is enough data provided to read the length  of the block
            // let's build the whole data block with previous blocks already read.
            if (this._stack.length > 0) {
                data = this._buildData(data);
                this.currentLength = 0;
            }

            // we can extract the expected length here
            this.packetInfo = this._readPacketInfo(data);
            this.expectedLength = this.packetInfo.length;
            assert(this.currentLength === 0);
            assert(this.expectedLength > 0);

            // we can now emit an event to signal the start of a new packet
            this.emit("newMessage", this.packetInfo, data);
        }

        if (this.expectedLength === 0 || this.currentLength + data.length < this.expectedLength) {
            this._stack.push(data);
            this.currentLength += data.length;
            // expecting more data to complete current message chunk
        } else if (this.currentLength + data.length === this.expectedLength) {
            this.currentLength += data.length;

            messageChunk = this._buildData(data);

            // istanbul ignore next
            if (doDebug) {
                const packetInfo = this._readPacketInfo(messageChunk);
                assert(this.packetInfo && this.packetInfo.length === packetInfo.length);
                assert(messageChunk.length === packetInfo.length);
            }
            // reset
            this.currentLength = 0;
            this.expectedLength = 0;

            this.emit("message", messageChunk);
        } else {
            // there is more data in this chunk than expected...
            // the chunk need to be split
            const size1 = this.expectedLength - this.currentLength;
            if (size1 > 0) {
                const chunk1 = data.slice(0, size1);
                this.feed(chunk1);
            }
            const chunk2 = data.slice(size1);
            if (chunk2.length > 0) {
                this.feed(chunk2);
            }
        }
    }

    private _readPacketInfo(data: Buffer) {
        return this.readMessageFunc(data);
    }

    private _buildData(data: Buffer) {
        if (data && this._stack.length === 0) {
            return data;
        }
        if (!data && this._stack.length === 1) {
            data = this._stack[0];
            this._stack.length = 0; // empty stack array
            return data;
        }
        this._stack.push(data);
        data = Buffer.concat(this._stack);
        this._stack.length = 0;
        return data;
    }
}
