import "should";
import { Mode } from "node-opcua-chunkmanager";

import { makeMessageChunkSignatureForTest, verifyMessageChunkSignatureForTest } from "../dist/test_helpers";
import {
    MessageSecurityMode,
    SecureMessageChunkManager,
    SecureMessageChunkManagerOptions,
    SequenceNumberGenerator,
    SymmetricAlgorithmSecurityHeader
} from "../dist/source";

function performMessageChunkManagerTest(securityMode: MessageSecurityMode, options: Partial<SecureMessageChunkManagerOptions>) {
    const securityHeader = new SymmetricAlgorithmSecurityHeader();

    const bodySize = 32;
    const headerSize = 12 + securityHeader.binaryStoreSize();

    options.signatureLength = options.signatureLength || 0; // 128 bytes for signature
    options.chunkSize = bodySize + options.signatureLength + headerSize + 8; // bodySize useful bytes

    options.requestId = 1;

    const sequenceNumberGenerator = new SequenceNumberGenerator();

    const channelId = options.channelId || 10;
    const msgChunkManager = new SecureMessageChunkManager(
        securityMode as unknown as Mode,
        "HEL",
        channelId,
        options as SecureMessageChunkManagerOptions,
        securityHeader,
        sequenceNumberGenerator
    );

    const chunks: Buffer[] = [];

    let chunkCounter = 0;

    function collect_chunk(chunk: Buffer) {
        const chunkCopy = Buffer.allocUnsafe(chunk.length);
        chunk.copy(chunkCopy, 0, 0, chunk.length);

        // append the copy to our chunk collection
        chunks.push(chunkCopy);
    }

    msgChunkManager.on("chunk", (chunk: Buffer, final: boolean) => {
        collect_chunk(chunk);

        chunkCounter += 1;
        if (!final) {
            // all packets shall be 'chunkSize'  byte long, except last
            chunk.length.should.equal(options.chunkSize);
        } else {
            // last packet is smaller
            // chunk.length.should.equal(  20 +/*padding*/  options.headerSize + options.signatureLength);
            chunkCounter.should.eql(5);
        }
    });

    // feed chunk-manager one byte at a time
    const n = bodySize * 4 + 12;

    const buf = Buffer.alloc(1);
    for (let i = 0; i < n; i += 1) {
        buf.writeUInt8(i % 256, 0);
        msgChunkManager.write(buf, 1);
    }

    // write this single buffer
    msgChunkManager.end();

    chunks.length.should.equal(5);

    // checking final flags ...
    chunks.forEach((chunk: Buffer) => {
        chunk.subarray(0, 3).toString().should.eql("HEL");
    });

    // check lengths
    chunks[0].subarray(4, 8).readUInt32LE(0).should.eql(options.chunkSize);
    chunks[1].subarray(4, 8).readUInt32LE(0).should.eql(options.chunkSize);
    chunks[2].subarray(4, 8).readUInt32LE(0).should.eql(options.chunkSize);
    chunks[3].subarray(4, 8).readUInt32LE(0).should.eql(options.chunkSize);

    chunks[chunks.length - 1]
        .subarray(4, 8)
        .readUInt32LE(0)
        .should.eql(12 + options.signatureLength + headerSize + 8);

    // check final car
    chunks[0].readUInt8(3).should.equal("C".charCodeAt(0));
    chunks[1].readUInt8(3).should.equal("C".charCodeAt(0));
    chunks[2].readUInt8(3).should.equal("C".charCodeAt(0));
    chunks[3].readUInt8(3).should.equal("C".charCodeAt(0));
    chunks[chunks.length - 1].readUInt8(3).should.equal("F".charCodeAt(0));

    if (options.verifyBufferFunc) {
        chunks.forEach(options.verifyBufferFunc);
    }
}

describe("SecureMessageChunkManager", function () {
    it("should split a message in chunk and produce a header ( NO SIGN & NO ENCRYPT).", function () {
        performMessageChunkManagerTest(MessageSecurityMode.None, { signatureLength: 0 });
    });

    it("should split a message in chunk and produce a header (  SIGN & NO ENCRYPT).", function () {
        performMessageChunkManagerTest(
            MessageSecurityMode.Sign, {
            signatureLength: 128,
            signBufferFunc: makeMessageChunkSignatureForTest,
            verifyBufferFunc: verifyMessageChunkSignatureForTest
        });
    });
});
