var assert = require("assert");
var BinaryStream = require("./binaryStream").BinaryStream;
var ec = require("./encode_decode");
var s = require("./structures");



opcua = exports;


var HelloMessage_Description = {
    name: "HelloMessage",
    fields: [
        { name: "protocolVersion"   , fieldType: "UInt32" , description: "The latest version of the OPC UA TCP protocol supported by the Client"},
        { name: "receiveBufferSize" , fieldType: "UInt32" , description: "The largest message that the sender can receive."},
        { name: "sendBufferSize"    , fieldType: "UInt32" , description: "The largest message that the sender will send." },
        { name: "maxMessageSize"    , fieldType: "UInt32" , description: "The maximum size for any response message."          },
        { name: "maxChunkCount"     , fieldType: "UInt32" , description: "The maximum number of chunks in any response message"},
        { name: "endpointUrl"       , fieldType: "UAString",description: "The URL of the Endpoint which the Client wished to connect to."}
    ]
};

var AcknowledgeMessage_Description = {
    name: "AcknowledgeMessage",
    fields: [
        { name: "protocolVersion"   , fieldType: "UInt32" , description: "The latest version of the OPC UA TCP protocol supported by the Server." },
        { name: "receiveBufferSize" , fieldType: "UInt32"  },
        { name: "sendBufferSize"    , fieldType: "UInt32" },
        { name: "maxMessageSize"    , fieldType: "UInt32" , description: "The maximum size for any request message."},
        { name: "maxChunkCount"     , fieldType: "UInt32" , description: "The maximum number of chunks in any request message." }
    ]
};

ErrorMessage_Description = {
    name: "ErrorMessage",
    fields: [
        {name: "Error",  fieldType: "UInt32", description: "The numeric code for the error. This shall be one of the values listed in Table 40." },
        {name: "Reason", fieldType: "String", description: "A more verbose description of the error.This string shall not be more than 4096 characters." }
    ]
};

var factories = require("../lib/factories");
var HelloMessage       = factories.UAObjectFactoryBuild(HelloMessage_Description);
var AcknowledgeMessage = factories.UAObjectFactoryBuild(AcknowledgeMessage_Description);
var ErrorMessage       = factories.UAObjectFactoryBuild(ErrorMessage_Description);



function is_valid_msg_type(msgType) {
    assert([ 'HEL', 'ACK', 'ERR',   // Connection Layer
        'OPN', 'MSG', 'CLO'    // OPC Unified Architecture, Part 6 page 36
    ].indexOf(msgType) >= 0, "invalid message type  " + msgType);
    return true;
}
/**
 * @name encodeMessage
 * @type {{
 *     msgType: String,
 *     messageContent: Object,
 *     binaryStream: BinaryStream
 * }}
 */
encodeMessage = function (msgType, messageContent, stream) {
    // console.log(msgType)
    // console.log(['HEL','ACK','ERR']);
    assert(is_valid_msg_type(msgType));
    stream.writeByte(msgType.charCodeAt(0));
    stream.writeByte(msgType.charCodeAt(1));
    stream.writeByte(msgType.charCodeAt(2));

    // Chunk type
    stream.writeByte("F".charCodeAt(0)); // reserved

    stream.writeInteger(0); //the length of the message, in bytes. (includes the 8 bytes of the message header)
    messageContent.encode(stream);
    length = stream.length;
    stream._buffer.writeUInt32LE(length, 4);
};


function readMessageHeader(stream) {

    assert(stream instanceof opcua.BinaryStream);

    msgType = String.fromCharCode(stream.readByte()) +
        String.fromCharCode(stream.readByte()) +
        String.fromCharCode(stream.readByte());
    padding = stream.readByte();

    length = stream.readInteger(4);

    return  { msgType: msgType, length: length };
}

function decodeMessage(stream, className) {

    assert(stream instanceof opcua.BinaryStream);
    assert(className instanceof Function , " expecting a function for " + className);

    header = readMessageHeader(stream);

    if (header.msgType == "ERR") {
        //xx console.log(" received an error");
        obj = new opcua.TCPErrorMessage();
        obj.decode(stream);
        return obj;
    } else {
        obj = new className();
        obj.decode(stream);
        return obj;
    }
}

exports.BinaryStream = BinaryStream;


exports.HelloMessage       = HelloMessage;
exports.AcknowledgeMessage = AcknowledgeMessage;
exports.TCPErrorMessage    = s.TCPErrorMessage;

exports.encodeMessage = encodeMessage;
exports.decodeMessage = decodeMessage;

function sendMessage(socket, msgType, msg, callback) {

    assert(is_valid_msg_type(msgType));

    // encode message in a packet
    var stream = new opcua.BinaryStream();
    opcua.encodeMessage(msgType, msg, stream);
    s = stream._buffer.slice(0, stream.length);

    //xx console.log(" " + socket.name  + " sending "+ msgType.yellow + " " + s.toString("hex").green);

    // write data to socket
    socket.write(s, callback);

}
exports.sendMessage = sendMessage;
