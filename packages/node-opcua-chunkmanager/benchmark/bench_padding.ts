
import { Benchmarker } from "../../node-opcua-benchmarker/source/benchmarker";
import { ChunkManager, Mode } from "../source/chunk_manager";

const bench = new Benchmarker();

const chunkSize = 1024 * 1024; // 1MB chunk

// Create shared instances to reuse
const cm = new ChunkManager(Mode.SignAndEncrypt, {
    chunkSize: chunkSize,
    headerSize: 10,
    signatureLength: 128,
    sequenceHeaderSize: 8,
    cipherBlockSize: 256,
    plainBlockSize: 256 - 11, // Typical RSA
    encryptBufferFunc: (buffer) => {
        // Mock encryption extending size
        const dest = Buffer.alloc(Math.ceil(buffer.length / 245) * 256);
        return dest;
    },
    signBufferFunc: (buffer) => Buffer.alloc(128),
    writeHeaderFunc: () => { },
    writeSequenceHeaderFunc: () => { }
});

bench.add("ChunkManager#write", () => {
    // Write enough data to almost fill a block but leave space for padding
    // plainBlockSize is 245.
    // We want to write say 1 byte, so 244 bytes of padding loop.
    cm.write(Buffer.from("A"));
    cm.end();
})
    .on("cycle", (message) => console.log(message))
    .on("complete", () => console.log("Done"))
    .run({ max_time: 1 });
