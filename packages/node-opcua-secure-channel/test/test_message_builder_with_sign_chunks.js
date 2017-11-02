"use strict";
var should = require("should");
var colors = require("colors");

var debugLog = require("node-opcua-debug").make_debugLog(__filename);
var hexDump = require("node-opcua-debug").hexDump;

var make_lorem_ipsum_buffer = require("node-opcua-test-helpers").make_lorem_ipsum_buffer;
var fake_message_chunk_factory = require("../test_helpers/fake_message_chunk_factory");

var MessageBuilder = require("../src/message_builder").MessageBuilder;
var SecurityPolicy = require("../src/security_policy").SecurityPolicy;
var MessageSecurityMode = require("node-opcua-service-secure-channel").MessageSecurityMode;

var crypto_utils = require("node-opcua-crypto").crypto_utils;

var getFixture = require("node-opcua-test-fixtures").getFixture;


var private_key_filename = getFixture("certs/server_key_1024.pem");


describe("MessageBuilder with SIGN support", function () {

    var lorem_ipsum_buffer = make_lorem_ipsum_buffer();

    it("should not emit an error event if chunks have valid signature", function (done) {

        var options = {};

        var messageBuilder = new MessageBuilder(options);
        messageBuilder.privateKey = crypto_utils.read_private_rsa_key(private_key_filename);
        messageBuilder._decode_message_body = false;

        messageBuilder
        .on("full_message_body", function (message) {
            done();
        })
        .on("message", function (message) {

        })
        .on("error", function (error) {
            done(error);
        });

        fake_message_chunk_factory.iterate_on_signed_message_chunks(lorem_ipsum_buffer, function (err, chunk) {
            should(err).eql(null);
            messageBuilder.feed(chunk.slice(0, 20));
            messageBuilder.feed(chunk.slice(20));
        });

    });

    it("should reconstruct a full message made of many signed chunks", function (done) {

        var options = {};

        var messageBuilder = new MessageBuilder(options);
        messageBuilder.setSecurity('SIGN', 'Basic128Rsa15');

        messageBuilder._decode_message_body = false;

        messageBuilder.on("full_message_body", function (message) {

            debugLog(message.toString());
            message.toString().should.eql(lorem_ipsum_buffer.toString());

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

        fake_message_chunk_factory.iterate_on_signed_message_chunks(lorem_ipsum_buffer, function (err, chunk) {
            should(err).eql(null);
            messageBuilder.feed(chunk.slice(0, 20));
            messageBuilder.feed(chunk.slice(20));
        });


    });
    it("should emit an bad_signature event if chunk has been tempered", function (done) {

        var options = {};

        var messageBuilder = new MessageBuilder(options);
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
            debugLog("this chunk has a altered body ( signature verification failed)".yellow);
            //xx debugLog(hexDump(chunk));
            done();
        });

        fake_message_chunk_factory.iterate_on_signed_message_chunks(lorem_ipsum_buffer, function (err, chunk) {
            should(err).eql(null);

            // alter artificially the chunk
            // this will damage the chunk signature
            chunk.write("####*** TEMPERED ***#####", 0x3a0);

            messageBuilder.feed(chunk.slice(0, 20));
            messageBuilder.feed(chunk.slice(20));
        });

    });

});


describe("MessageBuilder with SIGN & ENCRYPT support (OPN) ", function () {

    var lorem_ipsum_buffer = make_lorem_ipsum_buffer();

    it("should not emit an error event with valid SIGN & ENCRYPT chunks", function (done) {

        var options = {};

        var messageBuilder = new MessageBuilder(options);
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

        fake_message_chunk_factory.iterate_on_signed_and_encrypted_message_chunks(lorem_ipsum_buffer, function (err, chunk) {
            should(err).eql(null);
            //xx console.log(hexDump(chunk));
            messageBuilder.feed(chunk.slice(0, 20));
            messageBuilder.feed(chunk.slice(20));
        });

    });
});


describe("MessageBuilder with SIGN & ENCRYPT support (MSG) ", function () {

    var lorem_ipsum_buffer = make_lorem_ipsum_buffer();

    it("should process a signed and encrypted message", function (done) {
        var options = {};
        var messageBuilder = new MessageBuilder(options);
        messageBuilder._decode_message_body = false;

        messageBuilder.securityPolicy = SecurityPolicy.Basic128Rsa15;

        messageBuilder.privateKey = crypto_utils.read_private_rsa_key(private_key_filename);

        messageBuilder.securityMode = MessageSecurityMode.SIGNANDENCRYPT;

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


        fake_message_chunk_factory.iterate_on_symmetric_encrypted_chunk(lorem_ipsum_buffer, function (err, chunk) {
            should(err).eql(null);
            messageBuilder.feed(chunk);
        });
    });
});

