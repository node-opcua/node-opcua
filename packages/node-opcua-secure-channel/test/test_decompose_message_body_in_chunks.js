"use strict";

var should = require("should");
var assert = require("node-opcua-assert");
var SequenceNumberGenerator = require("../src/sequence_number_generator").SequenceNumberGenerator;
var SecureMessageChunkManager = require("../src/secure_message_chunk_manager").SecureMessageChunkManager;

/**
 * @method decompose_message_body_in_chunks
 *
 * @param message_body
 * @param msgType
 * @param chunkSize
 * @return {Array}
 *
 * wrap a message body into one or more message_chunks
 * (  use this method to build fake data blocks in tests)
 */
function decompose_message_body_in_chunks(message_body, msgType, chunkSize) {

    assert(chunkSize > 24, "expecting chunkSize");
    assert(msgType.length === 3, " invalid msgType " + msgType);
    assert(message_body instanceof Buffer && message_body.length > 0, " invalid buffer");

    var sequenceNumberGenerator = new SequenceNumberGenerator();

    var options = {
        secureChannelId: 10,
        requestId: 36
    };

    var msgChunkManager = new SecureMessageChunkManager(msgType, options, null, sequenceNumberGenerator);
    var chunks = [];
    msgChunkManager.on("chunk", function (chunk) {
        if (chunk) {
            assert(chunk.length > 0);
            chunks.push(chunk);
        }
    });
    msgChunkManager.write(message_body);
    msgChunkManager.end();
    assert(chunks.length > 0, "decompose_message_body_in_chunks: must produce at least one chunk");
    return chunks;
}

describe("decompose message body in chunks", function () {

    it("should decompose a message body in at least one chunk ", function () {
        var message_body = new Buffer("At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis");

        var chunks = decompose_message_body_in_chunks(message_body, "MSG", 128);
        chunks.length.should.be.greaterThan(0);

    });
});


