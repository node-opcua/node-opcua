var should = require("should");
var ChunkManager = require("../lib/chunck_manager").ChunkManager;
var MessageChunkManager = require("../lib/chunck_manager").MessageChunkManager;

describe("Chunk manager",function(){

    it("should create a chunk_manager and decompose a large single write in small chunks",function(){

        var chunkManager = new ChunkManager(48);
        chunkManager.chunk_size.should.equal(48);

        var chunk_counter =0;
        chunkManager.on("chunk",function(chunk){

            if (chunk_counter < 2 ) {
                chunk.length.should.equal(48);
            } else {
                chunk.length.should.equal(12);
            }
            console.log(" chunk "+ chunk_counter + " " + chunk.toString("hex"));
            chunk_counter +=1;
        });

        // create a large buffer ( 2.3 time bigger than chunksize)
        var n =48*2+12;
        var buf = new Buffer(n);
        for (var i=0;i<n;i+=1) { buf.writeInt8(i,i); }

        // write this single buffer
        chunkManager.write(buf,buf.length);
        chunkManager.eof();

        chunk_counter.should.equal(3);

    });


    it("should create a chunk_manager and decompose many small writes in small chunks",function(){

        var chunkManager = new ChunkManager(48);
        chunkManager.chunk_size.should.equal(48);

        var chunk_counter =0;
        chunkManager.on("chunk",function(chunk){

            console.log(" chunk "+ chunk_counter + " " + chunk.toString("hex"));
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
        chunkManager.eof();

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

           console.log(" chunk "+ chunks.length + " " + copy_chunk.toString("hex"));
       });

       // feed chunk-manager on byte at a time
       var n =(48-12)*4+12;
       var buf = new Buffer(1);
       for (var i=0;i<n;i+=1) {
           buf.writeUInt8(i%256,0);
           msgChunkManager.write(buf,1);
       }

       // write this single buffer
       msgChunkManager.eof();

       chunks.length.should.equal(5);

       // checking final flags ...
       chunks[0].readUInt8(3).should.equal("C".charCodeAt(0));
       chunks[1].readUInt8(3).should.equal("C".charCodeAt(0));
       chunks[2].readUInt8(3).should.equal("C".charCodeAt(0));
       chunks[3].readUInt8(3).should.equal("C".charCodeAt(0));
       chunks[4].readUInt8(3).should.equal("F".charCodeAt(0));

   });
});



