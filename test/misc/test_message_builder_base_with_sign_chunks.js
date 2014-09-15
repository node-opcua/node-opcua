var should = require("should");
var MessageBuilderBase = require("../../lib/misc/message_builder_base").MessageBuilderBase;
var compare_buffers = require("../../lib/misc/utils").compare_buffers;
var BinaryStream = require("../../lib/misc/binaryStream").BinaryStream;
var util = require("util");
var debugLog = require("../../lib/misc/utils").make_debugLog(__filename);
var hexDump = require("../../lib/misc/utils").hexDump;


var make_lorem_ipsum_buffer = require("../helpers/make_lorem_ipsum_buffer").make_lorem_ipsum_buffer;
var iterate_on_signed_message_chunks = require("../helpers/fake_message_chunk_factory").iterate_on_signed_message_chunks;
var verifyMessageChunkSignatureForTest = require("../helpers/signature_helpers").verifyMessageChunkSignatureForTest;

var MessageBuilderBase = require("../../lib/misc/message_builder_base").MessageBuilderBase;

describe("MessageBuilderBase with SIGN support", function () {

    var lorem_ipsum_buffer  = make_lorem_ipsum_buffer();


    it("should not emit  bad_signature event if chunks have valid signature", function (done) {

        var options = {
            verifySignatureFunc: verifyMessageChunkSignatureForTest,
            signatureSize: 128
        };

        var messageBuilderBase = new MessageBuilderBase(options);

        messageBuilderBase
            .on("full_message_body",function(message) {
                done();
            })
            .on("message",function(message){

            })
            .on("bad_signature", function (chunk) {

                done(new Error(" we are not expecting a bad_signature event in this case"));
            });

        iterate_on_signed_message_chunks(lorem_ipsum_buffer,function(err,chunk) {
            messageBuilderBase.feed(chunk.slice(0, 20));
            messageBuilderBase.feed(chunk.slice(20));
        });


    });

    it("should reconstruct a full message made of many signed chunks", function (done) {

        var options = {
            verifySignatureFunc: verifyMessageChunkSignatureForTest,
            signatureSize: 128
        };



        var messageBuilderBase = new MessageBuilderBase(options);

        messageBuilderBase
            .on("full_message_body",function(message) {

                debugLog(message.toString());
                message.toString().should.eql(lorem_ipsum_buffer.toString());

                done();
            })
            .on("chunk",function(chunk){
                debugLog(hexDump(chunk));
            })
            .on("message",function(message){
                // debugLog(hexDump(message));
            })
            .on("bad_signature", function (chunk) {

                done(new Error(" we are not expecting a bad_signature event in this case"));
            });

        iterate_on_signed_message_chunks(lorem_ipsum_buffer,function(err,chunk) {
            messageBuilderBase.feed(chunk.slice(0, 20));
            messageBuilderBase.feed(chunk.slice(20));
        });


    });
    it("should emit an bad_signature event if chunk has been tempered", function (done) {

        var options = {
            verifySignatureFunc: verifyMessageChunkSignatureForTest,
            signatureSize: 128
        };

        var messageBuilderBase = new MessageBuilderBase(options);

        messageBuilderBase
            .on("full_message_body",function(message) {
                done(new Error("it should not emmit a message event if a signature is invalid or missing"));
            })
            .on("message",function(message){
                done(new Error("it should not emmit a message event if a signature is invalid or missing"));
            })
            .on("bad_signature", function (chunk) {
                debugLog("this chunk has a altered body ( signature verification failed)".yellow);
                debugLog(hexDump(chunk));
                done();
            });

        iterate_on_signed_message_chunks(lorem_ipsum_buffer,function(err,chunk) {

            // alter artificially the chunk
            // this will damage the chunk signature

            chunk.write("####*** TEMPERED ***#####",57);


            messageBuilderBase.feed(chunk.slice(0, 20));
            messageBuilderBase.feed(chunk.slice(20));
        });

    });

});