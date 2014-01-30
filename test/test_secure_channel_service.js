
var should = require("should");
var secure_channel = require("../lib/secure_channel_service");
var s = require("../lib/structures");
var async = require("async");
var util = require("util");


var buffer_ellipsis = require("./../lib/utils").buffer_ellipsis;
var chunk_ellipsis  = require("./../lib/utils").chunk_ellipsis;
var compare_buffers = require("./../lib/utils").compare_buffers;



var clone_buffer = secure_channel.clone_buffer;

describe("SecureMessageChunkManager",function(){

    it("should produce a valid message",function(done){

        // a very large endPointResponse spanning on multiple chunks ...
        var endPointResponse = require("./fixture_GetEndPointResponse").fixture2;

        var requestId = 0x1000;

        var chunk_stack = [];

        var fullBufferForVerif = null;

        async.series([

            function (callback) {
                secure_channel.chunkSecureMessage("MSG",{ requestId: requestId},endPointResponse,function(messageChunk) {
                    if (messageChunk) {

                        // messageChunk.length.should.equal(1024);
                        //xx console.log("received : ",chunk_ellipsis(messageChunk,79));
                        chunk_stack.push(clone_buffer(messageChunk));

                    } else {
                        fullBufferForVerif = secure_channel.fullbuf;
                        callback();
                    }
                });
            },

            function (callback) {
                // chunk_stack.length.should.equal(7);
                for (var i = 0; i<chunk_stack.length -1;i++) {
                    String.fromCharCode(chunk_stack[i].readUInt8(3)).should.equal("C");
                }
                String.fromCharCode(chunk_stack[i].readUInt8(3)).should.equal("F");
                callback();
            },

            function (callback) {

                // now apply the opposite operation by reconstructing the message from chunk and
                // decoding the inner object

                // console.log(" message Builder");
                var messageBuilder = new secure_channel.MessageBuilder();
                messageBuilder.on("raw_buffer",function(buffer){
                    compare_buffers(fullBufferForVerif,buffer,40);
                });

                messageBuilder.on("message",function(message) {
                    //xx console.log("message = ", util.inspect(message));
                    message.should.eql(endPointResponse);
                    callback();
                }).on("error",function(errCode){
                    callback(new Error("Error"));
                });

                // feed messageBuilder with
                chunk_stack.forEach(function(chunk){  messageBuilder.feed(chunk); });
            }
        ],done);

    });

});