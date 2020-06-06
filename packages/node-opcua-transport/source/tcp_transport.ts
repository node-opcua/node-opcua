/**
 * @module node-opcua-transport
 */
import * as chalk from "chalk";
import { Socket } from "net";
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import * as  debug from "node-opcua-debug";
import { PacketAssembler } from "node-opcua-packet-assembler";
import { ErrorCallback } from "node-opcua-status-code";

import { readRawMessageHeader } from "./message_builder_base";

import { Transport } from './transport';

const debugLog = debug.make_debugLog(__filename);
const doDebug = debug.checkDebugFlag(__filename);

let counter = 0;

// tslint:disable:class-name
export class TCP_transport extends Transport<Socket> {

    public _socket: Socket | null;

    constructor() {

        super();

        this.name = this.constructor.name + counter;
        counter += 1;

        this._socket = null;

    }


    public dispose() {
        this._cleanup_timers();
        assert(!this._timerId);
        if (this._socket) {
            this._socket.destroy();
            this._socket.removeAllListeners();
            this._socket = null;
        }
        Transport.registry.unregister(this);
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

        assert(_.isFunction(callback), "expecting a callback function, but got " + callback);

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

    /**
     * @method _install_socket
     * @param socket {Socket}
     * @protected
     */
    protected _install_socket(socket: Socket) {

        assert(socket);
        this._socket = socket;
        if (doDebug) {
            debugLog("_install_socket ", this.name);
        }

        
        this._remoteAddress = socket.remoteAddress || "";
        this._remotePort = socket.remotePort || 0;

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
        debugLog("setting " + this.name + " _socket.setTimeout to ", this.timeout);

        // let use a large timeout here to make sure that we not conflict with our internal timeout
        this._socket.setTimeout(this.timeout + 2000, () => {
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


    private _on_socket_close(hadError: boolean) {
        // istanbul ignore next
        if (doDebug) {
            debugLog(chalk.red(" SOCKET CLOSE : "),
                chalk.yellow("had_error ="), chalk.cyan(hadError.toString()), this.name);
        }
        if (this._socket) {
            debugLog("  remote address = ",
                this._socket.remoteAddress, " ", this._socket.remoteFamily, " ", this._socket.remotePort);
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
}
