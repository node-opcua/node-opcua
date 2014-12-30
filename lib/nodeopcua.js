require("requirish")._(module);
var assert = require("better-assert");
var BinaryStream = require("lib/misc/binaryStream").BinaryStream;
var ec = require("lib/misc/encode_decode");
var s = require("lib/datamodel/structures");
var factories = require("lib/misc/factories");


var opcua = exports;

opcua.AcknowledgeMessage = require("_generated_/_auto_generated_AcknowledgeMessage").AcknowledgeMessage;
opcua.HelloMessage       = require("_generated_/_auto_generated_HelloMessage").HelloMessage;
opcua.ErrorMessage       = require("_generated_/_auto_generated_ErrorMessage").ErrorMessage;


function is_valid_msg_type(msgType) {
    assert([ 'HEL', 'ACK', 'ERR',   // Connection Layer
        'OPN', 'MSG', 'CLO'    // OPC Unified Architecture, Part 6 page 36
    ].indexOf(msgType) >= 0, "invalid message type  " + msgType);
    return true;
}

var readMessageHeader  = require("lib/misc/message_header").readMessageHeader;

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
exports.TCPErrorMessage    = s.TCPErrorMessage;
exports.decodeMessage = decodeMessage;
exports.packTcpMessage = packTcpMessage;
exports.parseEndpointUrl = parseEndpointUrl;
exports.is_valid_endpointUrl = is_valid_endpointUrl;

