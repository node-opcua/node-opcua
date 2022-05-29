"use strict";
const sinon = require("sinon");

const { BinaryStream } = require("node-opcua-binary-stream");
const { compare_buffers } = require("node-opcua-utils");

const { MessageBuilderBase, writeTCPMessageHeader } = require("..");

function wrap_message_in_chunk(slice, isFinal) {
    const total_length = slice.length + 12;
    const buf = Buffer.allocUnsafe(total_length);
    const stream = new BinaryStream(buf);
    writeTCPMessageHeader("MSG", isFinal, total_length, stream);
    slice.copy(buf, 12);
    return buf;
}

describe("MessageBuilderBase", function () {
    it("should assemble a message body composed of a single chunk ", function (done) {
        const message_body = Buffer.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
        const original_message_chunk = wrap_message_in_chunk(message_body, "F");

        const builder = new MessageBuilderBase();

        builder.on("full_message_body", function (full_message_body) {
            compare_buffers(full_message_body, message_body, message_body.length);
            done();
        });

        builder.on("chunk", (message_chunk) => {
            compare_buffers(message_chunk, original_message_chunk, original_message_chunk.length);
        });

        builder.feed(original_message_chunk);
    });

    it("should assemble a message body composed of a two chunks ", function (done) {
        const message_body = Buffer.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");

        const original_message_chunk_1 = wrap_message_in_chunk(message_body.slice(0, 10), "C");
        const original_message_chunk_2 = wrap_message_in_chunk(message_body.slice(10), "F");

        const builder = new MessageBuilderBase();

        builder.on("full_message_body", function (full_message_body) {
            compare_buffers(full_message_body, message_body, message_body.length);
            done();
        });

        const expected = [original_message_chunk_1, original_message_chunk_2];
        let expected_count = 0;
        builder.on("chunk", (message_chunk) => {
            const expected_chunk = expected[expected_count];
            expected_count += 1;
            compare_buffers(message_chunk, expected_chunk, expected_chunk.length);
        });

        builder.feed(original_message_chunk_1);
        builder.feed(original_message_chunk_2);
    });

    it("should not allow more chunks that maxChunkCount ", function (done) {

        const builder = new MessageBuilderBase({
            maxChunkCount: 5,
            maxMessageSize: 64 * 1024,
        });

        const onChunkSpy = sinon.spy();
        builder.on("chunk", onChunkSpy);

        const onFullMessageBodySpy = sinon.spy();
        builder.on("full_message_body", onFullMessageBodySpy);

        const onErrorSpy = sinon.spy();
        builder.on("error", onErrorSpy);

        const message_body = Buffer.alloc(16 * 1024);
        const chunk1 = wrap_message_in_chunk(message_body.slice(0 * 1024, 1 * 1024), "C");
        const chunk2 = wrap_message_in_chunk(message_body.slice(1 * 1024, 2 * 1024), "C");
        const chunk3 = wrap_message_in_chunk(message_body.slice(2 * 1024, 3 * 1024), "C");
        const chunk4 = wrap_message_in_chunk(message_body.slice(3 * 1024, 4 * 1024), "C");
        const chunk5 = wrap_message_in_chunk(message_body.slice(4 * 1024, 5 * 1024), "C");
        const chunk6 = wrap_message_in_chunk(message_body.slice(5 * 1024, 6 * 1024), "C");
        const chunk7 = wrap_message_in_chunk(message_body.slice(6 * 1024, 7 * 1024), "F");

        builder.feed(chunk1);
        builder.feed(chunk2);
        builder.feed(chunk3);
        builder.feed(chunk4);
        builder.feed(chunk5);
        builder.feed(chunk6);
        builder.feed(chunk7);

        onChunkSpy.callCount.should.eql(6);
        onErrorSpy.callCount.should.eql(1);
        onFullMessageBodySpy.callCount.should.eql(0);

        onErrorSpy.getCall(0).args[0].should.match(/max chunk count exceeded/);

        done();

    });
    it("should not allow message bigger than maxMessageSize ", function (done) {

        const builder = new MessageBuilderBase({
            maxChunkCount:  1000,
            maxMessageSize: 4 * 1024,
        });

        const onChunkSpy = sinon.spy();
        builder.on("chunk", onChunkSpy);

        const onFullMessageBodySpy = sinon.spy();
        builder.on("full_message_body", onFullMessageBodySpy);

        const onErrorSpy = sinon.spy();
        builder.on("error", onErrorSpy);

        const message_body = Buffer.alloc(16 * 1024);
        const chunk1 = wrap_message_in_chunk(message_body.slice(0 * 1024, 1 * 1024), "C");
        const chunk2 = wrap_message_in_chunk(message_body.slice(1 * 1024, 2 * 1024), "C");
        const chunk3 = wrap_message_in_chunk(message_body.slice(2 * 1024, 3 * 1024), "C");
        const chunk4 = wrap_message_in_chunk(message_body.slice(3 * 1024, 4 * 1024), "C");
        const chunk5 = wrap_message_in_chunk(message_body.slice(4 * 1024, 5 * 1024), "C");
        const chunk6 = wrap_message_in_chunk(message_body.slice(5 * 1024, 6 * 1024), "C");
        const chunk7 = wrap_message_in_chunk(message_body.slice(6 * 1024, 7 * 1024), "F");

        builder.feed(chunk1);
        builder.feed(chunk2);
        builder.feed(chunk3);
        builder.feed(chunk4);
        builder.feed(chunk5);
        builder.feed(chunk6);
        builder.feed(chunk7);

        onChunkSpy.callCount.should.eql(4);
        onErrorSpy.callCount.should.eql(1);
        onFullMessageBodySpy.callCount.should.eql(0);

        onErrorSpy.getCall(0).args[0].should.match(/maxMessageSize/);
        
        done();

    });
});
