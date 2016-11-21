"use strict";
require("requirish")._(module);
var assert = require("better-assert");
var BinaryStream = require("lib/misc/binaryStream").BinaryStream;
var s = require("lib/datamodel/structures");
var TCPErrorMessage = require("lib/datamodel/structures").TCPErrorMessage;

var buffer_utils = require("lib/misc/buffer_utils");
var createFastUninitializedBuffer = buffer_utils.createFastUninitializedBuffer;

function is_valid_msg_type(msgType) {
    assert(["HEL", "ACK", "ERR",   // Connection Layer
            "OPN", "MSG", "CLO"    // OPC Unified Architecture, Part 6 page 36
        ].indexOf(msgType) >= 0, "invalid message type  " + msgType);
    return true;
}

var readMessageHeader = require("lib/misc/message_header").readMessageHeader;

function decodeMessage(stream, ClassName) {

    assert(stream instanceof BinaryStream);
    assert(ClassName instanceof Function, " expecting a function for " + ClassName);

    var header = readMessageHeader(stream);
    assert(stream.length === 8);

    var obj;
    if (header.msgType === "ERR") {
        //xx console.log(" received an error");
        obj = new TCPErrorMessage();
        obj.decode(stream);
        return obj;
    } else {
        obj = new ClassName();
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

var writeTCPMessageHeader = function (msgType, chunkType, total_length, stream) {

    if (stream instanceof Buffer) {
        stream = new BinaryStream(stream);
    }
    assert(is_valid_msg_type(msgType));
    assert(["A", "F", "C"].indexOf(chunkType) !== -1);

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

    writeTCPMessageHeader(msgType, "F", total_length, stream);
    messageContent.encode(stream);
    assert(total_length === stream.length, "invalid message size");
};

function packTcpMessage(msgType, encodableObject) {

    assert(is_valid_msg_type(msgType));

    var messageChunk = createFastUninitializedBuffer(encodableObject.binaryStoreSize() + 8);
    // encode encodeableObject in a packet
    var stream = new BinaryStream(messageChunk);
    encodeMessage(msgType, encodableObject, stream);

    return messageChunk;

}

// opc.tcp://xleuri11022:51210/UA/SampleServer
function parseEndpointUrl(endpoint_url) {

    var r = /^([a-z.]*):\/\/([a-zA-Z\_\-\.\-0-9]*):([0-9]*)(\/.*){0,1}/;

    var matches = r.exec(endpoint_url);

    if(!matches) {
        throw new Error("Invalid endpoint url ",endpoint_url);
    }
    return {
        protocol: matches[1],
        hostname: matches[2],
        port: parseInt(matches[3], 10),
        address: matches[4] || ""
    };
}
function is_valid_endpointUrl(endpointUrl) {
    var e = parseEndpointUrl(endpointUrl);
    return e.hasOwnProperty("hostname");
}
exports.TCPErrorMessage = s.TCPErrorMessage;
exports.decodeMessage = decodeMessage;
exports.packTcpMessage = packTcpMessage;
exports.parseEndpointUrl = parseEndpointUrl;
exports.is_valid_endpointUrl = is_valid_endpointUrl;

