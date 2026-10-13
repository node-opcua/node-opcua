import { BinaryStream } from "node-opcua-binary-stream";
import should from "should";
import { readMessageHeader, readMessageHeaderFromBuffer } from "../dist/index.js";

function header(msgType: string, isFinal: string, length: number): Buffer {
    const buffer = Buffer.alloc(12, 0xee);
    buffer.write(msgType + isFinal, 0, "latin1");
    buffer.writeUInt32LE(length, 4);
    return buffer;
}

describe("readMessageHeader", () => {
    it("reads every message type and chunk type of OPC 10000-6 7.1.2, from a buffer and from a stream", () => {
        for (const msgType of ["HEL", "ACK", "ERR", "RHE", "OPN", "CLO", "MSG"]) {
            for (const isFinal of ["F", "C", "A"]) {
                const buffer = header(msgType, isFinal, 1234);
                should(readMessageHeaderFromBuffer(buffer)).eql({ msgType, isFinal, length: 1234 });
                const stream = new BinaryStream(buffer);
                should(readMessageHeader(stream)).eql({ msgType, isFinal, length: 1234 });
                should(stream.length).eql(8);
            }
        }
    });

    it("reads an unknown message type and chunk type as their characters", () => {
        should(readMessageHeaderFromBuffer(header("XYZ", "Q", 9))).eql({ msgType: "XYZ", isFinal: "Q", length: 9 });
    });

    it("reads at an offset", () => {
        const buffer = Buffer.concat([Buffer.alloc(5), header("MSG", "F", 77)]);
        should(readMessageHeaderFromBuffer(buffer, 5)).eql({ msgType: "MSG", isFinal: "F", length: 77 });
        const stream = new BinaryStream(buffer);
        stream.length = 5;
        should(readMessageHeader(stream)).eql({ msgType: "MSG", isFinal: "F", length: 77 });
        should(stream.length).eql(13);
    });

    it("throws on fewer than 8 bytes, as the stream reads did", () => {
        should(() => readMessageHeaderFromBuffer(Buffer.alloc(7))).throw();
        should(() => readMessageHeader(new BinaryStream(Buffer.alloc(7)))).throw();
    });
});
