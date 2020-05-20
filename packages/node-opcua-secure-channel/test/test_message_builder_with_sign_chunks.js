"use strict";
const should = require("should");
const chalk = require("chalk");

const debugLog = require("node-opcua-debug").make_debugLog(__filename);
const hexDump = require("node-opcua-debug").hexDump;
const MessageSecurityMode = require("node-opcua-service-secure-channel").MessageSecurityMode;
const crypto_utils = require("node-opcua-crypto");

const make_lorem_ipsum_buffer = require("node-opcua-test-helpers").make_lorem_ipsum_buffer;

const fake_message_chunk_factory = require("../dist/test_helpers/fake_message_chunk_factory");

const { MessageBuilder, SecurityPolicy } = require("..");
const { getFixture } = require("node-opcua-test-fixtures");


const private_key_filename = getFixture("certs/server_key_1024.pem");


describe("MessageBuilder with SIGN support", function () {

    const someBuffer = make_lorem_ipsum_buffer();

    it("should not emit an error event if chunks have valid signature", function (done) {

        const options = {};

        const messageBuilder = new MessageBuilder(options);
        messageBuilder.privateKey = crypto_utils.read_private_rsa_key(private_key_filename);

        messageBuilder._decodeMessageBody = false;

        messageBuilder
        .on("full_message_body", function (message) {
            done();
        })
        .on("message", function (message) {

        })
        .on("error", function (error) {
            done(error);
        });

        fake_message_chunk_factory.iterateOnSignedMessageChunks(someBuffer, function (err, chunk) {
            should.not.exist(err);
            messageBuilder.feed(chunk.slice(0, 20));
            messageBuilder.feed(chunk.slice(20));
        });

    });

    it("should reconstruct a full message made of many signed chunks", function (done) {

        const options = {};

        const messageBuilder = new MessageBuilder(options);
        messageBuilder.setSecurity(MessageSecurityMode.Sign, SecurityPolicy.Basic128Rsa15);

        messageBuilder._decode_message_body = false;

        messageBuilder.on("full_message_body", function (message) {

            debugLog(message.toString());
            message.toString().should.eql(someBuffer.toString());

            done();
        })
        .on("chunk", function (chunk) {
            debugLog(hexDump(chunk));
        })
        .on("message", function (message) {
            debugLog(hexDump(message));
        })
        .on("error", function (err) {

            done(new Error(" we are not expecting a error event in this case" + err));
        });

        fake_message_chunk_factory.iterateOnSignedMessageChunks(someBuffer, function (err, chunk) {
            should.not.exist(err);
            messageBuilder.feed(chunk.slice(0, 20));
            messageBuilder.feed(chunk.slice(20));
        });


    });
    it("should emit an bad_signature event if chunk has been tempered", function (done) {

        const options = {};

        const messageBuilder = new MessageBuilder(options);
        messageBuilder._decode_message_body = false;

        messageBuilder
        .on("full_message_body", function (message) {
            done(new Error("it should not emit a message event if a signature is invalid or missing"));
        })
        .on("message", function (message) {
            done(new Error("it should not emit a message event if a signature is invalid or missing"));
        })
        .on("error", function (err) {
            debugLog(err);
            debugLog(chalk.yellow("this chunk has a altered body ( signature verification failed)"));
            //xx debugLog(hexDump(chunk));
            done();
        });

        fake_message_chunk_factory.iterateOnSignedMessageChunks(someBuffer, function (err, chunk) {
            should.not.exist(err);

            // alter artificially the chunk
            // this will damage the chunk signature
            chunk.write("####*** TEMPERED ***#####", 0x3a0);

            messageBuilder.feed(chunk.slice(0, 20));
            messageBuilder.feed(chunk.slice(20));
        });

    });

});


describe("MessageBuilder with SIGN & ENCRYPT support (OPN) ", function () {

    const lorem_ipsum_buffer = make_lorem_ipsum_buffer();

    it("should not emit an error event with valid SIGN & ENCRYPT chunks", function (done) {

        const options = {};

        const messageBuilder = new MessageBuilder(options);
        messageBuilder.privateKey = crypto_utils.read_private_rsa_key(private_key_filename);
        messageBuilder._decode_message_body = false;

        messageBuilder
        .on("full_message_body", function (message) {
            message.toString().should.eql(lorem_ipsum_buffer.toString());
            done();
        })
        .on("message", function (message) {

        })
        .on("error", function (error) {
            done(error);
        });

        fake_message_chunk_factory.iterateOnSignedAndEncryptedMessageChunks(lorem_ipsum_buffer, function (err, chunk) {
            should.not.exist(err);
            //xx console.log(hexDump(chunk));
            messageBuilder.feed(chunk.slice(0, 20));
            messageBuilder.feed(chunk.slice(20));
        });

    });
});


describe("MessageBuilder with SIGN & ENCRYPT support (MSG) ", function () {

    const lorem_ipsum_buffer = make_lorem_ipsum_buffer();

    it("should process a signed and encrypted message", function (done) {
        const options = {};
        const messageBuilder = new MessageBuilder(options);
        messageBuilder._decode_message_body = false;

        messageBuilder.securityPolicy = SecurityPolicy.Basic128Rsa15;

        messageBuilder.privateKey = crypto_utils.read_private_rsa_key(private_key_filename);

        messageBuilder.securityMode = MessageSecurityMode.SignAndEncrypt;

        messageBuilder.pushNewToken({tokenId: 10}, fake_message_chunk_factory.derivedKeys);

        messageBuilder
        .on("full_message_body", function (message) {
            //xx console.log(hexDump(message));
            message.toString().should.eql(lorem_ipsum_buffer.toString());
            done();
        })
        .on("message", function (message) {

        })
        .on("error", function (error) {
            done(error);
        });


        fake_message_chunk_factory.iterateOnSymmetricEncryptedChunk(lorem_ipsum_buffer, function (err, chunk) {
            should.not.exist(err);
            messageBuilder.feed(chunk);
        });
    });
});

