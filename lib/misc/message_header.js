"use strict";
/**
 * @module opcua.miscellaneous
 */
require("requirish")._(module);

var BinaryStream = require("lib/misc/binaryStream").BinaryStream;
var assert = require("better-assert");
var hexDump = require("lib/misc/utils").hexDump;

function readMessageHeader(stream) {

    assert(stream instanceof BinaryStream);

    var msgType = String.fromCharCode(stream.readUInt8()) +
        String.fromCharCode(stream.readUInt8()) +
        String.fromCharCode(stream.readUInt8());

    var isFinal = String.fromCharCode(stream.readUInt8());

    var length = stream.readUInt32();

    return {msgType: msgType, isFinal: isFinal, length: length};
}

exports.readMessageHeader = readMessageHeader;

/**
 * convert the messageChunk header to a string
 * @method messageHeaderToString
 * @param messageChunk {BinaryStream}
 * @return {string}
 */
function messageHeaderToString(messageChunk) {

    var stream = new BinaryStream(messageChunk);

    var messageHeader = readMessageHeader(stream);
    if (messageHeader.msgType === "ERR" || messageHeader.msgType === "HEL") {
        return messageHeader.msgType + " " + messageHeader.isFinal + " length   = " + messageHeader.length;
    }

    var chooseSecurityHeader = require("lib/services/secure_channel_service").chooseSecurityHeader;
    var SequenceHeader = require("lib/services/secure_channel_service").SequenceHeader;

    var securityHeader = chooseSecurityHeader(messageHeader.msgType);

    var sequenceHeader = new SequenceHeader();
    assert(stream.length === 8);

    var secureChannelId = stream.readUInt32();
    securityHeader.decode(stream);
    sequenceHeader.decode(stream);

    var slice = messageChunk.slice(0, stream.length);


    return messageHeader.msgType + " " +
        messageHeader.isFinal +
        " length   = " + messageHeader.length +
        " channel  = " + secureChannelId +
        " seqNum   = " + sequenceHeader.sequenceNumber +
        " req ID   = " + sequenceHeader.requestId +
        " security   = " + JSON.stringify(securityHeader) +
        "\n\n" + hexDump(slice);
}
exports.messageHeaderToString = messageHeaderToString;

