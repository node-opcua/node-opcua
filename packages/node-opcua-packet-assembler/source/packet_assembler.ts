import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import { make_warningLog } from "node-opcua-debug";

const doDebug = false;
const warningLog = make_warningLog("PacketAssembler");

/**
 * Message header information extracted from packet data.
 */
export interface MessageHeader {
    /** Message type identifier (e.g., "MSG", "OPN", "CLO") */
    msgType: string;
    /** Final chunk indicator ("F" for final, "C" for continuation) */
    isFinal: string;
    /** Total message length in bytes */
    length: number;
}

/**
 * Packet metadata extracted from incoming data.
 */
export interface PacketInfo {
    /** Total expected packet length in bytes */
    length: number;
    /** Message header information */
    messageHeader: MessageHeader;
    /** Additional protocol-specific metadata */
    extra: string;
}

/**
 * Function type for extracting packet metadata from buffer data.
 * 
 * @param data - Buffer containing at least minimumSizeInBytes of data
 * @returns Packet metadata including expected length and headers
 */
export type ReadChunkFuncType = (data: Buffer) => PacketInfo;

/**
 * Configuration options for PacketAssembler.
 */
export interface PacketAssemblerOptions {
    /** Function to extract packet metadata from incoming data */
    readChunkFunc: ReadChunkFuncType;
    /** Minimum bytes required before readChunkFunc can be called (typically header size) */
    minimumSizeInBytes: number;
    /** Maximum allowed chunk size in bytes (chunks exceeding this will trigger an error) */
    maxChunkSize: number;
}

/**
 * Error codes for packet assembly failures.
 */
export enum PacketAssemblerErrorCode {
    /** Chunk size exceeds configured maxChunkSize */
    ChunkSizeExceeded = 1,
    /** Chunk size is smaller than minimumSizeInBytes */
    ChunkTooSmall = 2
}
export interface PacketAssembler {
    on(eventName: "startChunk", eventHandler: (packetInfo: PacketInfo, partial: Buffer) => void): this;
    on(eventName: "chunk", eventHandler: (chunk: Buffer) => void): this;
    on(eventName: "error", eventHandler: (err: Error, errCode: PacketAssemblerErrorCode) => void): this;
}
/**
 * Assembles fragmented data from transport layers into complete message chunks.
 * 
 * ## Zero-Copy Optimization
 * 
 * The PacketAssembler uses zero-copy optimization for performance:
 * - **Single-chunk messages**: Returns a view of the input buffer (no allocation, no copy)
 * - **Multi-chunk messages**: Creates a new buffer via Buffer.concat() (safe copy)
 * 
 * ## Buffer Lifetime Management
 * 
 * **Important**: When receiving single-chunk messages, the returned buffer is a view of the
 * input buffer. Consumers are responsible for creating copies if they need buffers that
 * survive beyond immediate processing or if the transport layer reuses buffers.
 * 
 * ### Safe Usage:
 * ```typescript
 * assembler.on("chunk", (chunk) => {
 *   // Option 1: Process immediately (safe)
 *   const value = chunk.readUInt32LE(0);
 *   
 *   // Option 2: Create a copy for later use
 *   const copy = Buffer.from(chunk);
 *   queue.push(copy);
 * });
 * ```
 * 
 * ### Unsafe Usage:
 * ```typescript
 * const chunks = [];
 * assembler.on("chunk", (chunk) => {
 *   // UNSAFE: chunk may be reused by transport layer
 *   chunks.push(chunk);
 * });
 * ```
 * 
 * @fires PacketAssembler#startChunk - Emitted when a new chunk begins
 * @fires PacketAssembler#chunk - Emitted when a complete chunk is assembled
 * @fires PacketAssembler#error - Emitted on assembly errors
 * 
 * @example
 * ```typescript
 * const assembler = new PacketAssembler({
 *   readChunkFunc: (data) => ({
 *     length: data.readUInt32LE(4),
 *     messageHeader: { msgType: "MSG", isFinal: "F", length: data.readUInt32LE(4) },
 *     extra: ""
 *   }),
 *   minimumSizeInBytes: 8,
 *   maxChunkSize: 65536
 * });
 * 
 * assembler.on("chunk", (chunk) => {
 *   console.log("Complete chunk:", chunk.length, "bytes");
 * });
 * 
 * // Feed data from transport
 * socket.on("data", (data) => assembler.feed(data));
 * ```
 */
export class PacketAssembler extends EventEmitter {
    public static defaultMaxChunkCount = 777;
    public static defaultMaxMessageSize = 1024 * 64 - 7;

    private readonly _stack: Buffer[];
    private expectedLength: number;
    private currentLength: number;

    private maxChunkSize: number;

    private readonly readChunkFunc: ReadChunkFuncType;
    private readonly minimumSizeInBytes: number;
    private packetInfo?: PacketInfo;

    /**
     * Creates a new PacketAssembler instance.
     * 
     * @param options - Configuration options for the assembler
     * @param options.readChunkFunc - Function to extract packet metadata from buffer
     * @param options.minimumSizeInBytes - Minimum bytes needed to read packet header (default: 8)
     * @param options.maxChunkSize - Maximum allowed chunk size (default: 65529)
     * 
     * @throws {Error} If readChunkFunc is not a function
     * @throws {Error} If maxChunkSize is less than minimumSizeInBytes
     */
    constructor(options: PacketAssemblerOptions) {
        super();
        this._stack = [];
        this.expectedLength = 0;
        this.currentLength = 0;
        this.readChunkFunc = options.readChunkFunc;
        this.minimumSizeInBytes = options.minimumSizeInBytes || 8;
        assert(typeof this.readChunkFunc === "function", "packet assembler requires a readChunkFunc");

        // istanbul ignore next
        assert(options.maxChunkSize === undefined || options.maxChunkSize !== 0);

        this.maxChunkSize = options.maxChunkSize || PacketAssembler.defaultMaxMessageSize;
        assert(this.maxChunkSize >= this.minimumSizeInBytes);
    }

    /**
     * Feeds incoming data to the assembler for processing.
     * 
     * This method can be called multiple times with partial data. The assembler will
     * buffer incomplete chunks and emit the "chunk" event when a complete message
     * has been assembled.
     * 
     * ## Zero-Copy Behavior
     * 
     * - If the data contains a complete single chunk, it returns a **view of the input buffer**
     *   (zero-copy optimization)
     * - If multiple fragments are needed, it creates a **new buffer** via Buffer.concat()
     *   (safe copy)
     * 
     * @param data - Buffer containing incoming data (can be partial or complete chunks)
     * 
     * @fires startChunk - When a new chunk header is detected
     * @fires chunk - When a complete chunk has been assembled  
     * @fires error - If chunk size validation fails
     * 
     * @example
     * ```typescript
     * // Feed data as it arrives from transport
     * socket.on("data", (data) => {
     *   assembler.feed(data);
     * });
     * ```
     */
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

            assert(this.currentLength === 0);
            if (this.packetInfo.length < this.minimumSizeInBytes) {
                this.emit("error", new Error("chunk is too small "), PacketAssemblerErrorCode.ChunkTooSmall);
                return;
            }

            if (this.packetInfo.length > this.maxChunkSize) {
                const message = `maximum chunk size exceeded (maxChunkSize=${this.maxChunkSize} current chunk size = ${this.packetInfo.length})`;
                warningLog(message);
                this.emit("error", new Error(message), PacketAssemblerErrorCode.ChunkSizeExceeded);
                return;
            }
            // we can now emit an event to signal the start of a new packet
            this.emit("startChunk", this.packetInfo, data);
            this.expectedLength = this.packetInfo.length;
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

            this.emit("chunk", messageChunk);
        } else {
            // there is more data in this chunk than expected...
            // the chunk need to be split
            const size1 = this.expectedLength - this.currentLength;
            if (size1 > 0) {
                const chunk1 = data.subarray(0, size1);
                this.feed(chunk1);
            }
            const chunk2 = data.subarray(size1);
            if (chunk2.length > 0) {
                this.feed(chunk2);
            }
        }
    }

    private _readPacketInfo(data: Buffer) {
        return this.readChunkFunc(data);
    }

    /**
     * Builds the final chunk buffer from accumulated fragments.
     * 
     * ## Zero-Copy Implementation
     * 
     * This method implements the zero-copy optimization:
     * - **Single chunk** (data provided, stack empty): Returns the input buffer directly (zero-copy)
     * - **Single buffered chunk** (no data, one item in stack): Returns the stacked buffer
     * - **Multiple fragments**: Concatenates all fragments into a new buffer (safe copy)
     *
     * @param data - Current buffer fragment (may be null)
     * @returns Complete chunk buffer (either view or new buffer)
     * 
     * @private
     * @internal
     */
    private _buildData(data: Buffer): Buffer {
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
