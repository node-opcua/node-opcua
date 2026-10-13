/***
 * @module node-opcua-chunkmanager
 */
import type { BinaryStream } from "node-opcua-binary-stream";
import type { MessageHeader } from "node-opcua-packet-assembler";

// every chunk header is read several times on its way in (packet assemblers, message builder): the message types
// and chunk types of OPC 10000-6 7.1.2 come back as the same interned strings instead of new ones per read
const messageTypes = new Map<number, string>();
for (const msgType of ["HEL", "ACK", "ERR", "RHE", "OPN", "CLO", "MSG"]) {
    messageTypes.set((msgType.charCodeAt(0) << 16) | (msgType.charCodeAt(1) << 8) | msgType.charCodeAt(2), msgType);
}
// keyed by the character code of the chunk type
const chunkTypes: Record<number, string> = { 70: "F", 67: "C", 65: "A" };

/** the message header at `offset` of `buffer`; throws if fewer than 8 bytes are left */
export function readMessageHeaderFromBuffer(buffer: Buffer, offset = 0): MessageHeader {
    if (offset + 8 > buffer.length) {
        throw new RangeError(`message header: 8 bytes needed at ${offset}, the buffer has ${buffer.length}`);
    }
    const b0 = buffer[offset];
    const b1 = buffer[offset + 1];
    const b2 = buffer[offset + 2];
    const b3 = buffer[offset + 3];
    const msgType =
        messageTypes.get((b0 << 16) | (b1 << 8) | b2) ??
        String.fromCharCode(b0) + String.fromCharCode(b1) + String.fromCharCode(b2);
    const isFinal = chunkTypes[b3] ?? String.fromCharCode(b3);
    const length = buffer.readUInt32LE(offset + 4);
    return { msgType, isFinal, length };
}

export function readMessageHeader(stream: BinaryStream): MessageHeader {
    if (stream.length + 8 <= stream.buffer.length) {
        const messageHeader = readMessageHeaderFromBuffer(stream.buffer, stream.length);
        stream.length += 8;
        return messageHeader;
    }
    // too short: the reads below raise the BinaryStream error
    const msgType =
        String.fromCharCode(stream.readUInt8()) + String.fromCharCode(stream.readUInt8()) + String.fromCharCode(stream.readUInt8());

    const isFinal = String.fromCharCode(stream.readUInt8());
    const length = stream.readUInt32();
    return { msgType, isFinal, length };
}
