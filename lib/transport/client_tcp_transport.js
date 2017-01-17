/**
 * @module opcua.transport
 */
require("requirish")._(module);

// system requires
const assert = require("better-assert");

const net = require("net");
const _ = require("underscore");
const util = require("util");


// opcua requires
const BinaryStream = require("lib/misc/binaryStream").BinaryStream;
const TCP_transport = require("lib/transport/tcp_transport").TCP_transport;
const getFakeTransport = require("lib/transport/tcp_transport").getFakeTransport;
const HelloMessage = require("_generated_/_auto_generated_HelloMessage").HelloMessage;
const packTcpMessage = require("lib/nodeopcua").packTcpMessage;


const utils = require("lib/misc/utils");

const debugLog = utils.make_debugLog(__filename);
// var doDebug = opcua.utils.checkDebugFlag(__filename);
// var hexDump = opcua.utils.hexDump;

const parseEndpointUrl = require("lib/nodeopcua").parseEndpointUrl;
const readMessageHeader = require("lib/misc/message_header").readMessageHeader;

const TCPErrorMessage = require("lib/datamodel/structures").TCPErrorMessage;
const AcknowledgeMessage = require("_generated_/_auto_generated_AcknowledgeMessage").AcknowledgeMessage;
const decodeMessage = require("lib/nodeopcua").decodeMessage;

const StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

function createClientSocket(endpoint_url) {
    // create a socket based on Url
    const ep = parseEndpointUrl(endpoint_url);
    const port = ep.port;
    const hostname = ep.hostname;
    switch (ep.protocol) {
        case "opc.tcp":
            return net.connect({host: hostname, port});
        case "fake":
            const fakeSocket = getFakeTransport();
            assert(ep.protocol === "fake", " Unsupported transport protocol");
            process.nextTick(() => {
                fakeSocket.emit("connect");
            });
            return fakeSocket;
        case "http":
        case "https":
        default:
            throw new Error(`this transport protocol is currently not supported :${ep.protocol}`);
            return null;

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
 * @param endpoint_url {String}
 * @param callback {Function} the callback function
 * @param [options={}]
 */
ClientTCP_transport.prototype.connect = function (endpoint_url, callback, options) {

    assert(_.isFunction(callback));

    options = options || {};

    const self = this;

    self.protocolVersion = (options.protocolVersion !== undefined) ? options.protocolVersion : self.protocolVersion;
    assert(_.isFinite(self.protocolVersion));

    const ep = parseEndpointUrl(endpoint_url);

    const hostname = require("os").hostname();

    self.endpoint_url = endpoint_url;

    self.serverUri = `urn:${hostname}:Sample`;

    debugLog("endpoint_url =", endpoint_url, "ep", ep);


    try {
        self._socket = createClientSocket(endpoint_url);
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

    self._socket.on("connect", () => {

        _remove_connect_listeners();

        self._perform_HEL_ACK_transaction(err => {
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
    var err;

    if (messageHeader.isFinal !== "F") {
        err = new Error(" invalid ACK message");
        callback(err);
        return;
    }

    let responseClass;
    let response;

    if (messageHeader.msgType === "ERR") {
        responseClass = TCPErrorMessage;
        _stream.rewind();
        response = decodeMessage(_stream, responseClass);
        
        var err =new Error(`ACK: ERR received ${response.statusCode.toString()} : ${response.reason}`);
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
    assert(self.endpoint_url.length > 0, " expecting a valid endpoint url");

    // Write a message to the socket as soon as the client is connected,
    // the server will receive it as message from the client
    const request = new HelloMessage({
        protocolVersion: self.protocolVersion,
        receiveBufferSize:    1024 * 64 * 10,
        sendBufferSize:       1024 * 64 * 10,// 8196 min,
        maxMessageSize:       0, // 0 - no limits
        maxChunkCount:        0, // 0 - no limits
        endpointUrl: self.endpoint_url
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
            self._handle_ACK_response(data, inner_err => {
                callback(inner_err);
            });
        }
    });
    self._send_HELLO_request();
};


exports.ClientTCP_transport = ClientTCP_transport;

