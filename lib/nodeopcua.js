var assert = require('better-assert');
var BinaryStream = require("./misc/binaryStream").BinaryStream;
var ec = require("./misc/encode_decode");
var s = require("./datamodel/structures");
var factories = require("./misc/factories");


var opcua = exports;


var HelloMessage_Schema = {
    name: "HelloMessage",
    id: factories.next_available_id(),
    fields: [
        { name: "protocolVersion"   , fieldType: "UInt32" , description: "The latest version of the OPC UA TCP protocol supported by the Client"},
        { name: "receiveBufferSize" , fieldType: "UInt32" , description: "The largest message that the sender can receive."},
        { name: "sendBufferSize"    , fieldType: "UInt32" , description: "The largest message that the sender will send." },
        { name: "maxMessageSize"    , fieldType: "UInt32" , description: "The maximum size for any response message."          },
        { name: "maxChunkCount"     , fieldType: "UInt32" , description: "The maximum number of chunks in any response message"},
        { name: "endpointUrl"       , fieldType: "UAString",description: "The URL of the Endpoint which the Client wished to connect to."}
    ]
};
exports.HelloMessage_Schema = HelloMessage_Schema;

var AcknowledgeMessage_Schema = {
    name: "AcknowledgeMessage",
    id: factories.next_available_id(),
    fields: [
        { name: "protocolVersion"   , fieldType: "UInt32" , description: "The latest version of the OPC UA TCP protocol supported by the Server." },
        { name: "receiveBufferSize" , fieldType: "UInt32"  },
        { name: "sendBufferSize"    , fieldType: "UInt32" },
        { name: "maxMessageSize"    , fieldType: "UInt32" , description: "The maximum size for any request message."},
        { name: "maxChunkCount"     , fieldType: "UInt32" , description: "The maximum number of chunks in any request message." }
    ]
};
exports.AcknowledgeMessage_Schema = AcknowledgeMessage_Schema;

var ErrorMessage_Schema = {
    name: "ErrorMessage",
    id: factories.next_available_id(),
    fields: [
        {name: "Error",  fieldType: "UInt32", description: "The numeric code for the error. This shall be one of the values listed in Table 40." },
        {name: "Reason", fieldType: "String", description: "A more verbose description of the error.This string shall not be more than 4096 characters." }
    ]
};
exports.ErrorMessage_Schema = ErrorMessage_Schema;

var HelloMessage       = factories.registerObject(HelloMessage_Schema);
var AcknowledgeMessage = factories.registerObject(AcknowledgeMessage_Schema);
var ErrorMessage       = factories.registerObject(ErrorMessage_Schema);

exports.AcknowledgeMessage = AcknowledgeMessage;

function is_valid_msg_type(msgType) {
    assert([ 'HEL', 'ACK', 'ERR',   // Connection Layer
        'OPN', 'MSG', 'CLO'    // OPC Unified Architecture, Part 6 page 36
    ].indexOf(msgType) >= 0, "invalid message type  " + msgType);
    return true;
}


var readMessageHeader  = require('./misc/message_header').readMessageHeader;

function decodeMessage(stream, className) {

    assert(stream instanceof BinaryStream);
    assert(className instanceof Function , " expecting a function for " + className);

    var header = readMessageHeader(stream);
    assert(stream.length === 8);

    var obj;
    if (header.msgType === "ERR") {
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


/**
 * @method encodeMessage
 * @type {{
 *     msgType: String,
 *     messageContent: Object,
 *     binaryStream: BinaryStream
 * }}
 */

var writeTCPMessageHeader = function(msgType,chunkType,total_length,stream){

    if (stream instanceof Buffer) {
        stream = new BinaryStream(stream);
    }
    assert(is_valid_msg_type(msgType));
    assert(['A','F','C'].indexOf(chunkType) !== -1);

    stream.writeUInt8(msgType.charCodeAt(0));
    stream.writeUInt8(msgType.charCodeAt(1));
    stream.writeUInt8(msgType.charCodeAt(2));
    // Chunk type
    stream.writeUInt8(chunkType.charCodeAt(0)); // reserved

    stream.writeUInt32(total_length);
};

exports.writeTCPMessageHeader = writeTCPMessageHeader;

var encodeMessage = function (msgType, messageContent, stream) {

    //the length of the message, in bytes. (includes the 8 bytes of the message header)
    var total_length = messageContent.binaryStoreSize() + 8;

    writeTCPMessageHeader(msgType,"F",total_length,stream);
    messageContent.encode(stream);
    assert(total_length === stream.length , "invalid message size");
};

function packTcpMessage(msgType,encodableObject) {

    assert(is_valid_msg_type(msgType));

    var messageChunk = new Buffer(encodableObject.binaryStoreSize() + 8);
    // encode encodeableObject in a packet
    var stream = new BinaryStream(messageChunk);
    encodeMessage(msgType, encodableObject, stream);

    return messageChunk;

}

// opc.tcp://xleuri11022:51210/UA/SampleServer
function parseEndpointUrl(endpoint_url)
{
    var r = /([a-z.]*):\/\/([a-zA-Z\_\-\.\-0-9]*):([0-9]*)(\/.*){0,1}/;

    try {
        var matches = r.exec(endpoint_url);
        return {
            protocol: matches[1],
            hostname: matches[2],
            port:     parseInt(matches[3],10),
            address:  matches[4] || ""
        };

    }
    catch(err) {
        console.log("parseEndpointUrl: invalid endpoint URL " + endpoint_url);
    }
    return {
        protocol: "opc.tcp"
    };
}
function is_valid_endpointUrl(endpointUrl) {
    var e = opcua.parseEndpointUrl(endpointUrl);
    return e.hasOwnProperty("hostname");
}
exports.HelloMessage       = HelloMessage;
exports.AcknowledgeMessage = AcknowledgeMessage;
exports.TCPErrorMessage    = s.TCPErrorMessage;
exports.decodeMessage = decodeMessage;
//xx exports.encodeMessage = encodeMessage;
exports.packTcpMessage = packTcpMessage;
exports.parseEndpointUrl = parseEndpointUrl;
exports.is_valid_endpointUrl = is_valid_endpointUrl;

