"use strict";
const should = require("should");

const SecureMessageChunkManager = require("../src/secure_message_chunk_manager").SecureMessageChunkManager;
const SequenceNumberGenerator = require("../src/sequence_number_generator").SequenceNumberGenerator;
const SymmetricAlgorithmSecurityHeader = require("node-opcua-service-secure-channel").SymmetricAlgorithmSecurityHeader;


function performMessageChunkManagerTest(options) {

    options = options || {};
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

    //xxoptions.chunkManager.maxBodySize;
    // new MessageChunkManager(body_size,"HEL",0xDEADBEEF,options);

    const chunks = [];

    let chunk_counter = 0;

    function collect_chunk(chunk) {
        const copy_chunk = new Buffer(chunk.length);
        chunk.copy(copy_chunk, 0, 0, chunk.length);

        // append the copy to our chunk collection
        chunks.push(copy_chunk);
    }

    msgChunkManager.on("chunk", function (chunk, final) {

        //xx console.log(utils.hexDump(chunk));
        collect_chunk(chunk);

        chunk_counter += 1;
        if (!final) {
            // all packets shall be 'chunkSize'  byte long, except last
            chunk.length.should.equal(options.chunkSize);

        } else {
            // last packet is smaller
            //xx chunk.length.should.equal(  20 +/*padding*/  options.headerSize + options.signatureLength);
            chunk_counter.should.eql(5);
        }
    });

    // feed chunk-manager on byte at a time
    const n = (bodySize) * 4 + 12;

    const buf = new Buffer(1);
    for (let i = 0; i < n; i += 1) {
        buf.writeUInt8(i % 256, 0);
        msgChunkManager.write(buf, 1);
    }

    // write this single buffer
    msgChunkManager.end();

    chunks.length.should.equal(5);

    // checking final flags ...
    chunks.forEach(function (chunk) {
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

    if (options.verifyChunk) {
        chunks.forEach(options.verifyChunk);
    }

}


describe("MessageChunkManager", function () {


    it("should split a message in chunk and produce a header ( NO SIGN & NO ENCRYPT).", function () {

        performMessageChunkManagerTest(null);

    });

    it("should split a message in chunk and produce a header (  SIGN & NO ENCRYPT).", function () {


        const makeMessageChunkSignatureForTest = require("../test_helpers/signature_helpers").makeMessageChunkSignatureForTest;
        const verifyMessageChunkSignatureForTest = require("../test_helpers/signature_helpers").verifyMessageChunkSignatureForTest;

        const options = {
            signatureLength: 128,
            signingFunc: makeMessageChunkSignatureForTest,
            verifyChunk: verifyMessageChunkSignatureForTest
        };

        performMessageChunkManagerTest(options);

    });


});

