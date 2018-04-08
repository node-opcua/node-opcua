"use strict";
const util = require("util");

const MessageBuilderBase = require("../src/message_builder_base").MessageBuilderBase;
const writeTCPMessageHeader = require("../src/tools").writeTCPMessageHeader;

const compare_buffers = require("node-opcua-utils").compare_buffers;


const BinaryStream = require("node-opcua-binary-stream").BinaryStream;


function wrap_message_in_chunk(slice, isFinal) {
    const total_length = slice.length + 12;
    const buf = new Buffer(total_length);
    const stream = new BinaryStream(buf);
    writeTCPMessageHeader("MSG", isFinal, total_length, stream);
    slice.copy(buf, 12);
    return buf;
}

describe("MessageBuilderBase", function () {

    it('should assemble a message body composed of a single chunk ', function (done) {

        const message_body = new Buffer("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
        const original_message_chunk = wrap_message_in_chunk(message_body, "F");

        const builder = new MessageBuilderBase();

        builder.on("full_message_body", function (full_message_body) {
            compare_buffers(full_message_body, message_body, message_body.length);
            done();
        });

        builder.on("chunk", function (message_chunk) {
            compare_buffers(message_chunk, original_message_chunk, original_message_chunk.length);
        });

        builder.feed(original_message_chunk);

    });

    it('should assemble a message body composed of a two chunks ', function (done) {

        const message_body = new Buffer("ABCDEFGHIJKLMNOPQRSTUVWXYZ");

        const original_message_chunk_1 = wrap_message_in_chunk(message_body.slice(0, 10), "C");
        const original_message_chunk_2 = wrap_message_in_chunk(message_body.slice(10), "F");

        const builder = new MessageBuilderBase();

        builder.on("full_message_body", function (full_message_body) {
            compare_buffers(full_message_body, message_body, message_body.length);
            done();
        });

        const expected = [
            original_message_chunk_1,
            original_message_chunk_2
        ];
        let expected_count = 0;
        builder.on("chunk", function (message_chunk) {
            const expected_chunk = expected[expected_count];
            expected_count += 1;
            compare_buffers(message_chunk, expected_chunk, expected_chunk.length);
        });

        builder.feed(original_message_chunk_1);
        builder.feed(original_message_chunk_2);

    });
});


