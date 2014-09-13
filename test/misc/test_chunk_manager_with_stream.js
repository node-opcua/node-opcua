var should = require("should");
var ChunkManager = require("../../lib/misc/chunk_manager").ChunkManager;

var MessageChunkManager = require("../../lib/misc/message_chunk_manager").MessageChunkManager;


var util = require("util");


var MessageBuilderBase = require("../../lib/misc/message_builder_base").MessageBuilderBase;
var compare_buffers = require("../../lib/misc/utils").compare_buffers;

var Readable = require("stream").Readable;
function BinaryStreamReader(buf,opt) {
    Readable.call(this, opt);
    this._buffer = buf;
}
util.inherits(BinaryStreamReader, Readable);

BinaryStreamReader.prototype._read = function() {
    this.push(this._buffer);
    this._buffer = null;
};


function message_body_fixture() {
    var original_message_body = new Buffer(8 * 256);
    for (var i = 0; i < original_message_body.length; i += 4) {
        original_message_body.writeUInt32LE(i / 4, i);
    }
    return original_message_body;
}


var through = require("through2");

var chunkStream = function (chunkManager) {

    var cm = chunkManager;
    var tr = through(function (chunk, enc, next) {
        cm.write(chunk, chunk.length);
        next();
    }, function () {
        cm.end();
    });
    cm.on("chunk", function (chunk) {
        tr.push(chunk);
    });
    return tr;
};

describe("using ChunkManager as stream with chunkStream",function(){
    //
    //
    it("should pipe over a ChunkManager with chunkStream",function(done){

        var footer_size = 128;

        var r = require("stream").Readable();
        r.push("01234567890123456789012345678901234567890123456789012345678901234567890123");
        r.push(null);


        var counter = 0;
        r.pipe(chunkStream(new ChunkManager(10,0,0,0))).on("data",function(data) {
            data.length.should.be.lessThan(10+1);
            if (counter < 7) {
                data.toString("ascii").should.eql("0123456789");
            } else {
                data.slice(0,4).toString("ascii").should.eql("0123");
            }
            counter +=1;
        }).on("finish",function(){
            counter.should.equal(8);
            done();
        });
    });
    //
    //
    it("should pipe over a  MessageChunkManager with chunkStream",function(done){


        var footer_size = 0;

        var r = require("stream").Readable();
        r.push("01234567890123456789012345678901234567890123456789012345678901234567890123");
        r.push(null);

        var counter = 0;
        r.pipe(chunkStream(new MessageChunkManager(20 + footer_size,"HEL",0xBEEF))).on("data",function(data) {
            // console.log(" ",counter, " " , data.toString("ascii"));
            data.length.should.lessThan(20+1+ footer_size);
            counter +=1;
        }).on("finish",function(){
            counter.should.equal(10);
            done();
        });
    });

    it("should not alter a very large binary block",function(done){

        var footer_size = 0;

        var original_message_body = message_body_fixture();

        var builder = new MessageBuilderBase();

        builder.on("full_message_body",function(full_message_body) {
            compare_buffers(full_message_body,original_message_body,original_message_body.length);
            done();
        });

        var block_size = 80 + footer_size;
        var counter = 0;
        var r = new BinaryStreamReader(original_message_body);

        r.pipe(chunkStream(new MessageChunkManager(block_size,"HEL",0xBEEF))).on("data",function(data) {

            data.length.should.lessThan(block_size+1);
            counter +=data.length;
            builder.feed(data);

        }).on("finish",function(){
            // counter.should.equal(buf.length+block_size-(buf.length)%block_size);
        });
    });
});

