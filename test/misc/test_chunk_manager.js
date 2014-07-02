var should = require("should");
var ChunkManager = require("../../lib/misc/chunk_manager").ChunkManager;
var MessageChunkManager = require("../../lib/misc/chunk_manager").MessageChunkManager;

var ChunkStream = require("../../lib/misc/chunk_manager").chunkStream;

var util = require("util");


describe("Chunk manager",function(){

    it("should create a chunk_manager and decompose a large single write in small chunks",function(){

        var chunkManager = new ChunkManager(48);
        chunkManager.chunk_size.should.equal(48);

        var chunk_counter =0;
        chunkManager.on("chunk",function(chunk){

            if (chunk_counter < 2 ) {
                // all packets shall be 48 byte long, except last
                chunk.length.should.equal(48);
            } else {
                // last packet is smaller
                chunk.length.should.equal(12);
            }
            //console.log(" chunk "+ chunk_counter + " " + chunk.toString("hex"));
            chunk_counter +=1;
        });

        // create a large buffer ( 2.3 time bigger than chunksize)
        var n =48*2+12;
        var buf = new Buffer(n);
        for (var i=0;i<n;i+=1) { buf.writeInt8(i,i); }

        // write this single buffer
        chunkManager.write(buf,buf.length);
        chunkManager.end();

        chunk_counter.should.equal(3);

    });


    it("should create a chunk_manager and decompose many small writes in small chunks",function(){

        var chunkManager = new ChunkManager(48);
        chunkManager.chunk_size.should.equal(48);

        var chunk_counter =0;
        chunkManager.on("chunk",function(chunk){
            // console.log(" chunk "+ chunk_counter + " " + chunk.toString("hex"));
            if (chunk_counter < 2 ) {
                // all packets shall be 48 byte long, except last
                chunk.length.should.equal(48);
            } else {
                // last packet is smaller
                chunk.length.should.equal(12);
            }
            chunk_counter +=1;
        });

        // feed chunk-manager on byte at a time
        var n =48*2+12;
        var buf = new Buffer(1);
        for (var i=0;i<n;i+=1) {
            buf.writeInt8(i,0);
            chunkManager.write(buf,1);
        }

        // write this single buffer
        chunkManager.end();

        chunk_counter.should.equal(3);

    });
});


describe("MessageChunkManager",function() {


   it("should split a message in chunk and produce a header.",function()
   {
       var chunk_size  = 48;
       var header_size = 12;
       var body_size   = chunk_size -header_size;


       var msgChunkManager = new MessageChunkManager(chunk_size);

       var chunks = [];

       var chunk_counter = 0;

       msgChunkManager.on("chunk",function(chunk){

           // keep a copy ..
           var copy_chunk = new Buffer(chunk.length);
           chunk.copy(copy_chunk,0,0,chunk.length);
           chunks.push(copy_chunk);
           if (chunk_counter < 4 ) {
               // all packets shall be 'chunk_size'  byte long, except last
               chunk.length.should.equal(chunk_size);
           } else {
               // last packet is smaller
               chunk.length.should.equal(12+header_size);
           }
           chunk_counter+=1;
       });

       // feed chunk-manager on byte at a time

       var n =body_size*4+12;

       var buf = new Buffer(1);
       for (var i=0;i<n;i+=1) {
           buf.writeUInt8(i%256,0);
           msgChunkManager.write(buf,1);
       }

       // write this single buffer
       msgChunkManager.end();

       chunks.length.should.equal(5);

       // checking final flags ...
       chunks[0].readUInt8(3).should.equal("C".charCodeAt(0));
       chunks[1].readUInt8(3).should.equal("C".charCodeAt(0));
       chunks[2].readUInt8(3).should.equal("C".charCodeAt(0));
       chunks[3].readUInt8(3).should.equal("C".charCodeAt(0));
       chunks[4].readUInt8(3).should.equal("F".charCodeAt(0));

   });

});

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



describe("using ChunkManager as stream with chunkStream",function(){
    //
    //
    it("should pipe over a ChunkManager with chunkStream",function(done){

        var r = require("stream").Readable();
        r.push("01234567890123456789012345678901234567890123456789012345678901234567890123");
        r.push(null);


        var counter = 0;
        r.pipe(ChunkStream(new ChunkManager(10))).on("data",function(data) {
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

        var r = require("stream").Readable();
        r.push("01234567890123456789012345678901234567890123456789012345678901234567890123");
        r.push(null);

        var counter = 0;
        r.pipe(ChunkStream(new MessageChunkManager(20,"HEL",0xBEEF))).on("data",function(data) {
            // console.log(" ",counter, " " , data.toString("ascii"));
            data.length.should.lessThan(20+1);
            counter +=1;
        }).on("finish",function(){
            counter.should.equal(10);
            done();
        });
    });

    it("should not alter a very large binary block",function(done){

        var original_message_body = message_body_fixture();

        var builder = new MessageBuilderBase();

        builder.on("full_message_body",function(full_message_body) {
            compare_buffers(full_message_body,original_message_body,original_message_body.length);
            done();
        });

        var block_size = 80;
        var counter = 0;
        var r = new BinaryStreamReader(original_message_body);

        r.pipe(ChunkStream(new MessageChunkManager(block_size,"HEL",0xBEEF))).on("data",function(data) {

            data.length.should.lessThan(block_size+1);
            counter +=data.length;
            builder.feed(data);

        }).on("finish",function(){
                // counter.should.equal(buf.length+block_size-(buf.length)%block_size);
        });
    });
});

