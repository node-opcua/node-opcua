/***
 * @module node-opcua-chunkmanager
 */
import { BinaryStream } from "node-opcua-binary-stream";
import { MessageHeader } from "node-opcua-packet-assembler";

export function readMessageHeader(stream: BinaryStream): MessageHeader {

    const msgType = String.fromCharCode(stream.readUInt8()) +
        String.fromCharCode(stream.readUInt8()) +
        String.fromCharCode(stream.readUInt8());

    const isFinal = String.fromCharCode(stream.readUInt8());
    const length = stream.readUInt32();
    return {msgType, isFinal, length};
}
