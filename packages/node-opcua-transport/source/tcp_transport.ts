/**
 * @module node-opcua-transport
 */
import * as chalk from "chalk";
import { EventEmitter } from "events";
import { Socket } from "net";

import { assert } from "node-opcua-assert";
import { createFastUninitializedBuffer } from "node-opcua-buffer-utils";
import * as debug from "node-opcua-debug";
import { ObjectRegistry } from "node-opcua-object-registry";
import { PacketAssembler } from "node-opcua-packet-assembler";
import { ErrorCallback, CallbackWithData } from "node-opcua-status-code";

import { readRawMessageHeader } from "./message_builder_base";
import { writeTCPMessageHeader } from "./tools";

const debugLog = debug.make_debugLog(__filename);
const doDebug = debug.checkDebugFlag(__filename);
const errorLog = debug.make_errorLog(__filename);

let fakeSocket: any = { invalid: true };

export function setFakeTransport(mockSocket: any) {
    fakeSocket = mockSocket;
}

export function getFakeTransport() {
    if (fakeSocket.invalid) {
        throw new Error("getFakeTransport: setFakeTransport must be called first  - BadProtocolVersionUnsupported");
    }
    return fakeSocket;
}

let counter = 0;

export interface TCP_transport {
    on(eventName: "message", eventHandler: (message: Buffer) => void): this;
    once(eventName: "message", eventHandler: (message: Buffer) => void): this;
    on(eventName: "socket_closed", eventHandler: (err: Error | null) => void): this;
    once(eventName: "socket_closed", eventHandler: (err: Error | null) => void): this;
    on(eventName: "close", eventHandler: (err: Error | null) => void): this;
    once(eventName: "close", eventHandler: (err: Error | null) => void): this;
}
// tslint:disable:class-name
export class TCP_transport extends EventEmitter {
    private static registry = new ObjectRegistry();

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

    public _socket: Socket | null;

    /**
     * the size of the header in bytes
     * @default  8
     */
    private readonly headerSize: 8;
    private _disconnecting: boolean;
    private _timerId: NodeJS.Timer | null;
    private _onSocketClosedHasBeenCalled: boolean;
    private _onSocketEndedHasBeenCalled: boolean;
    private _theCallback?: CallbackWithData;
    private _on_error_during_one_time_message_receiver: any;
    private _pendingBuffer?: any;
    private packetAssembler?: PacketAssembler;
    private _timeout: number;

    constructor() {
        super();

        this.name = this.constructor.name + counter;
        counter += 1;

        this._timerId = null;
        this._timeout = 30000; // 30 seconds timeout
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
        TCP_transport.registry.register(this);
    }

    public get timeout(): number {
        return this._timeout;
    }
    public set timeout(value: number) {
        debugLog("Setting socket " + this.name + " timeout = ", value);
        this._timeout = value;
    }
    public dispose() {
        this._cleanup_timers();
        assert(!this._timerId);
        if (this._socket) {
            this._socket.destroy();
            this._socket.removeAllListeners();
            this._socket = null;
        }
        TCP_transport.registry.unregister(this);
    }

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
        assert(
            this._pendingBuffer === undefined || this._pendingBuffer === messageChunk,
            " write should be used with buffer created by createChunk"
        );
        const header = readRawMessageHeader(messageChunk);
        assert(header.length === messageChunk.length);
        assert(["F", "C", "A"].indexOf(header.messageHeader.isFinal) !== -1);
        this._write_chunk(messageChunk);
        this._pendingBuffer = undefined;
    }

    public get isDisconnecting(): boolean {
        return this._disconnecting;
    }
    /**
     * disconnect the TCP layer and close the underlying socket.
     * The ```"close"``` event will be emitted to the observers with err=null.
     *
     * @method disconnect
     * @async
     * @param callback
     */
    public disconnect(callback: ErrorCallback): void {
        assert(typeof callback === "function", "expecting a callback function, but got " + callback);

        if (this._disconnecting) {
            callback();
            return;
        }

        assert(!this._disconnecting, "TCP Transport has already been disconnected");
        this._disconnecting = true;

        // xx assert(!this._theCallback,
        //              "disconnect shall not be called while the 'one time message receiver' is in operation");
        this._cleanup_timers();

        if (this._socket) {
            this._socket.end();
            this._socket.destroy();
            // xx this._socket.removeAllListeners();
            this._socket = null;
        }
        this.on_socket_ended(null);
        setImmediate(() => {
            callback();
        });
    }

    public isValid(): boolean {
        return this._socket !== null && !this._socket.destroyed && !this._disconnecting;
    }

    protected _write_chunk(messageChunk: Buffer) {
        if (this._socket !== null) {
            this.bytesWritten += messageChunk.length;
            this.chunkWrittenCount++;
            this._socket.write(messageChunk);
        }
    }

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
    protected _install_socket(socket: Socket) {
        assert(socket);
        this._socket = socket;
        if (doDebug) {
            debugLog("  TCP_transport#_install_socket ", this.name);
        }

        // install packet assembler ...
        this.packetAssembler = new PacketAssembler({
            readMessageFunc: readRawMessageHeader,

            minimumSizeInBytes: this.headerSize
        });

        /* istanbul ignore next */
        if (!this.packetAssembler) {
            throw new Error("Internal Error");
        }
        this.packetAssembler.on("message", (messageChunk: Buffer) => this._on_message_received(messageChunk));

        this._socket
            .on("data", (data: Buffer) => this._on_socket_data(data))
            .on("close", (hadError) => this._on_socket_close(hadError))
            .on("end", (err: Error) => this._on_socket_end(err))
            .on("error", (err: Error) => this._on_socket_error(err));

        // set socket timeout
        debugLog("  TCP_transport#install => setting " + this.name + " _socket.setTimeout to ", this.timeout);

        // let use a large timeout here to make sure that we not conflict with our internal timeout
        this._socket!.setTimeout(this.timeout + 2000, () => {
            debugLog(` _socket ${this.name} has timed out (timeout = ${this.timeout})`);
            this.prematureTerminate(new Error("INTERNAL_EPIPE timeout=" + this.timeout));
        });
    }

    public prematureTerminate(err: Error) {
        debugLog("prematureTerminate", err ? err.message : "");
        if (this._socket) {
            err.message = "EPIPE_" + err.message;
            // we consider this as an error
            const _s = this._socket;
            _s.end();
            _s.destroy(); // new Error("Socket has timed out"));
            _s.emit("error", err);
            this._socket = null;
            this.dispose();
            _s.removeAllListeners();
        }
    }
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
        assert(typeof callback === "function");
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

 
    private _on_message_received(messageChunk: Buffer) {
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

    private _cleanup_timers() {
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
            this._fulfill_pending_promises(new Error(`Timeout in waiting for data on socket ( timeout was = ${this.timeout} ms)`));
        }, this.timeout);

        // also monitored
        if (this._socket) {
            // to do = intercept socket error as well
            this._on_error_during_one_time_message_receiver = (err?: Error) => {
                this._fulfill_pending_promises(
                    new Error(`ERROR in waiting for data on socket ( timeout was = ${this.timeout} ms) ` + err?.message)
                );
            };
            this._socket.on("close", this._on_error_during_one_time_message_receiver);
        }
    }

    private on_socket_closed(err?: Error) {
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

    private _on_socket_data(data: Buffer): void {
        if (!this.packetAssembler) {
            throw new Error("internal Error");
        }
        this.bytesRead += data.length;
        if (data.length > 0) {
            this.packetAssembler.feed(data);
        }
    }

    private _on_socket_close(hadError: boolean) {
        // istanbul ignore next
        if (doDebug) {
            debugLog(chalk.red(" SOCKET CLOSE : "), chalk.yellow("had_error ="), chalk.cyan(hadError.toString()), this.name);
        }
        if (this._socket) {
            debugLog(
                "  remote address = ",
                this._socket.remoteAddress,
                " ",
                this._socket.remoteFamily,
                " ",
                this._socket.remotePort
            );
        }
        if (hadError) {
            if (this._socket) {
                this._socket.destroy();
            }
        }
        const err = hadError ? new Error("ERROR IN SOCKET  " + hadError.toString()) : undefined;
        this.on_socket_closed(err);
        this.dispose();
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

    private _on_socket_end(err: Error) {
        // istanbul ignore next
        if (doDebug) {
            debugLog(chalk.red(" SOCKET END : err="), chalk.yellow(err ? err.message : "null"), this.name);
        }
        this._on_socket_ended_message(err);
    }

    private _on_socket_error(err: Error) {
        // istanbul ignore next
        if (doDebug) {
            debugLog(chalk.red(" SOCKET ERROR : "), chalk.yellow(err.message), this.name);
        }
        // node The "close" event will be called directly following this event.
    }
}
