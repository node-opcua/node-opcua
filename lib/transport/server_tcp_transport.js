/**
 * @module opcua.transport
 */
require("requirish")._(module);
// system requires
var assert = require("better-assert");
var _ = require("underscore");
var util = require("util");

// opcua requires
var opcua = require("lib/opcua");
var StatusCode = opcua.StatusCode;
var StatusCodes = opcua.StatusCodes;
var BinaryStream = opcua.BinaryStream;

var verify_message_chunk = opcua.chunk_manager.verify_message_chunk;
var s = opcua.structures;
var hexDump = opcua.utils.hexDump;
var debugLog = opcua.utils.make_debugLog(__filename);
var doDebug = opcua.utils.checkDebugFlag(__filename);

var TCP_transport = require("lib/transport/tcp_transport").TCP_transport;

/**
 * @class ServerTCP_transport
 * @extends TCP_transport
 * @constructor
 *
 */
var ServerTCP_transport = function () {
    TCP_transport.call(this);
};
util.inherits(ServerTCP_transport, TCP_transport);

ServerTCP_transport.prototype.end = "DEPRECATED";

ServerTCP_transport.prototype._abortWithError = function (statusCode, extraErrorDescription, callback) {

    assert(statusCode instanceof StatusCode);
    assert(_.isFunction(callback), "expecting a callback");

    var self = this;

    if (!self.__aborted) {
        self.__aborted  = 1;
        // send the error message and close the connection
        assert(StatusCodes.hasOwnProperty(statusCode.name));

        debugLog(" Server aborting because ".red + statusCode.name.cyan);
        debugLog(" extraErrorDescription   ".red + extraErrorDescription.cyan);
        var errorResponse = new s.TCPErrorMessage({ name: statusCode.value, reason: statusCode.description});
        var messageChunk = opcua.packTcpMessage("ERR", errorResponse);

        self.write(messageChunk);
        self.disconnect(function () {
            self.__aborted  = 2;
            callback(new Error(extraErrorDescription + " StatusCode = " + statusCode.name));

        });

    } else {
        console.log("xxx ignoring ", statusCode.name);
        callback(new Error(statusCode.name));
    }
};

ServerTCP_transport.prototype._send_ACK_response = function () {

    var self = this;

    var acknowledgeMessage = new opcua.AcknowledgeMessage({
        protocolVersion: self.protocolVersion,
        receiveBufferSize: 8192,
        sendBufferSize: 8192,
        maxMessageSize: 100000,
        maxChunkCount: 600000
    });
    var messageChunk = opcua.packTcpMessage("ACK", acknowledgeMessage);

    if (doDebug) {
        verify_message_chunk(messageChunk);
        debugLog("server send: " + "ACK".yellow);
        debugLog(hexDump(messageChunk));
    }

    // send the ACK reply
    self.write(messageChunk);

};

ServerTCP_transport.prototype._on_HEL_message = function (data, callback) {

    var self = this;

    assert(!self._helloreceived);

    var stream = new BinaryStream(data);
    var msgType = data.slice(0, 3).toString("ascii");
    debugLog("SERVER received " + msgType.yellow);


    if (msgType === "HEL") {

        var helloMessage = opcua.decodeMessage(stream, opcua.HelloMessage);
        assert(_.isFinite(self.protocolVersion));

        if (helloMessage.protocolVersion < 0 || helloMessage.protocolVersion > self.protocolVersion) {
            // invalid protocol version requested by client
            self._abortWithError(StatusCodes.BadProtocolVersionUnsupported, "Protocol Version Error" + self.protocolVersion, callback);

        } else {

            // the helloMessage shall only be received once.
            self._helloreceived = true;

            // install packet receiver
            self._install_packet_assembler();

            self._send_ACK_response();

            callback(null); // no Error

        }

    } else {
        // invalid packet , expecting HEL
        self._abortWithError(StatusCodes.BadCommunicationError, "Expecting 'HEL' message to initiate communication", callback);
    }

};

/**
 * Initialize the server transport.
 *
 *
 *  The ServerTCP_transport initialisation process starts by waiting for the client to send a "HEL" message.
 *
 *  The  ServerTCP_transport replies with a "ACK" message and then start waiting for further messages of any size.
 *
 *  The callback function received an error:
 *   - if no message from the client is received within the ```self.timeout``` period,
 *   - or, if the connection has dropped within the same interval.
 *   - if the protocol version specified within the HEL message is invalid or is greater than ```self.protocolVersion```
 *
 * @method init
 * @param socket {Socket}
 * @param callback {Function}
 * @param callback.err {Error||null} err = null if init succeeded
 *
 */
ServerTCP_transport.prototype.init = function (socket, callback) {

    assert(!this.socket, "init already called!");
    assert(_.isFunction(callback), "expecting a valid callback ");

    var self = this;

    self._install_socket(socket);

    self._install_one_time_message_receiver(function (err, data) {
        if (err) {
            //err is either a timeout or connection aborted ...
            self._abortWithError(StatusCodes.BadConnectionRejected, err.message, callback);
        } else {
            // handle the HEL message
            self._on_HEL_message(data, callback);
        }
    });

};

exports.ServerTCP_transport = ServerTCP_transport;
