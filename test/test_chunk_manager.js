var should = require("should");
var ChunkManager = require("../lib/chunk_manager").ChunkManager;
var MessageChunkManager = require("../lib/chunk_manager").MessageChunkManager;
var ChunkStream = require("../lib/chunk_manager").ChunkStream;

describe("Chunk manager",function(){

    it("should create a chunk_manager and decompose a large single write in small chunks",function(){

        var chunkManager = new ChunkManager(48);
        chunkManager.chunk_size.should.equal(48);

        var chunk_counter =0;
        chunkManager.on("chunk",function(chunk){

            if (chunk_counter < 2 ) {
                chunk.length.should.equal(48);
            } else {
                chunk.length.should.equal(48);
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
            chunk.length.should.equal(48);
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

describe("MessageChunkManager",function(){
   it("should split a message in chunk and produce a header.",function()
   {
       var msgChunkManager = new MessageChunkManager(48);
       var chunks = [];
       msgChunkManager.on("chunk",function(chunk){

           // keep a copy ..
           copy_chunk = new Buffer(chunk.length);
           chunk.copy(copy_chunk,0,0,chunk.length);
           chunks.push(copy_chunk);
           // console.log(" chunk "+ chunks.length + " " + copy_chunk.toString("hex"));
           chunk.length.should.equal(48);
       });

       // feed chunk-manager on byte at a time
       var n =(48-12)*4+12;
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


describe("using ChunkManager as stream with ChunkStream",function(){
    //
    //
    it("should pipe over a ChunkManager with ChunkStream",function(done){

        var r = require("stream").Readable();
        r.push("01234567890123456789012345678901234567890123456789012345678901234567890123");
        r.push(null);

        counter = 0;
        r.pipe(ChunkStream(new ChunkManager(10))).on("data",function(data) {
            data.length.should.equal(10);
            counter +=1;
        }).on("finish",function(){
            counter.should.equal(8);
            done();
        });
    });
    //
    //
    it("should pipe over a  MessageChunkManager with ChunkStream",function(done){

        var r = require("stream").Readable();
        r.push("01234567890123456789012345678901234567890123456789012345678901234567890123");
        r.push(null);

        counter = 0;
        r.pipe(ChunkStream(new MessageChunkManager(20,"HEL",0xBEEF))).on("data",function(data) {
            // console.log(" ",counter, " " , data.toString("ascii"));
            data.length.should.equal(20);
            counter +=1;
        }).on("finish",function(){
            counter.should.equal(10);
            done();
        });
    });
});


