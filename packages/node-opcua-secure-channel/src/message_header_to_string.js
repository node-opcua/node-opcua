/**
 * @module opcua.miscellaneous
 */
var assert = require("node-opcua-assert");

var BinaryStream = require("node-opcua-binary-stream").BinaryStream;
var hexDump = require("node-opcua-debug").hexDump;

var readMessageHeader = require("node-opcua-chunkmanager").readMessageHeader;

var chooseSecurityHeader = require("./secure_message_chunk_manager").chooseSecurityHeader;
var SequenceHeader = require("node-opcua-service-secure-channel").SequenceHeader;

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
