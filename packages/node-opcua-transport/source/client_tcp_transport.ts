// tslint:disable:class-name
// system
import { assert } from "node-opcua-assert";
import * as _ from "underscore";
import { Socket, createConnection } from "net";
import * as os from "os";
import { BinaryStream } from "node-opcua-binary-stream";
import { readMessageHeader } from "node-opcua-chunkmanager";
import { TCP_transport, getFakeTransport } from "./tcp_transport";
import { packTcpMessage, parseEndpointUrl, decodeMessage } from "./tools";

import { TCPErrorMessage } from "./TCPErrorMessage";
import { HelloMessage } from "./HelloMessage";
import { AcknowledgeMessage } from "./AcknowledgeMessage";
import * as debug from "node-opcua-debug";

const doDebug = debug.checkDebugFlag(__filename);
const debugLog = debug.make_debugLog(__filename);
const hostname = os.hostname();

export type ErrorCallback = (err?: Error) => void;

function createClientSocket(endpointUrl: string): Socket {
    // create a socket based on Url
    const ep = parseEndpointUrl(endpointUrl);
    const port = ep.port;
    const hostname = ep.hostname;
    let socket: Socket;
    switch (ep.protocol) {
        case "opc.tcp":

            socket = createConnection({host: hostname, port});

            // Setting true for noDelay will immediately fire off data each time socket.write() is called.
            socket.setNoDelay(true);

            socket.setTimeout(0);

            socket.on("timeout", () => {
                console.log("Socket has timed out");
            });

            return socket;
        case "fake":
            socket = getFakeTransport();
            assert(ep.protocol === "fake", " Unsupported transport protocol");
            process.nextTick(() => socket.emit("connect"));
            return socket;

        case "websocket":
        case "http":
        case "https":
        default:
            throw new Error("this transport protocol is currently not supported :" + ep.protocol);

    }
}

export interface ConnectOptions {
    protocolVersion?: number;
}

/**
 * a ClientTCP_transport connects to a remote server socket and
 * initiates a communication with a HEL/ACK transaction.
 * It negotiates the communication parameters with the other end.
 *
 * @class ClientTCP_transport
 * @extends TCP_transport
 * @constructor
 * @example
 *
 *    ```javascript
 *    const transport = ClientTCP_transport(url);
 *
 *    transport.timeout = 1000;
 *
 *    transport.connect(function(err)) {
 *         if (err) {
 *            // cannot connect
 *         } else {
 *            // connected
 *
 *         }
 *    });
 *    ....
 *
 *    transport.write(message_chunk,'F');
 *
 *    ....
 *
 *    transport.on("message",function(message_chunk) {
 *        // do something with message from server...
 *    });
 *
 *
 *    ```
 *
 *
 */
export class ClientTCP_transport extends TCP_transport {

    private connected: boolean;
    private parameters?: any;
    public endpointUrl: string;
    public serverUri: string;
    private _counter: number;
    numberOfRetry: number;

    constructor() {
        super();
        this.connected = false;
        this.endpointUrl = "";
        this.serverUri = "";
        this._counter = 0;
        this.numberOfRetry = 0;
    }

    public dispose() {
        if (doDebug) debugLog(" ClientTCP_transport disposed");
        super.dispose();
    }

    protected on_socket_ended(err: Error | null) {
        if (this.connected) {
            super.on_socket_ended(err);
        }
        //  if (this._socket) {
        //      this._socket.removeAllListeners();
        // }
    }

    public connect(endpointUrl: string, callback: ErrorCallback) {

        assert(arguments.length === 2);
        assert(_.isFunction(callback));

        const ep = parseEndpointUrl(endpointUrl);

        this.endpointUrl = endpointUrl;

        this.serverUri = "urn:" + hostname + ":Sample";
        if (doDebug) debugLog("endpointUrl =", endpointUrl, "ep", ep);
        try {
            this._socket = createClientSocket(endpointUrl);
        }
        catch (err) {
            if (doDebug) debugLog("CreateClientSocket has failed");
            return callback(err);
        }

        this._install_socket(this._socket);

        // tslint:disable:no-this-assignment
        const self = this;

        function _on_socket_error_after_connection(err: Error) {
            if (doDebug) debugLog(" _on_socket_error_after_connection ClientTCP_transport Socket Error", err.message);
            // EPIPE : EPIPE (Broken pipe): A write on a pipe, socket, or FIFO for which there is no process to read the
            // data. Commonly encountered at the net and http layers, indicative that the remote side of the stream being
            // written to has been closed.

            // ECONNRESET (Connection reset by peer): A connection was forcibly closed by a peer. This normally results
            // from a loss of the connection on the remote socket due to a timeout or reboot. Commonly encountered via the
            // http and net modu
            if (err.message.match(/ECONNRESET|EPIPE/)) {
                /**
                 * @event connection_break
                 *
                 */
                self.emit("connection_break");
            }
        }

        function _on_socket_connect() {

            if (doDebug) debugLog("entering _on_socket_connect");
            _remove_connect_listeners();
            self._perform_HEL_ACK_transaction((err?: Error) => {
                if (!err) {
                    if (!self._socket) throw new Error("internal error");
                    // install error handler to detect connection break
                    self._socket.on("error", _on_socket_error_after_connection);

                    self.connected = true;
                    /**
                     * notify the observers that the transport is connected (the socket is connected and the the HEL/ACK
                     * transaction has been done)
                     * @event connect
                     *
                     */
                    self.emit("connect");
                } else {
                    debugLog("_perform_HEL_ACK_transaction has failed with err=", err.message);
                }
                callback(err);
            });
        }
        function _on_socket_error_for_connect(err: Error) {
            // this handler will catch attempt to connect to an inaccessible address.
            if (doDebug) debugLog(" _on_socket_error_for_connect", err.message);
            assert(err instanceof Error);
            _remove_connect_listeners();
            callback(err);
        }

        function _on_socket_end_for_connect(err: Error | null) {
            if (doDebug) debugLog("_on_socket_end_for_connect Socket has been closed by server", err);
        }

        function _remove_connect_listeners() {
            if (!self._socket) return;
            self._socket.removeListener("error", _on_socket_error_for_connect);
            self._socket.removeListener("end", _on_socket_end_for_connect);
        }
        this._socket.once("error",   _on_socket_error_for_connect);
        this._socket.once("end",     _on_socket_end_for_connect);
        this._socket.once("connect", _on_socket_connect);

    }

    private _handle_ACK_response(messageChunk: Buffer, callback: ErrorCallback) {

        const _stream = new BinaryStream(messageChunk);
        const messageHeader = readMessageHeader(_stream);
        let err;
        if (messageHeader.isFinal !== "F") {
            err = new Error(" invalid ACK message");
            return callback(err);
        }

        let responseClass, response;

        if (messageHeader.msgType === "ERR") {
            responseClass = TCPErrorMessage;
            _stream.rewind();
            response = decodeMessage(_stream, responseClass) as TCPErrorMessage;

            err = new Error("ACK: ERR received " + response.statusCode.toString() + " : " + response.reason);
            (err as any).statusCode = response.statusCode;
            callback(err);

        } else {
            responseClass = AcknowledgeMessage;
            _stream.rewind();
            response = decodeMessage(_stream, responseClass);
            this.parameters = response;
            callback();
        }

    }

    private _send_HELLO_request() {

        if (doDebug) debugLog("entering _send_HELLO_request");

        assert(this._socket);
        assert(_.isFinite(this.protocolVersion));
        assert(this.endpointUrl.length > 0, " expecting a valid endpoint url");

        // Write a message to the socket as soon as the client is connected,
        // the server will receive it as message from the client
        const request = new HelloMessage({
            protocolVersion: this.protocolVersion,
            receiveBufferSize: 1024 * 64 * 10,
            sendBufferSize: 1024 * 64 * 10,   // 8196 min,
            maxMessageSize: 0,                // 0 - no limits
            maxChunkCount: 0,                 // 0 - no limits
            endpointUrl: this.endpointUrl
        });

        const messageChunk = packTcpMessage("HEL", request);
        this._write_chunk(messageChunk);
    }

    private _on_ACK_response(externalCallback: ErrorCallback, err: Error | null, data?: Buffer) {

        if (doDebug) debugLog("entering _on_ACK_response");

        assert(_.isFunction(externalCallback));
        assert(this._counter === 0, "Ack response should only be received once !");
        this._counter += 1;

        if (err) {
            externalCallback(err);
            if (this._socket) {
                this._socket.end();
                // Xx this._socket.removeAllListeners();
            }
        } else {
            if (!data) return;
            this._handle_ACK_response(data, externalCallback);
        }
    }

    private _perform_HEL_ACK_transaction(callback: ErrorCallback) {
        if (!this._socket) {
            return callback(new Error("No socket availabke to perform HEL/ACK transaction"));
        }
        assert(this._socket, "expecting a valid socket to send a message");
        assert(_.isFunction(callback));
        this._counter = 0;
        if (doDebug) debugLog("entering _perform_HEL_ACK_transaction");
        this._install_one_time_message_receiver((err: Error | null, data?: Buffer) => {
            if (doDebug) debugLog("before  _on_ACK_response");
            this._on_ACK_response(callback, err, data);
        });
        this._send_HELLO_request();
    }
}
