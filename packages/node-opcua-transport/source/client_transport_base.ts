/**
 * @module node-opcua-transport
 *
 * Transport-agnostic base class for client-side OPC UA transports.
 *
 * Owns the UACP HEL/ACK handshake, the negotiated transport settings, and the
 * post-connect connection-break detector. Concrete subclasses (`ClientTCP_transport`,
 * `ClientWS_transport`, ...) implement only the socket-creation step in `connect()`.
 *
 * Browser-safe: does not import `node:net`, `node:os`, `node:util`, or any other
 * Node-only built-in beyond what `TCP_transport` already inherits from `node:events`.
 */

import { assert } from "node-opcua-assert";
import { BinaryStream } from "node-opcua-binary-stream";
import { readMessageHeader } from "node-opcua-chunkmanager";
import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
import type { ErrorCallback } from "node-opcua-status-code";

import { AcknowledgeMessage } from "./AcknowledgeMessage";
import { HelloMessage } from "./HelloMessage";
import type { TransportSettingsOptions } from "./i_client_transport";
import { TCPErrorMessage } from "./TCPErrorMessage";
import { TCP_transport } from "./tcp_transport";
import { decodeMessage, packTcpMessage } from "./tools";
import { doTraceHelloAck } from "./utils";

// Use a string category instead of `__filename` so the module loads in
// browsers without a Node-style filename global.
const doDebug = checkDebugFlag("ClientTransportBase");
const debugLog = make_debugLog("ClientTransportBase");
const warningLog = make_warningLog("ClientTransportBase");

export interface ClientTransportBase {
    on(eventName: "chunk", eventHandler: (messageChunk: Buffer) => void): this;
    on(eventName: "close", eventHandler: (err: Error | null) => void): this;
    on(eventName: "connection_break", eventHandler: (err: Error | null) => void): this;
    on(eventName: "connect", eventHandler: () => void): this;

    once(eventName: "chunk", eventHandler: (messageChunk: Buffer) => void): this;
    once(eventName: "close", eventHandler: (err: Error | null) => void): this;
    once(eventName: "connection_break", eventHandler: (err: Error | null) => void): this;
    once(eventName: "connect", eventHandler: () => void): this;

    emit(eventName: "chunk", messageChunk: Buffer): boolean;
    emit(eventName: "close", err?: Error | null): boolean;
    emit(eventName: "connection_break", err?: Error | null): boolean;
    emit(eventName: "connect"): boolean;
}

// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: companion to the interface above
export abstract class ClientTransportBase extends TCP_transport {
    public static defaultMaxChunk = 0; // 0 - no limits
    public static defaultMaxMessageSize = 0; // 0 - no limits
    public static defaultReceiveBufferSize = 1024 * 64 * 10;
    public static defaultSendBufferSize = 1024 * 64 * 10; // 8192 min,

    public endpointUrl: string;
    public serverUri: string;
    public numberOfRetry: number;
    public parameters?: AcknowledgeMessage;

    private _counter: number;
    private _helloSettings: {
        maxChunkCount: number;
        maxMessageSize: number;
        receiveBufferSize: number;
        sendBufferSize: number;
    };

    constructor(transportSettings?: TransportSettingsOptions) {
        super();
        this.endpointUrl = "";
        this.serverUri = "";
        this._counter = 0;
        this.numberOfRetry = 0;

        // initially before HEL/ACK
        this.maxChunkCount = 1;
        this.maxMessageSize = 4 * 1024;
        this.receiveBufferSize = 4 * 1024;

        transportSettings = transportSettings || {};
        this._helloSettings = {
            maxChunkCount: transportSettings.maxChunkCount || ClientTransportBase.defaultMaxChunk,
            maxMessageSize: transportSettings.maxMessageSize || ClientTransportBase.defaultMaxMessageSize,
            receiveBufferSize: transportSettings.receiveBufferSize || ClientTransportBase.defaultReceiveBufferSize,
            sendBufferSize: transportSettings.sendBufferSize || ClientTransportBase.defaultSendBufferSize
        };
    }

    public getTransportSettings(): TransportSettingsOptions {
        return this._helloSettings;
    }

    public dispose(): void {
        /* c8 ignore next */
        doDebug && debugLog(" ClientTransportBase disposed");

        super.dispose();
    }

    /**
     * Connect to `endpointUrl` and perform the UACP HEL/ACK handshake.
     * Concrete subclasses are responsible for opening the underlying socket
     * (TCP, WebSocket, ...) and then driving the inherited HEL/ACK machinery.
     */
    public abstract connect(endpointUrl: string, callback: ErrorCallback): void;

    /**
     * Install the post-connect "connection break" detector. Subclasses call this
     * once the underlying socket is open and the HEL/ACK transaction has succeeded.
     *
     * Detects ECONNRESET / EPIPE / premature socket termination on the live socket
     * and re-emits them as `connection_break` so reconnection logic upstream can
     * react.
     */
    protected _install_post_connect_error_handler(endpointUrl: string): void {
        if (!this._socket) return;
        this._socket.on("error", (err: Error) => {
            // EPIPE : a write on a pipe/socket/FIFO with no reader.
            // ECONNRESET : connection forcibly closed by the peer (timeout, reboot, ...).
            // "premature socket termination" : abrupt close mid-message.
            if (err.message.match(/ECONNRESET|EPIPE|premature socket termination/)) {
                /* c8 ignore next */
                doDebug && debugLog("connection_break after reconnection", endpointUrl);
                this.emit("connection_break", err);
            }
        });
    }

    protected _perform_HEL_ACK_transaction(callback: ErrorCallback): void {
        /* c8 ignore next */
        if (!this._socket) {
            callback(new Error("No socket available to perform HEL/ACK transaction"));
            return;
        }
        assert(this._socket, "expecting a valid socket to send a message");
        assert(typeof callback === "function");
        this._counter = 0;
        /* c8 ignore next */
        doDebug && debugLog("entering _perform_HEL_ACK_transaction");

        this._install_one_time_message_receiver((err: Error | null, data?: Buffer) => {
            /* c8 ignore next */
            doDebug && debugLog("before  _on_ACK_response ", err ? err.message : "");

            this._on_ACK_response(callback, err, data);
        });
        this._send_HELLO_request();
    }

    private _send_HELLO_request(): void {
        /* c8 ignore next */
        doDebug && debugLog("entering _send_HELLO_request");

        assert(this._socket);
        assert(Number.isFinite(this.protocolVersion));
        assert(this.endpointUrl.length > 0, " expecting a valid endpoint url");

        const { maxChunkCount, maxMessageSize, receiveBufferSize, sendBufferSize } = this._helloSettings;

        const helloMessage = new HelloMessage({
            endpointUrl: this.endpointUrl,
            protocolVersion: this.protocolVersion,
            maxChunkCount,
            maxMessageSize,
            receiveBufferSize,
            sendBufferSize
        });
        // c8 ignore next
        doTraceHelloAck && warningLog(`sending Hello\n ${helloMessage.toString()} `);

        const messageChunk = packTcpMessage("HEL", helloMessage);
        this._write_chunk(messageChunk);
    }

    private _on_ACK_response(externalCallback: ErrorCallback, err: Error | null, data?: Buffer): void {
        /* c8 ignore next */
        doDebug && debugLog("entering _on_ACK_response");

        assert(typeof externalCallback === "function");
        assert(this._counter === 0, "Ack response should only be received once !");
        this._counter += 1;

        if (err || !data) {
            if (this._socket) {
                const s = this._socket;
                this._socket = null;
                s.destroy();
            }
            externalCallback(err || new Error("no data"));
        } else {
            this._handle_ACK_response(data, externalCallback);
        }
    }

    private _handle_ACK_response(messageChunk: Buffer, callback: ErrorCallback): void {
        const _stream = new BinaryStream(messageChunk);
        const messageHeader = readMessageHeader(_stream);
        let err: Error | null = null;
        /* c8 ignore next */
        if (messageHeader.isFinal !== "F") {
            err = new Error(" invalid ACK message");
             callback(err);
             return;
        }

        let responseClass: typeof AcknowledgeMessage | typeof TCPErrorMessage;
        let response: AcknowledgeMessage | TCPErrorMessage;

        if (messageHeader.msgType === "ERR") {
            responseClass = TCPErrorMessage;
            _stream.rewind();
            try {
                response = decodeMessage(_stream, responseClass) as TCPErrorMessage;
            } catch {
                // the chunk advertised a self-consistent length but does not carry a
                // complete TCPErrorMessage payload (StatusCode + Reason). Treat it as a
                // protocol violation rather than letting the decoder read past the buffer.
                callback(new Error("ACK: failed to decode ERR response (malformed or truncated)"));
                return;
            }

            err = new Error(`ACK: ERR received ${response.statusCode.toString()} : ${response.reason}`);
            // biome-ignore lint/suspicious/noExplicitAny: legacy diagnostic field tacked onto Error
            (err as any).statusCode = response.statusCode;
            // c8 ignore next
            doTraceHelloAck && warningLog("receiving ERR instead of Ack", response.toString());

            callback(err);
        } else {
            responseClass = AcknowledgeMessage;
            _stream.rewind();
            try {
                response = decodeMessage(_stream, responseClass) as AcknowledgeMessage;
            } catch {
                // the chunk advertised a self-consistent length but is too short to hold a
                // complete AcknowledgeMessage payload. Report it instead of letting the
                // decoder read past the end of the buffer.
                callback(new Error("ACK: failed to decode Acknowledge response (malformed or truncated)"));
                return;
            }

            this.parameters = response;
            this.setLimits(response);

            // c8 ignore next
            doTraceHelloAck && warningLog("receiving Ack\n", response.toString());

            callback();
        }
    }
}
