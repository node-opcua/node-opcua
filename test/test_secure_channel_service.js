
var should = require("should");
var secure_channel = require("../lib/secure_channel_service");
var MessageBuilder = require("../lib/message_builder").MessageBuilder;

var s = require("../lib/structures");
var async = require("async");
var util = require("util");


var compare_buffers = require("./../lib/utils").compare_buffers;


var debugLog  = require("../lib/utils").make_debugLog(__filename);

var clone_buffer = secure_channel.clone_buffer;
var MessageChunker = secure_channel.MessageChunker;

describe("SecureMessageChunkManager",function(){

    it("should reconstruct a valid message when message is received in multiple chunks",function(done){

        // a very large endPointResponse spanning on multiple chunks ...
        var endPointResponse = require("./fixture_GetEndPointResponse").fixture2;

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
                chunker.chunkSecureMessage("MSG",options,endPointResponse,function(messageChunk) {
                    if (messageChunk) {
                        chunk_stack.push(clone_buffer(messageChunk));
                    } else {
                        fullBufferForVerif = secure_channel.fullbuf;
                        callback();
                    }
                });
            },

            function (callback) {
                // let verify that each intermediate chunk is marked with "C" and final chunk is marked with "F"
                for (var i = 0; i<chunk_stack.length -1;i++) {
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
                messageBuilder.on("raw_buffer",function(buffer){
                    compare_buffers(fullBufferForVerif,buffer,40);

                }).on("message",function(message) {
                    //xx console.log("message = ", util.inspect(message));
                    message.should.eql(endPointResponse);
                    // check also that requestId has been properly installed by chunkSecureMessage

                    callback();
                }).on("error",function(errCode){
                    callback(new Error("Error : code 0x"+ errCode.toString(16)));
                });

                // feed messageBuilder with
                chunk_stack.forEach(function(chunk){

                    // let simulate a real TCP communication
                    // where our messageChunk would be split into several packages....

                    var l1 = Math.round(chunk.length/3); // arbitrarily split into 2 packets : 1/3 and 2/3

                    // just for testing the ability to reassemble data block
                    var data1 = chunk.slice(0,l1);
                    var data2 = chunk.slice(l1);

                    messageBuilder.feed(data1);
                    messageBuilder.feed(data2);

                });
            }
        ],done);

    });

    it("should receive an ERR message",function(done){


        var messageBuilder = new MessageBuilder();

        messageBuilder.on("raw_buffer",function(buffer){
                debugLog(" On raw Buffer \n" );
                debugLog(require("../lib/utils").hexDump(buffer));

        }).on("message",function(message) {
                debugLog(" message ", message);
                done();
        }).on("error",function(errCode){
                debugLog(" errCode ", errCode);
                done();
        });

        var makebuffer_from_trace = require("./makebuffer_from_trace").makebuffer_from_trace;

        var packet =makebuffer_from_trace(function(){
/*
 00000000: 4d 53 47 46 64 00 00 00 0c 00 00 00 01 00 00 00 04 00 00 00 03 00 00 00 01 00 8d 01 00 00 00 00    MSGFd...........................
 00000020: 00 00 00 00 00 00 00 00 00 00 82 80 24 00 00 00 00 00 00 00 80 01 00 00 00 24 00 00 00 55 6e 65    ............$............$...Une
 00000040: 78 70 65 63 74 65 64 20 65 72 72 6f 72 20 70 72 6f 63 65 73 73 69 6e 67 20 72 65 71 75 65 73 74    xpected.error.processing.request
 00000060: 2e 00 00 00                                                                                        ....
*/
        });
        messageBuilder.feed(packet);

    });


});