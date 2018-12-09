"use strict";
const assert = require("node-opcua-assert").assert;

const BinaryStream = require("node-opcua-binary-stream").BinaryStream;
const createFastUninitializedBuffer = require("node-opcua-buffer-utils").createFastUninitializedBuffer;


const TCPErrorMessage = require("../_generated_/_auto_generated_TCPErrorMessage").TCPErrorMessage;
const readMessageHeader = require("node-opcua-chunkmanager").readMessageHeader;



function is_valid_msg_type(msgType) {
    assert(["HEL", "ACK", "ERR",   // Connection Layer
        "OPN", "MSG", "CLO"    // OPC Unified Architecture, Part 6 page 36
    ].indexOf(msgType) >= 0, "invalid message type  " + msgType);
    return true;
}


function decodeMessage(stream, ClassName) {

    assert(stream instanceof BinaryStream);
    assert(ClassName instanceof Function, " expecting a function for " + ClassName);

    const header = readMessageHeader(stream);
    assert(stream.length === 8);

    let obj;
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



function packTcpMessage(msgType, encodableObject) {

    assert(is_valid_msg_type(msgType));

    const messageChunk = createFastUninitializedBuffer(encodableObject.binaryStoreSize() + 8);
    // encode encodeableObject in a packet
    const stream = new BinaryStream(messageChunk);
    encodeMessage(msgType, encodableObject, stream);

    return messageChunk;

}

// opc.tcp://xleuri11022:51210/UA/SampleServer
function parseEndpointUrl(endpointUrl) {

    const r = /^([a-z.]*):\/\/([a-zA-Z_\-.\-0-9]*):([0-9]*)(\/.*){0,1}/;

    const matches = r.exec(endpointUrl);

    if(!matches) {
        throw new Error("Invalid endpoint url ",endpointUrl);
    }
    return {
        protocol: matches[1],
        hostname: matches[2],
        port: parseInt(matches[3], 10),
        address: matches[4] || ""
    };
}
function is_valid_endpointUrl(endpointUrl) {
    const e = parseEndpointUrl(endpointUrl);
    return e.hasOwnProperty("hostname");
}


/**
 * @method encodeMessage
 * @type {{
 *     msgType: String,
 *     messageContent: Object,
 *     binaryStream: BinaryStream
 * }}
 */

function writeTCPMessageHeader(msgType, chunkType, total_length, stream) {

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
}

function encodeMessage(msgType, messageContent, stream) {

    //the length of the message, in bytes. (includes the 8 bytes of the message header)
    const total_length = messageContent.binaryStoreSize() + 8;

    writeTCPMessageHeader(msgType, "F", total_length, stream);
    messageContent.encode(stream);
    assert(total_length === stream.length, "invalid message size");
}

exports.writeTCPMessageHeader = writeTCPMessageHeader;
exports.TCPErrorMessage = TCPErrorMessage;
exports.decodeMessage = decodeMessage;
exports.packTcpMessage = packTcpMessage;
exports.parseEndpointUrl = parseEndpointUrl;
exports.is_valid_endpointUrl = is_valid_endpointUrl;

