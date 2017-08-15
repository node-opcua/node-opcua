"use strict";
var util = require("util");

var MessageBuilderBase = require("../src/message_builder_base").MessageBuilderBase;
var writeTCPMessageHeader = require("../src/tools").writeTCPMessageHeader;

var compare_buffers = require("node-opcua-utils").compare_buffers;


var BinaryStream = require("node-opcua-binary-stream").BinaryStream;


function wrap_message_in_chunk(slice, isFinal) {
    var total_length = slice.length + 12;
    var buf = new Buffer(total_length);
    var stream = new BinaryStream(buf);
    writeTCPMessageHeader("MSG", isFinal, total_length, stream);
    slice.copy(buf, 12);
    return buf;
}

describe("MessageBuilderBase", function () {

    it('should assemble a message body composed of a single chunk ', function (done) {

        var message_body = new Buffer("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
        var original_message_chunk = wrap_message_in_chunk(message_body, "F");

        var builder = new MessageBuilderBase();

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

        var message_body = new Buffer("ABCDEFGHIJKLMNOPQRSTUVWXYZ");

        var original_message_chunk_1 = wrap_message_in_chunk(message_body.slice(0, 10), "C");
        var original_message_chunk_2 = wrap_message_in_chunk(message_body.slice(10), "F");

        var builder = new MessageBuilderBase();

        builder.on("full_message_body", function (full_message_body) {
            compare_buffers(full_message_body, message_body, message_body.length);
            done();
        });

        var expected = [
            original_message_chunk_1,
            original_message_chunk_2
        ];
        var expected_count = 0;
        builder.on("chunk", function (message_chunk) {
            var expected_chunk = expected[expected_count];
            expected_count += 1;
            compare_buffers(message_chunk, expected_chunk, expected_chunk.length);
        });

        builder.feed(original_message_chunk_1);
        builder.feed(original_message_chunk_2);

    });
});


