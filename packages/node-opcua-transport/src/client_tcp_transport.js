"use strict";
/**
 * @module opcua.transport
 */


// system requires
const assert = require("node-opcua-assert").assert;

const net = require("net");
const _ = require("underscore");
const util = require("util");


// opcua requires
const BinaryStream = require("node-opcua-binary-stream").BinaryStream;

// this modules
const TCP_transport = require("./tcp_transport").TCP_transport;

const getFakeTransport = require("./tcp_transport").getFakeTransport;

const packTcpMessage = require("./tools").packTcpMessage;
const parseEndpointUrl = require("./tools").parseEndpointUrl;

const HelloMessage = require("../_generated_/_auto_generated_HelloMessage").HelloMessage;
const TCPErrorMessage = require("../_generated_/_auto_generated_TCPErrorMessage").TCPErrorMessage;
const AcknowledgeMessage = require("../_generated_/_auto_generated_AcknowledgeMessage").AcknowledgeMessage;

const debugLog = require("node-opcua-debug").make_debugLog(__filename);


const readMessageHeader = require("node-opcua-chunkmanager").readMessageHeader;

const decodeMessage = require("./tools").decodeMessage;

function createClientSocket(endpointUrl) {
    // create a socket based on Url
    const ep = parseEndpointUrl(endpointUrl);
    const port = ep.port;
    const hostname = ep.hostname;
    let socket;
    switch (ep.protocol) {
        case "opc.tcp":
            socket = net.connect({host: hostname, port: port});
            socket.setNoDelay(true);
            socket.setTimeout(0);
            socket.on("timeout",function() {
                console.log("Socket has timed out");
            });

            return socket;
        case "fake":
            socket = getFakeTransport();
            assert(ep.protocol === "fake", " Unsupported transport protocol");
            process.nextTick(function () {
                socket.emit("connect");
            });
            return socket;

        case "websocket":
        case "http":
        case "https":
        default:
            throw new Error("this transport protocol is currently not supported :" + ep.protocol);

    }
}

/**
 * a ClientTCP_transport connects to a remote server socket and
 * initiates a communication with a HEL/ACK transaction.
 * It negociates the communication parameters with the other end.
 *
 * @class ClientTCP_transport
 * @extends TCP_transport
 * @constructor
 *
 *
 *
 * @example
 *
 *    ```javascript
 *    var transport = ClientTCP_transport(url);
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
const ClientTCP_transport = function () {
    TCP_transport.call(this);
    const self = this;
    self.connected = false;
};
util.inherits(ClientTCP_transport, TCP_transport);

ClientTCP_transport.prototype.on_socket_ended = function(err) {

    const self = this;
    if (self.connected) {
        TCP_transport.prototype.on_socket_ended.call(self,err);
    }
};

/**
 * @method connect
 * @async
 * @param endpointUrl {String}
 * @param callback {Function} the callback function
 * @param [options={}]
 */
ClientTCP_transport.prototype.connect = function (endpointUrl, callback, options) {

    assert(_.isFunction(callback));

    options = options || {};

    const self = this;

    self.protocolVersion = (options.protocolVersion !== undefined) ? options.protocolVersion : self.protocolVersion;
    assert(_.isFinite(self.protocolVersion));

    const ep = parseEndpointUrl(endpointUrl);

    const hostname = require("os").hostname();

    self.endpointUrl = endpointUrl;

    self.serverUri = "urn:" + hostname + ":Sample";

    debugLog("endpointUrl =", endpointUrl, "ep", ep);


    try {
        self._socket = createClientSocket(endpointUrl);
    }
    catch (err) {
        return callback(err);
    }
    self._socket.name = "CLIENT";
    self._install_socket(self._socket);

    function _on_socket_error_for_connect(err) {
        // this handler will catch attempt to connect to an inaccessible address.
        assert(err instanceof Error);
        _remove_connect_listeners();
        callback(err);
    }
    function _on_socket_end_for_connect(err) {
        console.log("Socket has been closed by server",err);
    }

    function _remove_connect_listeners() {
        self._socket.removeListener("error", _on_socket_error_for_connect);
        self._socket.removeListener("end"  , _on_socket_end_for_connect);
    }

    function _on_socket_error_after_connection(err) {
        debugLog(" ClientTCP_transport Socket Error",err.message);

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

    self._socket.once("error", _on_socket_error_for_connect);
    self._socket.once("end",_on_socket_end_for_connect);

    self._socket.on("connect", function () {

        _remove_connect_listeners();

        self._perform_HEL_ACK_transaction(function(err) {
            if(!err) {

                // install error handler to detect connection break
                self._socket.on("error",_on_socket_error_after_connection);

                self.connected = true;
                /**
                 * notify the observers that the transport is connected (the socket is connected and the the HEL/ACK
                 * transaction has been done)
                 * @event connect
                 *
                 */
                self.emit("connect");
            } else {
                debugLog("_perform_HEL_ACK_transaction has failed with err=",err.message);
            }
            callback(err);
        });
    });
};


ClientTCP_transport.prototype._handle_ACK_response = function (message_chunk, callback) {

    const self = this;
    const _stream = new BinaryStream(message_chunk);
    const messageHeader = readMessageHeader(_stream);
    let err;

    if (messageHeader.isFinal !== "F") {
        err = new Error(" invalid ACK message");
        callback(err);
        return;
    }

    let responseClass, response;

    if (messageHeader.msgType === "ERR") {
        responseClass = TCPErrorMessage;
        _stream.rewind();
        response = decodeMessage(_stream, responseClass);
        
        err =new Error("ACK: ERR received " + response.statusCode.toString() + " : " + response.reason);
        err.statusCode =  response.statusCode;
        callback(err);

    } else {
        responseClass = AcknowledgeMessage;
        _stream.rewind();
        response = decodeMessage(_stream, responseClass);
        self.parameters = response;
        callback(null);
    }

};

ClientTCP_transport.prototype._send_HELLO_request = function () {

    const self = this;
    assert(self._socket);
    assert(_.isFinite(self.protocolVersion));
    assert(self.endpointUrl.length > 0, " expecting a valid endpoint url");

    // Write a message to the socket as soon as the client is connected,
    // the server will receive it as message from the client
    const request = new HelloMessage({
        protocolVersion: self.protocolVersion,
        receiveBufferSize:    1024 * 64 * 10,
        sendBufferSize:       1024 * 64 * 10,// 8196 min,
        maxMessageSize:       0, // 0 - no limits
        maxChunkCount:        0, // 0 - no limits
        endpointUrl: self.endpointUrl
    });

    const messageChunk = packTcpMessage("HEL", request);
    self._write_chunk(messageChunk);

};


ClientTCP_transport.prototype._perform_HEL_ACK_transaction = function (callback) {

    const self = this;
    assert(self._socket);
    assert(_.isFunction(callback));

    let counter = 0;

    self._install_one_time_message_receiver(function on_ACK_response(err, data) {

        assert(counter === 0);
        counter += 1;

        if (err) {
            callback(err);
            self._socket.end();
        } else {
            self._handle_ACK_response(data, function (inner_err) {
                callback(inner_err);
            });
        }
    });
    self._send_HELLO_request();
};


exports.ClientTCP_transport = ClientTCP_transport;

