"use strict";
/**
 * @module opcua.transport
 */
require("requirish")._(module);

// system requires
var assert = require("better-assert");

var net = require("net");
var _ = require("underscore");
var util = require("util");


// opcua requires
var opcua = require("lib/opcua.js");
var BinaryStream = opcua.BinaryStream;

var debugLog = opcua.utils.make_debugLog(__filename);
// var doDebug = opcua.utils.checkDebugFlag(__filename);
// var hexDump = opcua.utils.hexDump;

var TCP_transport = require("lib/transport/tcp_transport").TCP_transport;
var getFakeTransport = require("lib/transport/tcp_transport").getFakeTransport;


function createClientSocket(endpoint_url) {
    // create a socket based on Url
    var ep = opcua.parseEndpointUrl(endpoint_url);
    var port = ep.port;
    var hostname = ep.hostname;
    switch (ep.protocol) {
        case "opc.tcp":
            return net.connect({host: hostname, port: port});
        default:
            var fakeSocket = getFakeTransport();
            assert(ep.protocol === "fake", " Unsupported transport protocol");
            process.nextTick(function () {
                fakeSocket.emit("connect");
            });
            return fakeSocket;
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
var ClientTCP_transport = function () {
    TCP_transport.call(this);

};
util.inherits(ClientTCP_transport, TCP_transport);

/**
 * @method connect
 * @async
 * @param endpoint_url {String}
 * @param callback {Function} the callback function
 * @param [options={}]
 */
ClientTCP_transport.prototype.connect = function (endpoint_url, callback, options) {

    assert(_.isFunction(callback));

    options = options || {};

    var self = this;

    self.protocolVersion = (options.protocolVersion !== undefined) ? options.protocolVersion : self.protocolVersion;
    assert(_.isFinite(self.protocolVersion));

    var ep = opcua.parseEndpointUrl(endpoint_url);

    var hostname = require("os").hostname();

    self.endpoint_url = endpoint_url;

    self.serverUri = "urn:" + hostname + ":Sample";

    debugLog("endpoint_url =", endpoint_url, "ep", ep);


    try {
        self._socket = createClientSocket(endpoint_url);
    }
    catch (err) {
        return callback(err);
    }
    self._socket.name = "CLIENT";
    self._install_socket(self._socket);

    function _on_socket_error(err) {
        // this handler will catch attempt to connect to an inaccessible address.
        assert(err instanceof Error);
        callback(err);
    }

    self._socket.on("error", _on_socket_error);

    self._socket.on("connect", function () {
        self._socket.removeListener("error", _on_socket_error);
        self._perform_HEL_ACK_transaction(callback);
    });


};


ClientTCP_transport.prototype._handle_ACK_response = function (message_chunk, callback) {

    var self = this;
    var _stream = new BinaryStream(message_chunk);
    var messageHeader = opcua.readMessageHeader(_stream);
    var err;

    if (messageHeader.isFinal !== "F") {
        err = new Error(" invalid ACK message");
        callback(err);
        return;
    }

    var responseClass, response;

    if (messageHeader.msgType === "ERR") {
        responseClass = opcua.TCPErrorMessage;
        _stream.rewind();
        response = opcua.decodeMessage(_stream, responseClass);

        callback(new Error("Code 0x" + response.name.toString(16) + " : " + response.reason));

    } else {
        responseClass = opcua.AcknowledgeMessage;
        _stream.rewind();
        response = opcua.decodeMessage(_stream, responseClass);
        self.parameters = response;
        callback(null);
    }

};


ClientTCP_transport.prototype._send_HELLO_request = function () {

    var self = this;
    assert(self._socket);
    assert(_.isFinite(self.protocolVersion));
    assert(self.endpoint_url.length > 0, " expecting a valid endpoint url");

    // Write a message to the socket as soon as the client is connected,
    // the server will receive it as message from the client
    var request = new opcua.HelloMessage({
        protocolVersion: self.protocolVersion,
        receiveBufferSize: 8192,
        sendBufferSize: 8192,
        maxMessageSize: 0, // 0 - no limits
        maxChunkCount: 0, // 0 - no limits
        endpointUrl: self.endpoint_url
    });

    var messageChunk = opcua.packTcpMessage("HEL", request);
    self._write_chunk(messageChunk);

};


ClientTCP_transport.prototype._perform_HEL_ACK_transaction = function (callback) {

    var self = this;
    assert(self._socket);
    assert(_.isFunction(callback));

    var counter = 0;

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

