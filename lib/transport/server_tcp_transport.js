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

function clamp_value(value,min_val,max_val) {
    assert(min_val<max_val);
    if (value <min_val) {
        return min_val;
    }
    if (value >max_val) {
        return max_val;
    }
    return value;
}
ServerTCP_transport.prototype._send_ACK_response = function (helloMessage) {

    var self = this;

    var acknowledgeMessage = new opcua.AcknowledgeMessage({
        protocolVersion: self.protocolVersion,
        receiveBufferSize: clamp_value(helloMessage.receiveBufferSize,8192 , 200000 ),
        sendBufferSize:    clamp_value(helloMessage.sendBufferSize,   8192  ,200000 ),
        maxMessageSize:    clamp_value(helloMessage.maxMessageSize,   100000,5000000),
        maxChunkCount:     clamp_value(helloMessage.maxChunkCount,    10    ,65535 ),

    });
    var messageChunk = opcua.packTcpMessage("ACK", acknowledgeMessage);

    if (doDebug) {
        verify_message_chunk(messageChunk);
        debugLog("server send: " + "ACK".yellow);
        debugLog("server send: " + hexDump(messageChunk));
        debugLog("acknowledgeMessage=",acknowledgeMessage);
    }

    // send the ACK reply
    self.write(messageChunk);

};

var minimumHelloMessageSize = (new opcua.HelloMessage()).binaryStoreSize();
assert(minimumHelloMessageSize == 24);

ServerTCP_transport.prototype._install_HEL_message_receiver = function(callback) {

    var self = this;

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

function test_valid_hellomessage(data) {

    assert(data instanceof Buffer);

    if (data.length <= 32) {
      return false;
    }
    var msgType = data.slice(0, 3).toString("ascii");
    if (msgType != "HEL") {
        return true; // time to fail!
    }
    // read string length
    var strLength = data.readUInt32LE(28);
    if ( data.length < 28+4+strLength ) {
        return false;
    }
    var stream = new BinaryStream(data);
    try {
        var helloMessage = opcua.decodeMessage(stream, opcua.HelloMessage);
        return true;
    }
    catch (err) {
        return false;
    }
}

ServerTCP_transport.prototype._on_HEL_message = function (data, callback) {

    var self = this;
    self.data = self.data || [];
    self.data.push(data);
    var messageChunk = Buffer.concat(self.data);
    // check if we have received enough data
    if (!test_valid_hellomessage(messageChunk) ) {
        //xx console.log("xxxxxxxxxx Incomplete Message = ", hexDump(messageChunk));
        self._install_HEL_message_receiver(callback);
    } else {

        //xx console.log("xxxxxxxxxxx Complete Message = ", hexDump(messageChunk));
        self._on_HEL_message_continued(messageChunk, callback);
    }

};

ServerTCP_transport.prototype._on_HEL_message_continued = function (data, callback) {

    var self = this;

    assert(data instanceof Buffer);
    assert(!self._helloreceived);

    var stream = new BinaryStream(data);
    var msgType = data.slice(0, 3).toString("ascii");
    if (doDebug) {
        debugLog("SERVER received " + msgType.yellow);
        debugLog("SERVER received " + hexDump(data));
    }

    if (msgType === "HEL") {

        assert(data.length >= 24);

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

            self._send_ACK_response(helloMessage);

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

    self._install_HEL_message_receiver(callback);

};

exports.ServerTCP_transport = ServerTCP_transport;
