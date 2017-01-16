/**
 * @module opcua.miscellaneous
 */
require("requirish")._(module);

const BinaryStream = require("lib/misc/binaryStream").BinaryStream;
const assert = require("better-assert");
const hexDump = require("lib/misc/utils").hexDump;

function readMessageHeader(stream) {

    assert(stream instanceof BinaryStream);

    const msgType = String.fromCharCode(stream.readUInt8()) +
        String.fromCharCode(stream.readUInt8()) +
        String.fromCharCode(stream.readUInt8());

    const isFinal = String.fromCharCode(stream.readUInt8());

    const length = stream.readUInt32();

    return {msgType, isFinal, length};
}

exports.readMessageHeader = readMessageHeader;

/**
 * convert the messageChunk header to a string
 * @method messageHeaderToString
 * @param messageChunk {BinaryStream}
 * @return {string}
 */
function messageHeaderToString(messageChunk) {

    const stream = new BinaryStream(messageChunk);

    const messageHeader = readMessageHeader(stream);
    if (messageHeader.msgType === "ERR" || messageHeader.msgType === "HEL") {
        return messageHeader.msgType + " " + messageHeader.isFinal + " length   = " + messageHeader.length;
    }

    const chooseSecurityHeader = require("lib/services/secure_channel_service").chooseSecurityHeader;
    const SequenceHeader = require("lib/services/secure_channel_service").SequenceHeader;

    const securityHeader = chooseSecurityHeader(messageHeader.msgType);

    const sequenceHeader = new SequenceHeader();
    assert(stream.length === 8);

    const secureChannelId = stream.readUInt32();
    securityHeader.decode(stream);
    sequenceHeader.decode(stream);

    const slice = messageChunk.slice(0, stream.length);


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

