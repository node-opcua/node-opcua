
import { Benchmarker } from "../../node-opcua-benchmarker/source/benchmarker";
import { MessageBuilderBase } from "../source/message_builder_base";
import { PacketAssembler } from "node-opcua-packet-assembler";
import { BinaryStream } from "node-opcua-binary-stream";

const bench = new Benchmarker();

const payloadSize = 1024 * 64; // 64KB message
const chunkBody = Buffer.alloc(payloadSize).fill("P");

// Construct a valid OPCUA chunk
// Header (8 bytes) + ChannelId (4 bytes) + Body
const header = Buffer.alloc(12);
header.write("MSG", 0);
header.write("F", 3); // Final
// Total length = Header (12) + Body
const totalLength = 12 + chunkBody.length;
header.writeUInt32LE(totalLength, 4);
header.writeUInt32LE(1, 8); // ChannelId

const chunk = Buffer.concat([header, chunkBody]);

const mb = new MessageBuilderBase({
    maxChunkSize: 1024 * 100 // 100KB
});
mb.on("full_message_body", (body) => {
    // no-op
});
mb.on("error", (err) => {
    console.error("Error:", err);
});

bench.add("MessageBuilderBase#feed", () => {
    mb.feed(chunk);
})
    .on("cycle", (message) => console.log(message))
    .on("complete", () => console.log("Done"))
    .run({ max_time: 2 });
