import should from "should";
import { PacketAssembler, PacketAssemblerErrorCode, type PacketInfo } from "../dist/index.js";

function readChunkHeader(data: Buffer): PacketInfo {
    const length = data.readUInt32LE(4);
    return {
        length,
        messageHeader: { msgType: "MSG", isFinal: "F", length },
        extra: ""
    };
}

describe("PacketAssembler Lifecycle", () => {
    it("should provide a view of the input buffer for single chunks (Zero Copy)", (done) => {
        const assembler = new PacketAssembler({
            readChunkFunc: readChunkHeader,
            minimumSizeInBytes: 8,
            maxChunkSize: 1024
        });

        const originalBuffer = Buffer.alloc(100);
        originalBuffer.writeUInt32LE(0xdeadbeef, 0); // MsgType etc fake
        originalBuffer.writeUInt32LE(100, 4); // Length

        assembler.on("chunk", (chunk) => {
            // Check if chunk is the same Buffer instance (zero-copy)
            should(chunk === originalBuffer).be.true(
                "PacketAssembler should return the same buffer instance (Zero Copy) for single chunks"
            );

            // Further verification: modification of one should affect the other
            const oldVal = chunk[10];
            chunk[10] = 0xff;
            should(originalBuffer[10]).equal(0xff);
            chunk[10] = oldVal; // restore

            done();
        });

        assembler.feed(originalBuffer);
    });

    it("should provide a new buffer for fragmented chunks (Safe Copy)", (done) => {
        const assembler = new PacketAssembler({
            readChunkFunc: readChunkHeader,
            minimumSizeInBytes: 8,
            maxChunkSize: 1024
        });

        // Packet length 100
        // Feed 50 bytes, then 50 bytes
        const part1 = Buffer.alloc(50);
        part1.writeUInt32LE(0xdeadbeef, 0);
        part1.writeUInt32LE(100, 4);

        const part2 = Buffer.alloc(50);

        assembler.on("chunk", (chunk) => {
            // Check if chunk shares memory with part1 or part2
            const sharesMemory1 = chunk.buffer === part1.buffer;
            const sharesMemory2 = chunk.buffer === part2.buffer;

            should(sharesMemory1).be.false("Fragmented chunk should NOT share memory with input part 1");
            should(sharesMemory2).be.false("Fragmented chunk should NOT share memory with input part 2");

            done();
        });

        assembler.feed(part1);
        assembler.feed(part2);
    });

    it("should apply a limit changed from a chunk handler to the rest of the same input buffer", () => {
        const assembler = new PacketAssembler({
            readChunkFunc: readChunkHeader,
            minimumSizeInBytes: 8,
            maxChunkSize: 1024
        });

        // two packets in a single buffer: 16 bytes, then 64 bytes
        const data = Buffer.alloc(16 + 64);
        data.writeUInt32LE(16, 4);
        data.writeUInt32LE(64, 16 + 4);

        const chunkLengths: number[] = [];
        const errorCodes: PacketAssemblerErrorCode[] = [];
        assembler.on("chunk", (chunk) => {
            chunkLengths.push(chunk.length);
            assembler.setMaxChunkSize(32);
        });
        assembler.on("error", (_err, code) => {
            errorCodes.push(code);
        });

        assembler.feed(data);

        should(chunkLengths).eql([16]);
        should(errorCodes).eql([PacketAssemblerErrorCode.ChunkSizeExceeded]);
    });
});
