/**
 * @module node-opcua-secure-channel
 */
import { assert } from "node-opcua-assert";
import { BinaryStream } from "node-opcua-binary-stream";
import { readMessageHeader, SequenceHeader } from "node-opcua-chunkmanager";
import { hexDump } from "node-opcua-debug";
import { chooseSecurityHeader } from "./secure_message_chunk_manager";

/**
 * convert the messageChunk header to a string
 * @method messageHeaderToString
 * @param messageChunk {BinaryStream}
 * @return {string}
 */
export function messageHeaderToString(messageChunk: Buffer): string {

    const stream = new BinaryStream(messageChunk);

    const messageHeader = readMessageHeader(stream);
    if (messageHeader.msgType === "ERR" || messageHeader.msgType === "HEL") {
        return messageHeader.msgType + " " + messageHeader.isFinal + " length   = " + messageHeader.length;
    }

    const securityHeader = chooseSecurityHeader(messageHeader.msgType);

    const sequenceHeader = new SequenceHeader();
    assert(stream.length === 8);

    const channelId = stream.readUInt32();
    securityHeader.decode(stream);
    sequenceHeader.decode(stream);

    const slice = messageChunk.slice(0, stream.length);

    return messageHeader.msgType + " " +
        messageHeader.isFinal +
        " length   = " + messageHeader.length +
        " channel  = " + channelId +
        " seqNum   = " + sequenceHeader.sequenceNumber +
        " req ID   = " + sequenceHeader.requestId +
        " security   = " + securityHeader.toString() +
        "\n\n" + hexDump(slice);
}
