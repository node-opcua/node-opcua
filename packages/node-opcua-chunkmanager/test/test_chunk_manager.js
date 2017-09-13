"use strict";
var should = require("should");
var ChunkManager = require("..").ChunkManager;

var util = require("util");
var assert = require("node-opcua-assert");
var _ = require("underscore");

var hexDump = require("node-opcua-debug").hexDump;

function make_packet(packet_length) {
    var buf = new Buffer(packet_length);
    buf.length.should.eql(packet_length);
    for (var i = 0; i < buf.length; i++) {
        buf.writeUInt8(i, i % 256);
    }
    return buf;
}

var do_debug = false;

function compute_fake_signature(section_to_sign) {

    var signature = new Buffer(4);
    for (var i = 0; i < signature.length; i++) {
        signature.writeUInt8(0xCC, i);
    }
    return signature;
}

function write_fake_header(block, isLast, total_length) {
    for (var i = 0; i < this.headerSize; i++) {
        block.writeUInt8(0xAA, i);
    }
}

function write_fake_sequence_header(block) {
    for (var i = 0; i < this.sequenceHeaderSize; i++) {
        block.writeUInt8(0xBB, i);
    }
}

function fake_encrypt_block(block) {

    assert(this.plainBlockSize + 2 === this.cipherBlockSize);
    assert(this.plainBlockSize === block.length);

    var encrypted_block = new Buffer(block.length + 2);
    encrypted_block.writeUInt8(0xDE, 0);
    block.copy(encrypted_block, 1, 0, block.length);
    encrypted_block.writeUInt8(0xDF, block.length + 1);
    return encrypted_block;
}

function fake_encrypt_buffer(buffer) {

    this.encrypt_block = fake_encrypt_block;

    assert(_.isFunction(this.encrypt_block));

    var nbBlocks = Math.ceil(buffer.length / (this.plainBlockSize));

    var outputBuffer = new Buffer(nbBlocks * this.cipherBlockSize);

    for (var i = 0; i < nbBlocks; i++) {
        var currentBlock = buffer.slice(this.plainBlockSize * i, this.plainBlockSize * (i + 1));

        var encrypted_chunk = this.encrypt_block(currentBlock);

        assert(encrypted_chunk.length === this.cipherBlockSize);
        encrypted_chunk.copy(outputBuffer, i * this.cipherBlockSize);
    }
    return outputBuffer;
}

function no_encrypt_block(block) {

    assert(this.plainBlockSize === this.cipherBlockSize);
    return block;
}

function make_hex_block(hexString) {
    return new Buffer(hexString.split(" ").join(""), "hex");
}

describe("Chunk manager - no header - no signature - no encryption", function () {

    it("should decompose a large single write in small chunks", function () {

        var chunkManager = new ChunkManager({
            chunkSize: 48,
            sequenceHeaderSize: 0
        });
        chunkManager.chunkSize.should.equal(48);
        chunkManager.sequenceHeaderSize.should.equal(0);
        chunkManager.maxBodySize.should.equal(48);

        var chunk_counter = 0;
        chunkManager.on("chunk", function (chunk) {

            if (chunk_counter < 2) {
                // all packets shall be 48 byte long, except last
                chunk.length.should.equal(48);
            } else {
                // last packet is smaller
                chunk.length.should.equal(12);
            }
            if (do_debug) {
                console.log(" chunk " + chunk_counter + " " + chunk.toString("hex"));
            }
            chunk_counter += 1;
        });

        // create a large buffer ( 2.3 time bigger than chunksize)
        var n = 48 * 2 + 12;
        var buf = make_packet(n);

        // write this single buffer
        chunkManager.write(buf, buf.length);
        chunkManager.end();

        chunk_counter.should.equal(3);

    });

    it("should decompose many small writes in small chunks", function () {

        var chunkManager = new ChunkManager({
            chunkSize: 48,
            sequenceHeaderSize: 0
        });
        chunkManager.chunkSize.should.equal(48);
        chunkManager.maxBodySize.should.equal(48);

        var chunk_counter = 0;
        chunkManager.on("chunk", function (chunk) {
            // console.log(" chunk "+ chunk_counter + " " + chunk.toString("hex"));
            if (chunk_counter < 2) {
                // all packets shall be 48 byte long, except last
                chunk.length.should.equal(48);
            } else {
                // last packet is smaller
                chunk.length.should.equal(12);
            }
            chunk_counter += 1;
        });

        // feed chunk-manager on byte at a time
        var n = 48 * 2 + 12;
        var buf = new Buffer(1);
        for (var i = 0; i < n; i += 1) {
            buf.writeInt8(i, 0);
            chunkManager.write(buf, 1);
        }
        // write this single buffer
        chunkManager.end();
        chunk_counter.should.equal(3);
    });

});


function perform_test(chunkManager, packet_length, expected_chunk_lengths, done) {

    var expected_chunks = null;
    if (typeof expected_chunk_lengths[0] === "string") {
        expected_chunks = expected_chunk_lengths.map(make_hex_block);
        expected_chunk_lengths = expected_chunks.map(function (b) {
            return b.length;
        });
    }
    var chunk_counter = 0;

    chunkManager.on("chunk", function (chunk, is_last) {

        if (do_debug) {
            console.log("chunk = ", chunk.toString("hex"));
        }
        should.exist(chunk);

        chunk_counter.should.not.be.greaterThan(expected_chunk_lengths.length);

        chunk.length.should.eql(expected_chunk_lengths[chunk_counter], " testing chunk " + chunk_counter);

        if (expected_chunks) {

            if (do_debug) {
                console.log(hexDump(chunk));
                console.log(hexDump(expected_chunks[chunk_counter]));
            }

            chunk.toString("hex").should.equal(expected_chunks[chunk_counter].toString("hex"));
        }
        chunk_counter += 1;
        if (chunk_counter === expected_chunk_lengths.length) {
            is_last.should.equal(true);
            done();
        } else {
            is_last.should.equal(false);
        }
    });

    var buf = make_packet(packet_length);

    chunkManager.write(buf);
    chunkManager.end();

}


describe("Chunk Manager (chunk size 32 bytes, sequenceHeaderSize: 8 bytes)\n", function () {

    var chunkManager;

    beforeEach(function () {
        chunkManager = new ChunkManager({
            chunkSize: 32,

            sequenceHeaderSize: 8,
            writeSequenceHeaderFunc: write_fake_sequence_header

        });
        chunkManager.chunkSize.should.equal(32);
        chunkManager.sequenceHeaderSize.should.equal(8);
        chunkManager.maxBodySize.should.equal(24);
    });

    it("should transform a 32 bytes message into a chunk of 32 bytes and 16 bytes", function (done) {
        // block 1 : [ 0  +  8 +  24 ] = 32
        // block 2 : [ 0  +  8 +   8 ] = 16
        //                      ------
        //                        32
        perform_test(chunkManager, 32, [32, 16], done);
    });
    it("should transform a 33 bytes message into a chunk of 32 bytes and 17 bytes", function (done) {
        // block 1 : [ 0  +  8 +  24 ] = 32
        // block 2 : [ 0  +  8 +   9 ] = 17
        //                      ------
        //                        33
        perform_test(chunkManager, 33, [32, 17], done);
    });

});
describe("Chunk Manager (chunk size 32 bytes, sequenceHeaderSize: 8 bytes ,signatureLength: 4 )\n", function () {

    var chunkManager;

    beforeEach(function () {
        chunkManager = new ChunkManager({
            chunkSize: 32,

            sequenceHeaderSize: 8,
            writeSequenceHeaderFunc: write_fake_sequence_header,

            signatureLength: 4,
            compute_signature: compute_fake_signature

        });
        chunkManager.chunkSize.should.equal(32);
        chunkManager.sequenceHeaderSize.should.equal(8);
        chunkManager.signatureLength.should.equal(4);
        chunkManager.maxBodySize.should.equal(20);
    });

    it("should transform a 32 bytes message into a chunk of 32 bytes and 24 bytes", function (done) {
        // C1 = [ 8 + 20 + 4] = 32
        // C2 = [ 8 + 12 + 4] = 24
        //           ----
        //            32
        perform_test(chunkManager, 32, [32, 24], done);
    });

    it("should transform a 33 bytes message into a chunk of 32 bytes and 25 bytes", function (done) {
        // C1 = [ 8 + 20 + 4] = 32
        // C2 = [ 8 + 13 + 4] = 25
        //           ----
        //            33
        perform_test(chunkManager, 33, [32, 25], done);
    });
});


describe("Chunk Manager Padding (chunk size 32 bytes, plainBlockSize 8 bytes ,cipherBlockSize 8 bytes )\n", function () {

    var chunkManager;

    beforeEach(function () {
        chunkManager = new ChunkManager({
            chunkSize: 32,


            plainBlockSize: 8,
            cipherBlockSize: 8,
            encrypt_buffer: no_encrypt_block,

            headerSize: 4,
            writeHeaderFunc: write_fake_header,

            sequenceHeaderSize: 2,
            writeSequenceHeaderFunc: write_fake_sequence_header,

            signatureLength: 4,
            compute_signature: compute_fake_signature
        });
        chunkManager.chunkSize.should.equal(32);
        chunkManager.maxBodySize.should.equal(17);
        chunkManager.compute_signature.should.equal(compute_fake_signature);

    });

    it("should transform a  1 bytes message into a single 12 bytes chunk", function (done) {
        //
        // +-------+---------------+---------------+-------------+-------+
        // |Header |SequenceHeader | data          | paddingByte | sign  |
        // +-------+---------------+---------------+-------------+-------+
        // |   4   |   2           |  1            | 1 +  0      |  4    |=> 4 +  ( 2+ 1 + (1 + 0) + 4 ) = 4 + 8
        // +-------+---------------+---------------+-------------+-------+
        perform_test(chunkManager, 1, [12], done);
    });

    it("should transform a  2 bytes message into a single 20 bytes chunk", function (done) {
        // +-------+---------------+---------------+-------------+-------+
        // |Header |SequenceHeader | data          | paddingByte | sign  |
        // +-------+---------------+---------------+-------------+-------+
        // |   4   |   2           |  2            | 1 + 7       |  4    | => 4 +  ( 2+ 2 + (1 + 7) + 4 ) = 4 + 16
        // +-------+---------------+---------------+-------------+-------+
        perform_test(chunkManager, 2, [20], done);
    });

    it("should transform a 10 bytes message into a single 28 bytes chunk", function (done) {
        // +-------+---------------+---------------+-------------+-------+
        // |Header |SequenceHeader | data          | paddingByte | sign  |
        // +-------+---------------+---------------+-------------+-------+
        // |   4   |   2           |  10            | 1 + 7       |  4    |
        // +-------+---------------+---------------+-------------+-------+
        //           ( 2 + 4 + 2 + 1+[p=7] ) % 8 = 0 !
        perform_test(chunkManager, 10, [28], done);
    });

    it("should transform a 32 bytes message into two 28 bytes chunks", function (done) {
        //
        // 1234567890123456890123456789012
        //       12345678901234567
        // HHHHSSDDDDDDDDDDDDDDDDDPSSSS
        //     --------++++++++--------
        // +-------+---------------+---------------+-------------+-------+
        // |Header |SequenceHeader | data          | paddingByte | sign  |
        // +-------+---------------+---------------+-------------+-------+
        // |   4   |   2           |  17           | 1 + 0       |  4    | => 4 +  ( 2+ 17 + 1 + 0 + 4 ) = 4 + 24 = 28
        // +-------+---------------+---------------+-------------+-------+                (%8=0!)
        // |   4   |   2           |  15           | 1 + 2       |  4    | => 4 +  ( 2+ 15 + 1 + 2 + 4)  = 28
        // +-------+---------------+---------------+-------------+-------+
        //                            32
        perform_test(chunkManager, 32, [28, 28], done);
    });

    it("should transform a 64 bytes message into four 28 bytes chunks ", function (done) {
        // +-------+---------------+---------------+-------------+-------+
        // |Header |SequenceHeader | data          | paddingByte | sign  |
        // +-------+---------------+---------------+-------------+-------+
        // |   4   |   2           |  17           | 1 + 0       |  4    | => 4 +  ( 2+ 17 + 1 + 0 + 4 ) = 4 + 24 = 28
        // +-------+---------------+---------------+-------------+-------+                (%8=0!)
        // |   4   |   2           |  17           | 1 + 0       |  4    | => 4 +  ( 2+ 17 + 1 + 0 + 4 ) = 4 + 24 = 28
        // +-------+---------------+---------------+-------------+-------+                (%8=0!)
        // |   4   |   2           |  17           | 1 + 0       |  4    | => 4 +  ( 2+ 17 + 1 + 0 + 4 ) = 4 + 24 = 28
        // +-------+---------------+---------------+-------------+-------+                (%8=0!)
        // |   4   |   2           |  13           | 1 + 0       |  4    | => 4 +  ( 2+ 15 + 1 + 2 + 4)  = 28
        // +-------+---------------+---------------+-------------+-------+
        //                            64
        perform_test(chunkManager, 64, [28, 28, 28, 28], done);
    });

    it("should transform a 16 bytes message into a single chunk ", function (done) {
        // +-------+---------------+---------------+-------------+-------+
        // |Header |SequenceHeader | data          | paddingByte | sign  |
        // +-------+---------------+---------------+-------------+-------+
        // |   4   |   2           |  16           | 1 + 1       |  4    | => 4 +  ( 2+ 16 + 1 + 1 + 4 ) = 4 + 24 = 28
        // +-------+---------------+---------------+-------------+-------+                (%8=0!)
        perform_test(chunkManager, 16, [28], done);
    });

    it("should transform a 17 bytes message into a single chunk ", function (done) {
        // +-------+---------------+---------------+-------------+-------+
        // |Header |SequenceHeader | data          | paddingByte | sign  |
        // +-------+---------------+---------------+-------------+-------+
        // |   4   |   2           |  17           | 1 + 0       |  4    | => 4 +  ( 2+ 17 + 1 + 0 + 4 ) = 4 + 24 = 28
        // +-------+---------------+---------------+-------------+-------+                (%8=0!)
        perform_test(chunkManager, 17, [28], done);
    });

    it("should transform a 35 bytes message into a  chunk of 32 bytes followed by a chunk of 8 bytes", function (done) {
        // +-------+---------------+---------------+-------------+-------+
        // |Header |SequenceHeader | data          | paddingByte | sign  |
        // +-------+---------------+---------------+-------------+-------+
        // |   4   |   2           |  17           | 1 + 0       |  4    | => 4 +  ( 2+ 17 + 1 + 0 + 4 ) = 4 + 24 = 28
        // +-------+---------------+---------------+-------------+-------+                (%8=0!)
        // |   4   |   2           |  17           | 1 + 0       |  4    | => 4 +  ( 2+ 17 + 1 + 0 + 4 ) = 4 + 24 = 28
        // +-------+---------------+---------------+-------------+-------+                (%8=0!)
        // |   4   |   2           |  1            | 1 +  0      |  4    |=> 4 +  ( 2+ 1 + (1 + 0) + 4 ) = 4 + 8  = 12
        // +-------+---------------+---------------+-------------+-------+
        perform_test(chunkManager, 35, [28, 28, 12], done);
    });

});


describe("Chunk Manager Padding (chunk size 32 bytes, plainBlockSize 6 bytes ,cipherBlockSize 8 bytes )\n", function () {

    var chunkManager;

    beforeEach(function () {

        chunkManager = new ChunkManager({
            chunkSize: 64,

            headerSize: 8,
            writeHeaderFunc: write_fake_header,

            sequenceHeaderSize: 8,
            writeSequenceHeaderFunc: write_fake_sequence_header,

            plainBlockSize: 6,
            cipherBlockSize: 8,
            encrypt_buffer: fake_encrypt_buffer,

            signatureLength: 4,
            compute_signature: compute_fake_signature
        });
        chunkManager.chunkSize.should.equal(64);
        chunkManager.maxBodySize.should.equal(29);
    });
    it("should transform a 1 byte message into a single chunk", function (done) {
        // +-------+---------------+---------------+-------------+-------+
        // |Header |SequenceHeader | data          | paddingByte | sign  |
        // +-------+---------------+---------------+-------------+-------+
        // |   8   |   8           |  1            | 1 +  0      |  4    |=> 8 +  ( 8 + 1 + (1 + 4) + 4 ) = 8 + 3*6
        // |       |               |               |             |       |   8 + 3*8 = 32
        // +-------+---------------+---------------+-------------+-------+
        var expected = [
            //0102030405060708 0910111213141516 17 1819202122 23242526
            //0102030405060708 0102030405060708 01 0102030405 01020304
            //aaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbb dd 0404040404 cccccccc"
            //0102030405060708091011121314151617181920212223242526272829303132
            "aaaaaaaaaaaaaaaaDEbbbbbbbbbbbbDFDEbbbb00040404DFDE0404ccccccccDF"
        ];
        perform_test(chunkManager, 1, expected, done);

    });
    it("should transform a 2 byte message into a single chunk", function (done) {
        var expected = [
            "aaaaaaaaaaaaaaaaDEbbbbbbbbbbbbDFDEbbbb00010303DFDE0303ccccccccDF"
        ];
        perform_test(chunkManager, 2, expected, done);
    });
    it("should transform a 3 byte message into a single chunk", function (done) {
        var expected = [
            "aaaaaaaaaaaaaaaaDEbbbbbbbbbbbbDFDEbbbb00010202DFDE0202ccccccccDF"
        ];
        perform_test(chunkManager, 3, expected, done);
    });
    it("should transform a 4 byte message into a single chunk", function (done) {
        var expected = [
            "aaaaaaaaaaaaaaaaDEbbbbbbbbbbbbDFDEbbbb00010203DFDE0101ccccccccDF"
        ];
        perform_test(chunkManager, 4, expected, done);
    });
    it("should transform a 5 byte message into a single chunk", function (done) {
        var expected = [
            "aaaaaaaaaaaaaaaaDEbbbbbbbbbbbbDFDEbbbb00010203DFDE0400ccccccccDF"
        ];
        perform_test(chunkManager, 5, expected, done);
    });
    it("should transform a 6 byte message into a single chunk", function (done) {
        var expected = [
            "aaaaaaaaaaaaaaaaDEbbbbbbbbbbbbDFDEbbbb00010203DFDE040505050505DFDE0505ccccccccDF"
        ];
        perform_test(chunkManager, 6, expected, done);
    });
    it("should transform a 29 byte message into a single chunk", function (done) {
        var expected = [
            "aaaaaaaaaaaaaaaa" + "DEbbbbbbbbbbbbDF" + "DEbbbb00010203DF" + "DE040506070809DF" + "DE0A0B0C0D0E0FDF" +
            "DE101112131415DF" + "DE161718191A1BDF" + "DE1C00ccccccccDF"];
        perform_test(chunkManager, 29, expected, done);
    });

    it("should transform a 30 byte message into a single chunk", function (done) {
        var expected = [
            "aaaaaaaaaaaaaaaa" + "DEbbbbbbbbbbbbDF" + "DEbbbb00010203DF" + "DE040506070809DF" + "DE0A0B0C0D0E0FDF" +
            "DE101112131415DF" + "DE161718191A1BDF" + "DE1C00ccccccccDF",
            "aaaaaaaaaaaaaaaa" + "DEbbbbbbbbbbbbDF" + "DEbbbb1d040404DF" + "DE0404ccccccccDF"
        ];
        perform_test(chunkManager, 30, expected, done);
    });

});




