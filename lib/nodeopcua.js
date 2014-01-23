var assert = require("assert");

var BinaryStream = require("./binaryStream").BinaryStream;
var ec = require("./encode_decode");


//===========================================================
function GUID(value) {
    // pattern should be
    // “72962B91-FA75-4AE6-8D28-B404DC7DAF63”
    this.guid = value;
}


GUID.prototype.encode = function (stream) {
    ec.encodeGUID(this.guid,stream);
};


function Enum(possibleValues) {
    this.possibleValues = possibleValues;
    this.value = possibleValues[0];
}
Enum.prototype.encode = function (binaryStream) {

};

function NodeId(name) {
    this.namespace = 0;
    this.value = name;

}

NodeId.prototype.encode = function (binaryStream) {

    ec.encodeNodeId(this,binaryStream);
};

function LocalizeText() {
    this.encodingMask = new Byte();
    this.locale = "";
    this.text = "";
}

LocalizeText.prototype.encode = function (binaryStream) {

};
LocalizeText.prototype.decode = function (binaryStream) {

};
opcua = exports;


var HelloMessage_Description = {
    name: "HelloMessage",
    fields: [
        { name: "protocolVersion"   , fieldType: "Integer" },
        { name: "receiveBufferSize" , fieldType: "Integer" },
        { name: "sendBufferSize"    , fieldType: "Integer" },
        { name: "maxMessageSize"    , fieldType: "Integer" },
        { name: "maxChunkCount"     , fieldType: "Integer" },
        { name: "endpointUrl"       , fieldType: "UAString"}
    ]
};

var AcknowledgeMessage_Description = {
    name: "AcknowledgeMessage",
    fields: [
        { name: "protocolVersion"   , fieldType: "Integer" },
        { name: "receiveBufferSize" , fieldType: "Integer" },
        { name: "sendBufferSize"    , fieldType: "Integer" },
        { name: "maxMessageSize"    , fieldType: "Integer" },
        { name: "maxChunkCount"     , fieldType: "Integer" }
    ]
};

ErrorMessage_Description = {
    name: "ErrorMessage",
    fields: [
        {name: "Error",  fieldType: "UInt32", comment: "The numeric code for the error. This shall be one of the values listed in Table 40." },
        {name: "Reason", fieldType: "String", comment: "A more verbose description of the error.This string shall not be more than 4096 characters." }
    ]
};

var factories = require("../lib/factories");
var HelloMessage       = factories.UAObjectFactoryBuild(HelloMessage_Description);
var AcknowledgeMessage = factories.UAObjectFactoryBuild(AcknowledgeMessage_Description);
var ErrorMessage       = factories.UAObjectFactoryBuild(ErrorMessage_Description);


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
    assert(['HEL', 'ACK', 'ERR'].indexOf(msgType) >= 0);
    stream.writeByte(msgType.charCodeAt(0));
    stream.writeByte(msgType.charCodeAt(1));
    stream.writeByte(msgType.charCodeAt(2));
    stream.writeByte(0); // reserved
    stream.writeInteger(0); //the length of the message, in bytes. (includes the 8 bytes of the message header)
    messageContent.encode(stream);
    length = stream.length;
    stream.stream.writeUInt32LE(length, 4);
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


    header = readMessageHeader(stream);
    obj = new className();
    obj.decode(stream);
    return obj;
}

exports.BinaryStream = BinaryStream;
exports.GUID = GUID;
exports.NodeId = NodeId;
exports.HelloMessage = HelloMessage;
exports.AcknowledgeMessage = AcknowledgeMessage;


exports.encodeMessage = encodeMessage;
exports.decodeMessage = decodeMessage;


function sendMessage(socket, msgType, msg, callback) {
    assert(['HEL', 'ACK', 'ERR'].indexOf(msgType) >= 0);

    // encode message in a packet
    var stream = new opcua.BinaryStream();
    opcua.encodeMessage(msgType, msg, stream);
    s = stream.stream.slice(0, stream.length);

    // write data to socket
    socket.write(s, callback);

}

exports.sendMessage = sendMessage;

var s = require("./structures");
exports.GetEndpointsRequest = s.GetEndpointsRequest;
