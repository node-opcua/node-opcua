/**
 * @module node-opcua-transport
 */
import { EventEmitter } from "events";
import { Socket } from "net";
import * as chalk from "chalk";

import { assert } from "node-opcua-assert";
import { make_debugLog, checkDebugFlag, make_errorLog, hexDump, make_warningLog } from "node-opcua-debug";
import { ObjectRegistry } from "node-opcua-object-registry";
import { PacketAssembler, PacketAssemblerErrorCode } from "node-opcua-packet-assembler";
import { ErrorCallback, CallbackWithData, StatusCode } from "node-opcua-status-code";

import { StatusCodes2 } from "./status_codes";
import { readRawMessageHeader } from "./message_builder_base";
import { doTraceIncomingChunk } from "./utils";
import { TCPErrorMessage } from "./TCPErrorMessage";
import { packTcpMessage } from "./tools";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const errorLog = make_errorLog(__filename);
const warningLog = make_warningLog(__filename);

export interface MockSocket {
    invalid?: boolean;
    [key: string]: any;
    destroy(): void;
    end(): void;
}
let fakeSocket: MockSocket = {
    invalid: true,

    destroy() {
        errorLog("MockSocket.destroy");
    },

    end() {
        errorLog("MockSocket.end");
    }
};

export function setFakeTransport(mockSocket: MockSocket): void {
    fakeSocket = mockSocket;
}

export function getFakeTransport(): any {
    if (fakeSocket.invalid) {
        throw new Error("getFakeTransport: setFakeTransport must be called first  - BadProtocolVersionUnsupported");
    }
    return fakeSocket;
}

let counter = 0;

export interface TCP_transport {
    /**
     * notify the observers that a message chunk has been received
     * @event chunk
     * @param message_chunk the message chunk
     */
    on(eventName: "chunk", eventHandler: (messageChunk: Buffer) => void): this;
    /**
     * notify the observers that the transport layer has been disconnected.
     * @event socket_closed
     * @param err the Error object or null
     */
    on(eventName: "socket_closed", eventHandler: (err: Error | null) => void): this;
    /**
     * notify the observers that the transport layer has been disconnected.
     * @event close
     */
    on(eventName: "close", eventHandler: (err: Error | null) => void): this;

    once(eventName: "chunk", eventHandler: (messageChunk: Buffer) => void): this;
    once(eventName: "socket_closed", eventHandler: (err: Error | null) => void): this;
    once(eventName: "close", eventHandler: (err: Error | null) => void): this;

    emit(eventName: "socket_closed", err?: Error | null): boolean;
    emit(eventName: "close", err?: Error | null): boolean;
    emit(eventName: "chunk", messageChunk: Buffer): boolean;
}
// tslint:disable:class-name
export class TCP_transport extends EventEmitter {
    private static registry = new ObjectRegistry();

    /**
     * indicates the version number of the OPCUA protocol used
     * @default  0
     */
    public protocolVersion: number;
    public maxMessageSize: number;
    public maxChunkCount: number;
    public sendBufferSize: number;
    public receiveBufferSize: number;

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

        this.maxMessageSize = 0;
        this.maxChunkCount = 0;
        this.receiveBufferSize = 0;
        this.sendBufferSize = 0;
        this.protocolVersion = 0;

        this._disconnecting = false;

        this.bytesWritten = 0;
        this.bytesRead = 0;

        this._theCallback = undefined;
        this.chunkWrittenCount = 0;
        this.chunkReadCount = 0;

        this._onSocketClosedHasBeenCalled = false;
        this._onSocketEndedHasBeenCalled = false;
        TCP_transport.registry.register(this);
    }

    public setLimits({
        receiveBufferSize,
        sendBufferSize,
        maxMessageSize,
        maxChunkCount
    }: {
        receiveBufferSize: number;
        sendBufferSize: number;
        maxMessageSize: number;
        maxChunkCount: number;
    }) {
        this.receiveBufferSize = receiveBufferSize;
        this.sendBufferSize = sendBufferSize;
        this.maxMessageSize = maxMessageSize;
        this.maxChunkCount = maxChunkCount;

        // reinstall packetAssembler with correct limits
        this._install_packetAssembler();
    }

    public get timeout(): number {
        return this._timeout;
    }
    public set timeout(value: number) {
        debugLog("Setting socket " + this.name + " timeout = ", value);
        this._timeout = value;
    }
    public dispose(): void {
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
     * write the message_chunk on the socket.
     * @method write
     * @param messageChunk
     */
    public write(messageChunk: Buffer, callback?: (err?: Error) => void | undefined): void {
        const header = readRawMessageHeader(messageChunk);
        assert(header.length === messageChunk.length);
        const c = header.messageHeader.isFinal;
        assert(c === "F" || c === "C" || c === "A");
        this._write_chunk(messageChunk, (err) => {
            callback && callback(err);
        });
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
            this._socket && this._socket.destroy();
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

    protected _write_chunk(messageChunk: Buffer, callback?: (err?: Error) => void | undefined): void {
        if (this._socket !== null) {
            this.bytesWritten += messageChunk.length;
            this.chunkWrittenCount++;
            this._socket.write(messageChunk, callback);
        } else {
            if (callback) {
                callback();
            }
        }
    }

    protected on_socket_ended(err: Error | null): void {
        if (!this._onSocketEndedHasBeenCalled) {
            this._onSocketEndedHasBeenCalled = true; // we don't want to send close event twice ...
            this.emit("close", err || null);
        } else {
            debugLog("on_socket_ended has already been called");
        }
    }

    protected _install_packetAssembler() {
        if (this.packetAssembler) {
            this.packetAssembler.removeAllListeners();
            this.packetAssembler = undefined;
        }

        // install packet assembler ...
        this.packetAssembler = new PacketAssembler({
            readChunkFunc: readRawMessageHeader,
            minimumSizeInBytes: this.headerSize,
            maxChunkSize: this.receiveBufferSize //Math.max(this.receiveBufferSize, this.sendBufferSize)
        });

        this.packetAssembler.on("chunk", (chunk: Buffer) => this._on_message_chunk_received(chunk));

        this.packetAssembler.on("error", (err, code) => {
            let statusCode = StatusCodes2.BadTcpMessageTooLarge;
            switch (code) {
                case PacketAssemblerErrorCode.ChunkSizeExceeded:
                    statusCode = StatusCodes2.BadTcpMessageTooLarge;
                    break;
                default:
                    statusCode = StatusCodes2.BadTcpInternalError;
            }

            this.sendErrorMessage(statusCode, err.message);
            this.prematureTerminate(new Error("Packet Assembler : " + err.message), statusCode);
        });
    }
    /**
     * @method _install_socket
     * @param socket {Socket}
     * @protected
     */
    protected _install_socket(socket: Socket): void {
        assert(socket);
        this._socket = socket;
        if (doDebug) {
            debugLog("  TCP_transport#_install_socket ", this.name);
        }

        this._install_packetAssembler();

        this._socket
            .on("data", (data: Buffer) => this._on_socket_data(data))
            .on("close", (hadError) => this._on_socket_close(hadError))
            .on("end", (err: Error) => this._on_socket_end(err))
            .on("error", (err: Error) => this._on_socket_error(err));

        // set socket timeout
        debugLog("  TCP_transport#install => setting " + this.name + " _socket.setTimeout to ", this.timeout);

        // let use a large timeout here to make sure that we not conflict with our internal timeout
        this._socket.setTimeout(this.timeout + 2000, () => {
            debugLog(` _socket ${this.name} has timed out (timeout = ${this.timeout})`);
            this.prematureTerminate(new Error("socket timeout : timeout=" + this.timeout), StatusCodes2.BadTimeout);
        });
    }

    public sendErrorMessage(statusCode: StatusCode, extraErrorDescription: string | null): void {
        // When the Client receives an Error Message it reports the error to the application and closes the TransportConnection gracefully.
        // If a Client encounters a fatal error, it shall report the error to the application and send a CloseSecureChannel Message.

        /* istanbul ignore next*/
        if (doDebug) {
            debugLog(chalk.red(" sendErrorMessage        ") + chalk.cyan(statusCode.toString()));
            debugLog(chalk.red(" extraErrorDescription   ") + chalk.cyan(extraErrorDescription));
        }

        const reason = `${statusCode.toString()}:${extraErrorDescription || ""}`;
        const errorResponse = new TCPErrorMessage({
            statusCode,
            reason
        });
        const messageChunk = packTcpMessage("ERR", errorResponse);
        this.write(messageChunk);
    }

    public prematureTerminate(err: Error, statusCode: StatusCode): void {
        // https://reference.opcfoundation.org/v104/Core/docs/Part6/6.7.3/

        debugLog("prematureTerminate", err ? err.message : "", statusCode.toString());

        if (this._socket) {
            err.message = "premature socket termination " + err.message;
            // we consider this as an error
            const _s = this._socket;
            _s.end();
            _s.destroy(); // new Error("Socket has timed out"));
            _s.emit("error", err);
            this._socket = null;
            this.dispose();
            _s.removeAllListeners();
        }
        // this.gracefullShutdown(err);
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
    protected _install_one_time_message_receiver(callback: CallbackWithData): void {
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

    private _on_message_chunk_received(messageChunk: Buffer) {
        if (doTraceIncomingChunk) {
            console.log(hexDump(messageChunk));
        }
        const hadCallback = this._fulfill_pending_promises(null, messageChunk);
        this.chunkReadCount++;
        if (!hadCallback) {
            this.emit("chunk", messageChunk);
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
        this.emit("socket_closed", err || null);
    }

    private _on_socket_data(data: Buffer): void {
        // istanbul ignore next
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
