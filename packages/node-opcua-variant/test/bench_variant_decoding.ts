
import { BinaryStream } from "node-opcua-binary-stream";
import { decodeVariant, Variant } from "../source/variant";
import { DataType } from "node-opcua-basic-types";
import { Benchmarker } from "node-opcua-benchmarker";

const size = 10 * 1024 * 1024; // 10 MB
const buffer = Buffer.allocUnsafe(size + 100);
const stream = new BinaryStream(buffer);

// Create a large ByteArray Variant encoded in the stream
stream.writeUInt8(DataType.Byte | 0x80); // Byte | Array
stream.writeUInt32(size); // Array Length
for (let i = 0; i < size; i++) {
    stream.writeUInt8(i % 256);
}
const encodedBuffer = buffer.slice(0, stream.length);

console.log("Encoded Buffer Size:", encodedBuffer.length);

const bench = new Benchmarker();

bench.add("Variant Decoding (ByteArray)", () => {
    const s = new BinaryStream(encodedBuffer);
    const v = decodeVariant(s);
    if (v.value.length !== size) {
        throw new Error("Invalid Decode");
    }
});

bench.on("cycle", (message: string) => {
    console.log(message);
});

bench.on("complete", (fastest) => {
    console.log("Fastest is " + fastest.name);
});

console.log("Running Benchmark...");
(async () => {
    await bench.run({ max_time: 2 });
})();
