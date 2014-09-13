var should = require("should");
var ChunkManager = require("../../lib/misc/chunk_manager").ChunkManager;

var util = require("util");


describe("Chunk manager",function(){

    it("should decompose a large single write in small chunks",function(){

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

    it("should decompose many small writes in small chunks",function(){

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

function  perform_test(chunkManager,packet_length,expected_chunk_lengths,done) {

    var chunk_counter =0;
    chunkManager.on("chunk",function(chunk,is_last){

        should(chunk).not.eql(null);

        chunk_counter.should.not.be.greaterThan(expected_chunk_lengths.length);

        chunk.length.should.eql(expected_chunk_lengths[chunk_counter]," testing chunk " + chunk_counter);

        chunk_counter+=1;
        if (chunk_counter === expected_chunk_lengths.length) {
            is_last.should.equal(true);
            done();
        } else {
            is_last.should.equal(false);
        }
    });

    var buf = new Buffer(packet_length);
    buf.length.should.eql(packet_length);
    for (var i=0;i<buf.length;i++) { buf.writeUInt8(i,i%256); }
    chunkManager.write(buf);
    chunkManager.end();

}


describe("Chunk Manager Padding (chunk size 32 bytes, padding 8 bytes)\n",function(){

    var chunkManager;

    beforeEach(function(){
        chunkManager= new ChunkManager(32,8);
        chunkManager.chunk_size.should.equal(32);
    });

    it("should transform a 32 bytes message into a single chunk of 32 bytes",function(done) {
        perform_test(chunkManager,32, [32],done);
    });
    it("should transform a 64 bytes message into a two chunks of 32 bytes",function(done) {
        perform_test(chunkManager,64, [32,32],done);
    });
    it("should transform a 10 bytes message into a single chunk of 16 bytes",function(done) {
        perform_test(chunkManager,10, [16],done);
    });
    it("should transform a 16 bytes message into a single chunk of 16 bytes",function(done) {
        perform_test(chunkManager,16, [16],done);
    });
    it("should transform a 17 bytes message into a single chunk of 8*3 bytes",function(done) {
        perform_test(chunkManager,17, [24],done);
    });
    it("should transform a 35 bytes message into a  chunk of 32 bytes followed by a chunk of 8 bytes",function(done) {
        perform_test(chunkManager,35,[32,8],done);
    });

});

describe("Chunk Manager Padding (chunk size 32 bytes, padding 8 bytes and header_size of 10 bytes)\n",function(){

    var chunkManager;

    beforeEach(function(){
        chunkManager= new ChunkManager(32, 8, 8 );
        chunkManager.chunk_size.should.equal(24);
    });

    it("should transform a 32 bytes message into a 32 byte chunk and 16 byte chunk ",function(done) {
        // 8 + 24 = 32  ( reste 8)
        // 8 + 8  = 16
        perform_test(chunkManager,32, [32,16],done);
    });

    it("should transform a 64 bytes message into a two 32 byte chunks and a 24 byte chunk",function(done) {
        // 8 + 24 = 32   | 24 40
        // 8 + 24 = 32   | 24 16
        // 8 + 16 = 24   | 16
        //                 ---
        //                 64
        perform_test(chunkManager,64, [32,32,24],done);
    });

    it("should transform a 10 bytes message into a single chunk of 16 bytes",function(done) {
        // 8 + 2 = 10 => %8 => 16
        perform_test(chunkManager,2, [16],done);
    });


    it("should transform a 10 bytes message into a single 24 byte chunk  ",function(done) {
        // 8 + 10 = 18 => %8 => 24
        perform_test(chunkManager,10, [24],done);
    });

    it("should transform a 16 bytes message into a single 16 byte chunk",function(done) {
        // 8 + 16 = 24
        perform_test(chunkManager,16, [24],done);
    });

    it("should transform a 17 bytes message into a single 24 byte chunk ",function(done) {
        // 8 + 17 = 25 -> 32
        perform_test(chunkManager,17, [32],done);
    });

});

