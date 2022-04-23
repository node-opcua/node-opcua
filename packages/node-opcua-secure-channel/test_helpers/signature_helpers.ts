import * as  fs from "fs";
import { assert } from "node-opcua-assert";
import { makeMessageChunkSignature, verifyChunkSignature } from "node-opcua-crypto";
import { SymmetricAlgorithmSecurityHeader } from "node-opcua-service-secure-channel";
import  "should";
import { SecureMessageChunkManager, SecureMessageChunkManagerOptions, SequenceNumberGenerator } from "../source";

// tslint:disable:no-var-requires
const { getFixture } = require("node-opcua-test-fixtures");

function construct_makeMessageChunkSignatureForTest() {

    const privateKey = fs.readFileSync(getFixture("certs/server_key_1024.pem")).toString("utf-8");

    return (chunk: Buffer) => {
        const options = {
            algorithm: "RSA-SHA256",
            privateKey,
            signatureLength: 128,
        };
        const buf = makeMessageChunkSignature(chunk, options); // Buffer
        assert(buf instanceof Buffer, "expecting a Buffer");
        return buf;
    };
}

export const makeMessageChunkSignatureForTest = construct_makeMessageChunkSignatureForTest();

export function construct_verifyMessageChunkSignatureForTest() {
    const publicKey = fs.readFileSync(getFixture("certs/server_public_key_1024.pub")).toString("utf-8");
    return (chunk: Buffer) => {
        assert(chunk instanceof Buffer);
        const options = {
            algorithm: "RSA-SHA256",
            publicKey,
            signatureLength: 128
        };

        return verifyChunkSignature(chunk, options);
    };

}

export const verifyMessageChunkSignatureForTest = construct_verifyMessageChunkSignatureForTest();

export function performMessageChunkManagerTest(options: SecureMessageChunkManagerOptions) {

    const securityHeader = new SymmetricAlgorithmSecurityHeader();

    const bodySize = 32;
    const headerSize = 12 + securityHeader.binaryStoreSize();

    options.signatureLength = options.signatureLength || 0;   // 128 bytes for signature
    options.chunkSize = bodySize + options.signatureLength + headerSize + 8;    // bodySize useful bytes

    options.requestId = 1;

    const sequenceNumberGenerator = new SequenceNumberGenerator();

    const msgChunkManager = new SecureMessageChunkManager(
        "HEL", options, securityHeader, sequenceNumberGenerator
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
    const n = (bodySize) * 4 + 12;

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
        chunk.slice(0, 3).toString().should.eql("HEL");
    });

    // check length
    chunks[0].slice(4, 8).readUInt32LE(0).should.eql(options.chunkSize);
    chunks[1].slice(4, 8).readUInt32LE(0).should.eql(options.chunkSize);
    chunks[2].slice(4, 8).readUInt32LE(0).should.eql(options.chunkSize);
    chunks[3].slice(4, 8).readUInt32LE(0).should.eql(options.chunkSize);

    chunks[chunks.length - 1].slice(4, 8).readUInt32LE(0).should.eql(12 + options.signatureLength + headerSize + 8);

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
