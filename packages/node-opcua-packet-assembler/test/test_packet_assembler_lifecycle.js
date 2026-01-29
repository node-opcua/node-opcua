const should = require("should");
const { PacketAssembler } = require("..");

function readChunkHeader(data) {
    const length = data.readUInt32LE(4);
    return {
        length,
        messageHeader: { msgType: "MSG", isFinal: "F", length },
        extra: ""
    };
}

describe("PacketAssembler Lifecycle", function() {

    it("should provide a view of the input buffer for single chunks (Zero Copy)", (done) => {
        const assembler = new PacketAssembler({
            readChunkFunc: readChunkHeader,
            minimumSizeInBytes: 8,
            maxChunkSize: 1024
        });

        const originalBuffer = Buffer.alloc(100);
        originalBuffer.writeUInt32LE(0xDEADBEEF, 0); // MsgType etc fake
        originalBuffer.writeUInt32LE(100, 4); // Length

        assembler.on("chunk", (chunk) => {
            // Check if chunk is the same Buffer instance (zero-copy)
            should(chunk === originalBuffer).be.true("PacketAssembler should return the same buffer instance (Zero Copy) for single chunks");

            // Further verification: modification of one should affect the other
            const oldVal = chunk[10];
            chunk[10] = 0xFF;
            should(originalBuffer[10]).equal(0xFF);
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
        part1.writeUInt32LE(0xDEADBEEF, 0);
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

});
