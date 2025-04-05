/* eslint-disable @typescript-eslint/ban-types */
/**
 * @module node-opcua-transport
 */
import { EventEmitter } from "events";
import chalk from "chalk";

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

const debugLog = make_debugLog("TRANSPORT");
const doDebug = checkDebugFlag("TRANSPORT");
const errorLog = make_errorLog("TRANSPORT");
const warningLog = make_warningLog("TRANSPORT");

const doDebugFlow = false;

export interface ISocketLike extends EventEmitter {
    remoteAddress?: string;
    remotePort?: number;

    write(data: string | Buffer, callback?: (err?: Error) => void | undefined): void;
    end(): void;
    setKeepAlive(enable?: boolean, initialDelay?: number): this;
    setNoDelay(noDelay?: boolean): this;
    setTimeout(timeout: number, callback?: () => void): this;

    destroy(err?: Error): void;
    destroyed: boolean;

    on(event: "close", listener: (hadError: boolean) => void): this;
    on(event: "connect", listener: () => void): this;
    on(event: "data", listener: (data: Buffer) => void): this;
    on(event: "end", listener: () => void): this;
    on(event: "error", listener: (err: Error) => void): this;
    on(event: "timeout", listener: () => void): this;
    once(event: "close", listener: (hadError: boolean) => void): this;
    once(event: "connect", listener: () => void): this;
    once(event: "data", listener: (data: Buffer) => void): this;
    once(event: "end", listener: () => void): this;
    once(event: "error", listener: (err: Error) => void): this;
    once(event: "timeout", listener: () => void): this;
    prependListener(event: "close", listener: (hadError: boolean) => void): this;
    prependListener(event: "connect", listener: () => void): this;
    prependListener(event: "data", listener: (data: Buffer) => void): this;
    prependListener(event: "end", listener: () => void): this;
    prependListener(event: "error", listener: (err: Error) => void): this;
    prependListener(event: "timeout", listener: () => void): this;
}

export interface IMockSocket extends ISocketLike {
    invalid?: boolean;
    // [key: string]: any;
    write(data: string | Buffer, callback?: (err?: Error) => void | undefined): void;
    destroy(): void;
    end(): void;

    setKeepAlive(enable?: boolean, initialDelay?: number): this;
    setNoDelay(noDelay?: boolean): this;
    setTimeout(timeout: number, callback?: () => void): this;
}

const defaultFakeSocket = {
    invalid: true,
    destroyed: false,
    destroy(err?: Error) {
        this.destroyed = true;
        errorLog("MockSocket.destroy");
    },

    end() {
        errorLog("MockSocket.end");
    },

    write(data: string | Buffer, callback?: (err?: Error) => void | undefined): void {
        /** */
        if (callback) {
            callback();
        }
    },

    setKeepAlive(enable?: boolean, initialDelay?: number) {
        return this;
    },
    setNoDelay(noDelay?: boolean) {
        return this;
    },
    setTimeout(timeout: number, callback?: () => void) {
        return this;
    }
};

let fakeSocket: IMockSocket = defaultFakeSocket as IMockSocket;

export function setFakeTransport(mockSocket: IMockSocket): void {
    fakeSocket = mockSocket;
}

export function getFakeTransport(): ISocketLike {
    if (fakeSocket.invalid) {
        throw new Error("getFakeTransport: setFakeTransport must be called first  - BadProtocolVersionUnsupported");
    }
    process.nextTick(() => fakeSocket.emit("connect"));

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
     * @event close
     */
    on(eventName: "close", eventHandler: (err: Error | null) => void): this;

    once(eventName: "chunk", eventHandler: (messageChunk: Buffer) => void): this;
    once(eventName: "close", eventHandler: (err: Error | null) => void): this;

    emit(eventName: "close", err?: Error | null): boolean;
    emit(eventName: "chunk", messageChunk: Buffer): boolean;
}
// tslint:disable:class-name
export class TCP_transport extends EventEmitter {
    private static registry = new ObjectRegistry();
    /**
     * the size of the header in bytes
     * @default  8
     */
    public static readonly headerSize = 8;

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

    public _socket: ISocketLike | null;
    #_closedEmitted: Error | string | undefined = undefined;

    #_timerId: NodeJS.Timeout | null;
    #_theCallback?: (err?: Error | null, data?: Buffer) => void;
    #_on_error_during_one_time_message_receiver: ((hadError: boolean) => void) | undefined;
    #packetAssembler?: PacketAssembler;
    #_timeout: number;
    #_isDisconnecting = false;
    protected _theCloseError: Error | null = null;

    constructor() {
        super();

        this.name = this.constructor.name + counter;
        counter += 1;

        this._socket = null;

        this.#_timerId = null;
        this.#_timeout = 5000; // 5  seconds timeout
        this.#_theCallback = undefined;

        this.maxMessageSize = 0;
        this.maxChunkCount = 0;
        this.receiveBufferSize = 0;
        this.sendBufferSize = 0;
        this.protocolVersion = 0;

        this.bytesWritten = 0;
        this.bytesRead = 0;

        this.chunkWrittenCount = 0;
        this.chunkReadCount = 0;

        TCP_transport.registry.register(this);
    }

    public toString() {
        let str = "\n";
        str += " name.............. = " + this.name + "\n";
        str += " protocolVersion... = " + this.protocolVersion + "\n";
        str += " maxMessageSize.... = " + this.maxMessageSize + "\n";
        str += " maxChunkCount..... = " + this.maxChunkCount + "\n";
        str += " receiveBufferSize. = " + this.receiveBufferSize + "\n";
        str += " sendBufferSize.... = " + this.sendBufferSize + "\n";
        str += " bytesRead......... = " + this.bytesRead + "\n";
        str += " bytesWritten...... = " + this.bytesWritten + "\n";
        str += " chunkWrittenCount. = " + this.chunkWrittenCount + "\n";
        str += " chunkReadCount.... = " + this.chunkReadCount + "\n";
        str += " closeEmitted ? ....= " + this.#_closedEmitted + "\n";
        return str;
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

        if (maxChunkCount !== 0) {
            if (maxMessageSize / sendBufferSize > maxChunkCount) {
                const expectedMaxChunkCount = Math.ceil(maxMessageSize / sendBufferSize);
                warningLog(
                    `Warning: maxChunkCount is not big enough : maxMessageSize / sendBufferSize ${expectedMaxChunkCount} > maxChunkCount ${maxChunkCount}`
                );
            }
            if (maxMessageSize / receiveBufferSize > maxChunkCount) {
                const expectedMaxChunkCount = Math.ceil(maxMessageSize / receiveBufferSize);
                warningLog(
                    `Warning: maxChunkCount is not big enough :maxMessageSize / sendBufferSize ${expectedMaxChunkCount} > maxChunkCount ${maxChunkCount}`
                );
            }
        }

        // reinstall packetAssembler with correct limits
        this.#_install_packetAssembler();
    }

    public get timeout(): number {
        return this.#_timeout;
    }
    public set timeout(value: number) {
        assert(!this.#_timerId);
        debugLog("Setting socket " + this.name + " timeout = ", value);
        this.#_timeout = value;
    }

    public dispose(): void {
        this._cleanup_timers();
        assert(!this.#_timerId);
        if (this._socket) {
            const gracefully = true;
            if (gracefully) {
                // close the connection gracefully
                this._socket.end();
            } else {
                // close the connection forcefully
                this._socket.destroy();
            }
            //         this._socket.removeAllListeners();
            this._socket = null;
        }
        TCP_transport.registry.unregister(this);
    }

    /**
     * write the message_chunk on the socket.

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

    public isDisconnecting(): boolean {
        return !this._socket || this.#_isDisconnecting;
    }
    /**
     * disconnect the TCP layer and close the underlying socket.
     * The ```"close"``` event will be emitted to the observers with err=null.
     *
     */
    public disconnect(callback: ErrorCallback): void {
        assert(typeof callback === "function", "expecting a callback function, but got " + callback);
        if (!this._socket || this.#_isDisconnecting) {
            if (!this.#_isDisconnecting) {
                this.dispose();
            }
            callback();
            return;
        }
        this.#_isDisconnecting = true;

        this._cleanup_timers();

        this._socket.prependOnceListener("close", () => {
            this._emitClose(null);
            setImmediate(() => {
                callback();
            });
        });

        this._socket.end();
        this._socket && this._socket.destroy();
        this._socket = null;
    }

    public isValid(): boolean {
        return this._socket !== null && !this._socket.destroyed;
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

    #_install_packetAssembler() {
        if (this.#packetAssembler) {
            this.#packetAssembler.removeAllListeners();
            this.#packetAssembler = undefined;
        }

        // install packet assembler ...
        this.#packetAssembler = new PacketAssembler({
            readChunkFunc: readRawMessageHeader,
            minimumSizeInBytes: TCP_transport.headerSize,
            maxChunkSize: this.receiveBufferSize //Math.max(this.receiveBufferSize, this.sendBufferSize)
        });

        this.#packetAssembler.on("chunk", (chunk: Buffer) => this._on_message_chunk_received(chunk));

        this.#packetAssembler.on("error", (err, code) => {
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

    protected _install_socket(socket: ISocketLike): void {
        // note: it is possible that a transport may be recycled and re-used again after a connection break
        assert(socket);
        assert(!this._socket, "already have a socket");
        this._socket = socket;
        this.#_closedEmitted = undefined;
        this._theCloseError = null;
        assert(this.#_closedEmitted === undefined, "TCP Transport has already been closed !");

        this._socket.setKeepAlive(true);
        // Setting true for noDelay will immediately fire off data each time socket.write() is called.
        this._socket.setNoDelay(true);
        // set socket timeout
        debugLog("  TCP_transport#install => setting " + this.name + " _socket.setTimeout to ", this.timeout);
        // let use a large timeout here to make sure that we not conflict with our internal timeout
        this._socket.setTimeout(this.timeout, ()=>{
        });

        // istanbul ignore next
        doDebug && debugLog("  TCP_transport#_install_socket ", this.name);

        this.#_install_packetAssembler();

        this._socket
            .on("data", (data: Buffer) => this._on_socket_data(data))
            .on("close", (hadError) => this._on_socket_close(hadError))
            .on("end", () => this._on_socket_end())
            .on("error", (err: Error) => this._on_socket_error(err))
            .on("timeout", () => this._on_socket_timeout());
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

        debugLog("prematureTerminate", err ? err.message : "", statusCode.toString(), "has socket = ", !!this._socket);

        doDebugFlow && errorLog("prematureTerminate from", "has socket = ", !!this._socket, new Error().stack);

        if (this._socket) {
            err.message = "premature socket termination " + err.message;
            // we consider this as an error
            const _s = this._socket;
            this._socket = null;
            _s.destroy(err);
            this.dispose();
        }
    }
    public forceConnectionBreak() {
        const socket = this._socket;
        if (!socket) return;
        socket.end();
        socket.emit("error", new Error("ECONNRESET"));
        socket.destroy(new Error("ECONNRESET"));
    }

    /**

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
        assert(!this.#_theCallback, "callback already set");
        assert(typeof callback === "function");
        this._start_one_time_message_receiver(callback);
    }

    private _fulfill_pending_promises(err: Error | null, data?: Buffer): boolean {
        if (!this.#_theCallback) return false;
        doDebugFlow && errorLog("_fulfill_pending_promises from", new Error().stack);
        const callback = this.#_theCallback;
        this.#_theCallback = undefined;
        callback(err, data);
        return true;
    }

    private _on_message_chunk_received(messageChunk: Buffer) {
        if (doTraceIncomingChunk) {
            warningLog("Transport", this.name);
            warningLog(hexDump(messageChunk));
        }
        const hadCallback = this._fulfill_pending_promises(null, messageChunk);
        this.chunkReadCount++;
        if (!hadCallback) {
            this.emit("chunk", messageChunk);
        }
    }

    private _cleanup_timers() {
        if (this.#_timerId) {
            clearTimeout(this.#_timerId);
            this.#_timerId = null;
        }
    }

    private _start_one_time_message_receiver(callback: CallbackWithData) {
        assert(!this.#_timerId && !this.#_on_error_during_one_time_message_receiver, "timer already started");

        const _cleanUp = () => {
            this._cleanup_timers();
            if (this.#_on_error_during_one_time_message_receiver) {
                this._socket?.removeListener("close", this.#_on_error_during_one_time_message_receiver);
                this.#_on_error_during_one_time_message_receiver = undefined;
            }
        };

        const onTimeout = () => {
            _cleanUp();
            this._fulfill_pending_promises(
                new Error(`Timeout(A) in waiting for data on socket ( timeout was = ${this.timeout} ms)`)
            );
            this.dispose();
        };
        // Setup timeout detection timer ....
        this.#_timerId = setTimeout(() => {
            this.#_timerId = null;
            onTimeout();
        }, this.timeout);

        // also monitored
        if (this._socket) {
            // to do = intercept socket error as well
            this.#_on_error_during_one_time_message_receiver = (hadError: boolean) => {
                const err = new Error(
                    `ERROR in waiting for data on socket ( timeout was = ${this.timeout} ms) hadError` + hadError
                );
                this._emitClose(err);
                this._fulfill_pending_promises(err);
            };
            this._socket.prependOnceListener("close", this.#_on_error_during_one_time_message_receiver);
        }

        const _callback = callback;
        this.#_theCallback = (err?: Error | null, data?: Buffer) => {
            _cleanUp();
            this.#_theCallback = undefined;
            _callback(err!, data);
        };
    }

    private _on_socket_data(data: Buffer): void {
        // istanbul ignore next
        if (!this.#packetAssembler) {
            throw new Error("internal Error");
        }
        this.bytesRead += data.length;
        if (data.length > 0) {
            this.#packetAssembler.feed(data);
        }
    }

    private _on_socket_close(hadError: boolean) {
        // istanbul ignore next
        if (doDebug) {
            debugLog(chalk.red(` SOCKET CLOSE ${this.name}: `), chalk.yellow("had_error ="), chalk.cyan(hadError.toString()));
        }
        this.dispose();
        if (this.#_theCallback) return;
        // if (hadError) {
        //     if (this._socket) {
        //         this._socket.destroy();
        //     }
        // }
        this._emitClose();
    }

    protected _emitClose(err?: Error | null) {
        err = err || this._theCloseError;
        doDebugFlow && warningLog("_emitClose ", err?.message || "", "from", new Error().stack);

        if (!this.#_closedEmitted) {
            this.#_closedEmitted = err || "noError";
            this.emit("close", err || null);
            // if (this._theCallback) {
            //     const callback = this._theCallback;
            //     this._theCallback = undefined;
            //     callback(err || null);
            // }
        } else {
            debugLog("Already emitted close event", (this.#_closedEmitted as any).message);
            debugLog("err = ", err?.message);
            debugLog("");
            debugLog("Already emitted close event", this.#_closedEmitted);
            debugLog("err = ", err?.message, err);
        }
    }

    private _on_socket_end() {
        // istanbul ignore next
        doDebug && debugLog(chalk.red(` SOCKET END : ${this.name}`), "is disconnecting  ", this.isDisconnecting());
        if (this.isDisconnecting()) {
            return;
        }
        //
        debugLog(chalk.red(" Transport Connection ended") + " " + this.name);
        const err = new Error(this.name + ": socket has been disconnected by third party");
        debugLog(" bytesRead    = ", this.bytesRead);
        debugLog(" bytesWritten = ", this.bytesWritten);
        this._theCloseError = err;

        this._fulfill_pending_promises(new Error("Connection aborted - ended by server : " + (err ? err.message : "")));
    }

    private _on_socket_error(err: Error) {
        // istanbul ignore next
        debugLog(chalk.red(` _on_socket_error:  ${this.name}`), chalk.yellow(err.message));
        // node The "close" event will be called directly following this event.
        // this._emitClose(err);
    }

    private _on_socket_timeout() {
        const msg = `socket timeout : timeout=${this.timeout}  ${this.name}`;
        doDebug && debugLog(msg);
        this.prematureTerminate(new Error(msg), StatusCodes2.BadTimeout);
    }
}
