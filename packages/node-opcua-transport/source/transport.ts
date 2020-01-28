/**
 * @module node-opcua-transport
 */
import { default as chalk } from "chalk";
import { EventEmitter } from "events";
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { createFastUninitializedBuffer } from "node-opcua-buffer-utils";
import * as  debug from "node-opcua-debug";
import { PacketAssembler } from "node-opcua-packet-assembler";

import { readRawMessageHeader } from "./message_builder_base";
import { writeTCPMessageHeader } from "./tools";

type ErrorCallback = (err?: Error | null) => void;

const debugLog = debug.make_debugLog(__filename);
const doDebug = debug.checkDebugFlag(__filename);

let fakeSocket: any = { invalid: true };

export function setFakeTransport(mockSocket: any) {
    fakeSocket = mockSocket;
}

type CallbackWithData = (err: Error | null, data?: Buffer) => void;

export function getFakeTransport() {
    if (fakeSocket.invalid) {
        throw new Error("getFakeTransport: setFakeTransport must be called first  - BadProtocolVersionUnsupported");
    }
    return fakeSocket;
}

let counter = 0;



// tslint:disable:class-name
export abstract class Transport<S extends EventEmitter> extends EventEmitter {

    public timeout: number;
    /**
     * indicates the version number of the OPCUA protocol used
     * @default  0
     */
    public protocolVersion: number;

    public bytesWritten: number;
    public bytesRead: number;
    public chunkWrittenCount: number;
    public chunkReadCount: number;
    public name: string;

    public _socket: S | null;

    /**
     * the size of the header in bytes
     * @default  8
     */
    protected readonly headerSize: 8;
    protected _disconnecting: boolean;
    protected _timerId: NodeJS.Timer | null;
    private _onSocketClosedHasBeenCalled: boolean;
    private _onSocketEndedHasBeenCalled: boolean;
    private _theCallback?: CallbackWithData;
    private _on_error_during_one_time_message_receiver: any;
    private _pendingBuffer?: any;
    protected packetAssembler?: PacketAssembler;

    protected _remotePort: number = 0;
    protected _remoteAddress: string = "";
    get remoteAddress(): string {
        return this._remoteAddress;
    }

    get remotePort(): number {
        return this._remotePort;
    }

    constructor() {

        super();

        this.name = this.constructor.name + counter;
        counter += 1;

        this._timerId = null;
        this.timeout = 30000; // 30 seconds timeout
        this._socket = null;
        this.headerSize = 8;
        this.protocolVersion = 0;

        this._disconnecting = false;
        this._pendingBuffer = undefined;

        this.bytesWritten = 0;
        this.bytesRead = 0;

        this._theCallback = undefined;
        this.chunkWrittenCount = 0;
        this.chunkReadCount = 0;

        this._onSocketClosedHasBeenCalled = false;
        this._onSocketEndedHasBeenCalled = false;
    }

    public abstract dispose(): void;

    /**
     * ```createChunk``` is used to construct a pre-allocated chunk to store up to ```length``` bytes of data.
     * The created chunk includes a prepended header for ```chunk_type``` of size ```self.headerSize```.
     *
     * @method createChunk
     * @param msgType
     * @param chunkType {String} chunk type. should be 'F' 'C' or 'A'
     * @param length
     * @return a buffer object with the required length representing the chunk.
     *
     * Note:
     *  - only one chunk can be created at a time.
     *  - a created chunk should be committed using the ```write``` method before an other one is created.
     */
    public createChunk(msgType: string, chunkType: string, length: number): Buffer {

        assert(msgType === "MSG");
        assert(this._pendingBuffer === undefined, "createChunk has already been called ( use write first)");

        const totalLength = length + this.headerSize;
        const buffer = createFastUninitializedBuffer(totalLength);
        writeTCPMessageHeader("MSG", chunkType, totalLength, buffer);

        this._pendingBuffer = buffer;

        return buffer;
    }

    /**
     * write the message_chunk on the socket.
     * @method write
     * @param messageChunk
     *
     * Notes:
     *  - the message chunk must have been created by ```createChunk```.
     *  - once a message chunk has been written, it is possible to call ```createChunk``` again.
     *
     */
    public write(messageChunk: Buffer) {

        assert((this._pendingBuffer === undefined)
            || this._pendingBuffer === messageChunk, " write should be used with buffer created by createChunk");

        const header = readRawMessageHeader(messageChunk);
        assert(header.length === messageChunk.length);
        assert(["F", "C", "A"].indexOf(header.messageHeader.isFinal) !== -1);
        this._write_chunk(messageChunk);
        this._pendingBuffer = undefined;
    }

    /**
     * disconnect the TCP layer and close the underlying socket.
     * The ```"close"``` event will be emitted to the observers with err=null.
     *
     * @method disconnect
     * @async
     * @param callback
     */
    public abstract disconnect(callback: ErrorCallback): void;
    public abstract isValid(): boolean;
    protected abstract _write_chunk(messageChunk: Buffer): void;

    protected on_socket_ended(err: Error | null) {

        assert(!this._onSocketEndedHasBeenCalled);
        this._onSocketEndedHasBeenCalled = true; // we don't want to send close event twice ...
        /**
         * notify the observers that the transport layer has been disconnected.
         * @event close
         * @param err the Error object or null
         */
        this.emit("close", err || null);
    }

    /**
     * @method _install_socket
     * @param socket {Socket}
     * @protected
     */
    protected abstract _install_socket(socket: S): void;

    /**
     * @method _install_one_time_message_receiver
     *
     * install a one time message receiver callback
     *
     * Rules:
     * * TCP_transport will not emit the ```message``` event, while the "one time message receiver" is in operation.
     * * the TCP_transport will wait for the next complete message chunk and call the provided callback func
     *   ```callback(null,messageChunk);```
     *
     * if a messageChunk is not received within ```TCP_transport.timeout``` or if the underlying socket reports
     * an error, the callback function will be called with an Error.
     *
     */
    protected _install_one_time_message_receiver(callback: CallbackWithData) {
        assert(!this._theCallback, "callback already set");
        assert(_.isFunction(callback));
        this._theCallback = callback;
        this._start_one_time_message_receiver();
    }

    private _fulfill_pending_promises(err: Error | null, data?: Buffer): boolean {

        this._cleanup_timers();

        if (this._socket && this._on_error_during_one_time_message_receiver) {
            this._socket.removeListener("close", this._on_error_during_one_time_message_receiver);
            this._on_error_during_one_time_message_receiver = null;
        }

        const callback = this._theCallback;
        this._theCallback = undefined;

        if (callback) {
            callback(err, data);
            return true;
        }
        return false;
    }

    protected _on_message_received(messageChunk: Buffer) {

        const hasCallback = this._fulfill_pending_promises(null, messageChunk);
        this.chunkReadCount++;
        if (!hasCallback) {
            /**
             * notify the observers that a message chunk has been received
             * @event message
             * @param message_chunk the message chunk
             */
            this.emit("message", messageChunk);
        }
    }

    protected _cleanup_timers() {
        if (this._timerId) {
            clearTimeout(this._timerId);
            this._timerId = null;
        }
    }

    private _start_one_time_message_receiver() {
        assert(!this._timerId, "timer already started");

        // Setup timeout detection timer ....
        this._timerId = setTimeout(() => {
            this._timerId = null;
            this._fulfill_pending_promises(
                new Error(`Timeout in waiting for data on socket ( timeout was = ${this.timeout} ms)`));
        }, this.timeout);

        // also monitored
        if (this._socket) {
            // to do = intercept socket error as well
            this._on_error_during_one_time_message_receiver = (err?: Error) => {
                this._fulfill_pending_promises(
                    new Error(`ERROR in waiting for data on socket ( timeout was = ${this.timeout} ms)`));
            };
            this._socket.on("close", this._on_error_during_one_time_message_receiver);
        }
    }

    protected on_socket_closed(err?: Error) {

        if (this._onSocketClosedHasBeenCalled) {
            return;
        }
        assert(!this._onSocketClosedHasBeenCalled);
        this._onSocketClosedHasBeenCalled = true; // we don't want to send close event twice ...
        /**
         * notify the observers that the transport layer has been disconnected.
         * @event socket_closed
         * @param err the Error object or null
         */
        this.emit("socket_closed", err || null);
    }

    protected _on_socket_data(data: Buffer): void {
        if (!this.packetAssembler) {
            throw new Error("internal Error");
        }
        this.bytesRead += data.length;
        if (data.length > 0) {
            this.packetAssembler.feed(data);
        }
    }

    private _on_socket_ended_message(err?: Error) {

        if (this._disconnecting) {
            return;
        }

        debugLog(chalk.red("Transport Connection ended") + " " + this.name);
        assert(!this._disconnecting);
        err = err || new Error("_socket has been disconnected by third party");

        this.on_socket_ended(err);

        this._disconnecting = true;

        debugLog(" bytesRead    = ", this.bytesRead);
        debugLog(" bytesWritten = ", this.bytesWritten);
        this._fulfill_pending_promises(new Error("Connection aborted - ended by server : " + (err ? err.message : "")));
    }

    protected _on_socket_end(err: Error) {
        // istanbul ignore next
        if (doDebug) {
            debugLog(chalk.red(" SOCKET END : "), err ? chalk.yellow(err.message) : "null", this.name);
        }
        this._on_socket_ended_message(err);
    }

    protected _on_socket_error(err: Error) {
        // istanbul ignore next
        if (doDebug) {
            debugLog(chalk.red(" SOCKET ERROR : "), chalk.yellow(err.message), this.name);
        }
        // node The "close" event will be called directly following this event.
    }
}

export interface ServerTransport<S extends EventEmitter> extends Transport<S> {
    receiveBufferSize: number;
    sendBufferSize: number;
    maxMessageSize: number;
    maxChunkCount: number;
    protocolVersion: number;
    init(socket: S, callback: ErrorCallback): void;
}
