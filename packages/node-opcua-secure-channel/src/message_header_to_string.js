/**
 * @module opcua.miscellaneous
 */
const assert = require("node-opcua-assert").assert;

const BinaryStream = require("node-opcua-binary-stream").BinaryStream;
const hexDump = require("node-opcua-debug").hexDump;

const readMessageHeader = require("node-opcua-chunkmanager").readMessageHeader;

const chooseSecurityHeader = require("./secure_message_chunk_manager").chooseSecurityHeader;
const SequenceHeader = require("node-opcua-service-secure-channel").SequenceHeader;

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
