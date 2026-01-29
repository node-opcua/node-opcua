
import { PacketAssembler, PacketInfo } from "../source/packet_assembler";
import { BinaryStream } from "../../node-opcua-binary-stream/source/binaryStream";
import { decodeVariant } from "../../node-opcua-variant/source/variant";
import { DataType } from "../../node-opcua-variant/source/DataType_enum";
import "should";

describe("PacketAssembler - Buffer Lifecycle Proof", () => {

    it("should provide a view of the input buffer for single chunks (Zero Copy)", (done) => {

        const readChunkFunc = (data: Buffer): PacketInfo => {
            return {
                length: data.readUInt32LE(4),
                messageHeader: { msgType: "MSG", isFinal: "F", length: data.readUInt32LE(4) },
                extra: ""
            };
        };

        const assembler = new PacketAssembler({
            readChunkFunc,
            minimumSizeInBytes: 8,
            maxChunkSize: 1024
        });

        const size = 16;
        const inputBuffer = Buffer.alloc(size + 8 + 5);
        inputBuffer.write("MSGF", 0);
        inputBuffer.writeUInt32LE(size + 8 + 5, 4);
        // Payload: Byte Array Variant
        inputBuffer.writeUInt8(DataType.Byte | 0x80, 8);
        inputBuffer.writeUInt32LE(size, 9);
        for (let i = 0; i < size; i++) inputBuffer.writeUInt8(i, 13 + i);

        assembler.on("chunk", (chunk: Buffer) => {
            try {
                // 1. Decode using zero-copy
                const stream = new BinaryStream(chunk);
                stream.length = 8; // skip header
                const v = decodeVariant(stream);

                v.value.should.be.instanceOf(Uint8Array);
                v.value[0].should.equal(0);

                // 2. Simulate reuse of inputBuffer
                inputBuffer.writeUInt8(99, 13);

                // 3. Check if v.value changed
                // With zero-copy, modifying inputBuffer WILL affect the decoded variant
                // because they share the same underlying memory buffer
                v.value[0].should.equal(99, "Zero-copy: Decoded variant shares memory with input buffer");

                done();
            } catch (err) {
                done(err);
            }
        });

        assembler.feed(inputBuffer);
    });

    it("should provide a safe copy when chunks are concatenated (Multi-Chunk case)", (done) => {
        const readChunkFunc = (data: Buffer): PacketInfo => {
            return {
                length: data.readUInt32LE(4),
                messageHeader: { msgType: "MSG", isFinal: "F", length: data.readUInt32LE(4) },
                extra: ""
            };
        };

        const assembler = new PacketAssembler({
            readChunkFunc,
            minimumSizeInBytes: 8,
            maxChunkSize: 1024
        });

        const size = 16;
        const inputBuffer1 = Buffer.alloc(13);
        inputBuffer1.write("MSGF", 0);
        inputBuffer1.writeUInt32LE(size + 8 + 5, 4);
        inputBuffer1.writeUInt8(DataType.Byte | 0x80, 8);
        inputBuffer1.writeUInt32LE(size, 9);

        const inputBuffer2 = Buffer.alloc(size + 8 + 5 - 13);
        for (let i = 0; i < inputBuffer2.length; i++) inputBuffer2.writeUInt8(i, i);

        assembler.on("chunk", (chunk: Buffer) => {
            const stream = new BinaryStream(chunk);
            stream.length = 8;
            const v = decodeVariant(stream);

            // Modify original buffers
            inputBuffer2.writeUInt8(99, 0);

            v.value[0].should.not.equal(99, "Concatenated chunks are always safe as they are copies");
            done();
        });

        assembler.feed(inputBuffer1);
        assembler.feed(inputBuffer2);
    });
});
