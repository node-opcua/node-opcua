
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
                        chunk_stack.push(clone_buffer(messageChunk));
                    } else {
                        fullBufferForVerif = secure_channel.fullbuf;
                        callback();
                    }
                });
            },

            function (callback) {
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

});