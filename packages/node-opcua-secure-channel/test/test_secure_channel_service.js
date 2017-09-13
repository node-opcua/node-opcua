"use strict";
/* global describe,it*/
var should = require("should");
var async = require("async");

var secure_channel = require("node-opcua-service-secure-channel");
var CloseSecureChannelResponse = secure_channel.CloseSecureChannelResponse;

var MessageBuilder = require("../src/message_builder").MessageBuilder;



var compare_buffers = require("node-opcua-utils").compare_buffers;
var clone_buffer = require("node-opcua-buffer-utils").clone_buffer;
var hexDump = require("node-opcua-debug").hexDump;

var debugLog = require("node-opcua-debug").make_debugLog(__filename);


var MessageChunker = require("../src/message_chunker").MessageChunker;

describe("SecureMessageChunkManager", function () {

    it("should reconstruct a valid message when message is received in multiple chunks", function (done) {

        // a very large endPointResponse spanning on multiple chunks ...
        var endPointResponse = require("../test_fixtures/fixture_GetEndPointResponse").fixture2;

        var requestId = 0x1000;

        var chunk_stack = [];

        var fullBufferForVerif = null;

        async.series([

            function (callback) {

                var options = {
                    requestId: requestId,
                    tokenId: 1
                };
                endPointResponse.responseHeader.requestHandle = requestId;

                var chunker = new MessageChunker();
                chunker.chunkSecureMessage("MSG", options, endPointResponse, function (messageChunk) {
                    if (messageChunk) {
                        chunk_stack.push(clone_buffer(messageChunk));
                    } else {
                        fullBufferForVerif = clone_buffer(chunker._stream._buffer);
                        callback();
                    }
                });
            },

            function (callback) {

                chunk_stack.length.should.be.greaterThan(0);

                // let verify that each intermediate chunk is marked with "C" and final chunk is marked with "F"
                for (var i = 0; i < chunk_stack.length - 1; i++) {
                    String.fromCharCode(chunk_stack[i].readUInt8(3)).should.equal("C");
                }
                String.fromCharCode(chunk_stack[i].readUInt8(3)).should.equal("F");
                callback();
            },

            function (callback) {

                chunk_stack.length.should.be.greaterThan(0);

                // now apply the opposite operation by reconstructing the message from chunk and
                // decoding the inner object

                // console.log(" message Builder");
                var messageBuilder = new MessageBuilder();
                messageBuilder.on("full_message_body", function (full_message_body) {
                    compare_buffers(fullBufferForVerif, full_message_body, 40);

                }).on("message", function (reconstructed_message) {

                    // message has been fully reconstructed here :
                    // check that the reconstructed message equal the original_message

                    //xx console.log("message = ", util.inspect(reconstructed_message, {colors: true,depth: 10}));
                    //xx console.log("origianm= ",  util.inspect(endPointResponse, {colors: true,depth: 10}));

                    reconstructed_message.should.eql(endPointResponse);
                    // check also that requestId has been properly installed by chunkSecureMessage

                    callback();
                }).on("error", function (errCode) {
                    callback(new Error("Error : code 0x" + errCode.toString(16)));
                });

                // feed messageBuilder with
                chunk_stack.forEach(function (chunk) {

                    // let simulate a real TCP communication
                    // where our messageChunk would be split into several packages ...

                    var l1 = Math.round(chunk.length / 3); // arbitrarily split into 2 packets : 1/3 and 2/3

                    // just for testing the ability to reassemble data block
                    var data1 = chunk.slice(0, l1);
                    var data2 = chunk.slice(l1);

                    messageBuilder.feed(data1);
                    messageBuilder.feed(data2);

                });
            }
        ], done);

    });

    it("should receive and handle an ERR message", function (done) {


        var messageBuilder = new MessageBuilder();

        messageBuilder.on("full_message_body", function (full_message_body) {
            debugLog(" On raw Buffer \n");
            debugLog(hexDump(full_message_body));

        }).on("message", function (message) {
            debugLog(" message ", message);

            message.responseHeader.serviceResult.value.should.eql(0x80820000);

            done();
        }).on("error", function (errCode) {
            debugLog(" errCode ", errCode);
            should.fail();
            done(new Error("Unexpected error event received"));
        });

        var makebuffer_from_trace = require("node-opcua-debug").makebuffer_from_trace;

        var packet = makebuffer_from_trace(function () {
            /*
             00000000: 4d 53 47 46 64 00 00 00 0c 00 00 00 01 00 00 00 04 00 00 00 03 00 00 00 01 00 8d 01 00 00 00 00    MSGFd...........................
             00000020: 00 00 00 00 00 00 00 00 00 00 82 80 24 00 00 00 00 00 00 00 80 01 00 00 00 24 00 00 00 55 6e 65    ............$............$...Une
             00000040: 78 70 65 63 74 65 64 20 65 72 72 6f 72 20 70 72 6f 63 65 73 73 69 6e 67 20 72 65 71 75 65 73 74    xpected.error.processing.request
             00000060: 2e 00 00 00                                                                                        ....
             */
        });
        messageBuilder.feed(packet);

    });
    it("should test CloseSecureChannelResponse", function () {
        var encode_decode_round_trip_test = require("node-opcua-packet-analyzer/test_helpers/encode_decode_round_trip_test").encode_decode_round_trip_test
        var response = new CloseSecureChannelResponse({});
        encode_decode_round_trip_test(response);

    });

});
