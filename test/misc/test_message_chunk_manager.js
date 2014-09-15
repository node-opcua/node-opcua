var should = require("should");
var MessageChunkManager = require("../../lib/misc/message_chunk_manager").MessageChunkManager;


function performMessageChunkManagerTest(options) {

    options = options || {};

    var footerSize = options.footerSize ||0 ;   // 128 bytes for signature

    var chunk_size  = 32;    // 32 useful bytes
    var header_size = 12;    // 12 bytes for
    var body_size   = chunk_size  + header_size + footerSize;

    var msgChunkManager = new MessageChunkManager(body_size,"HEL",0xDEADBEEF,options);

    var chunks = [];

    var chunk_counter = 0;

    function collect_chunk(chunk) {
        var copy_chunk = new Buffer(chunk.length);
        chunk.copy(copy_chunk,0,0,chunk.length);

        // append the copy to our chunk collection
        chunks.push(copy_chunk);
    }
    msgChunkManager.on("chunk",function(chunk,final){

        collect_chunk(chunk);

        chunk_counter+=1;
        if (!final) {
            // all packets shall be 'chunk_size'  byte long, except last
            chunk.length.should.equal(body_size);

        } else {
            // last packet is smaller
            chunk.length.should.equal(  12 +/*padding*/  header_size + footerSize);
            chunk_counter.should.eql(5);
        }
    });

    // feed chunk-manager on byte at a time
    var n =(chunk_size)*4+12;

    var buf = new Buffer(1);
    for (var i=0;i<n;i+=1) {
        buf.writeUInt8(i%256,0);
        msgChunkManager.write(buf,1);
    }

    // write this single buffer
    msgChunkManager.end();

    chunks.length.should.equal(5);

    // checking final flags ...
    chunks.forEach(function(chunk) { chunk.slice(0,3).toString().should.eql("HEL"); });

    // check length
    chunks[0].slice(4,8).readUInt32LE(0).should.eql(body_size);
    chunks[1].slice(4,8).readUInt32LE(0).should.eql(body_size);
    chunks[2].slice(4,8).readUInt32LE(0).should.eql(body_size);
    chunks[3].slice(4,8).readUInt32LE(0).should.eql(body_size);
    chunks[4].slice(4,8).readUInt32LE(0).should.eql(12  + header_size + footerSize);

    // check final car
    chunks[0].readUInt8(3).should.equal("C".charCodeAt(0));
    chunks[1].readUInt8(3).should.equal("C".charCodeAt(0));
    chunks[2].readUInt8(3).should.equal("C".charCodeAt(0));
    chunks[3].readUInt8(3).should.equal("C".charCodeAt(0));
    chunks[4].readUInt8(3).should.equal("F".charCodeAt(0));

    if (options.verifyChunk) {
        chunks.forEach(options.verifyChunk);
    }

}


describe("MessageChunkManager",function() {


    it("should split a message in chunk and produce a header ( NO SIGN & NO ENCRYPT).",function() {

        performMessageChunkManagerTest(null);

    });

    it("should split a message in chunk and produce a header (  SIGN & NO ENCRYPT).",function(){


        var makeMessageChunkSignatureForTest = require("../helpers/signature_helpers").makeMessageChunkSignatureForTest;
        var verifyMessageChunkSignatureForTest = require("../helpers/signature_helpers").verifyMessageChunkSignatureForTest;

        var options = {
            footerSize: 128,
            signingFunc: makeMessageChunkSignatureForTest,
            verifyChunk: verifyMessageChunkSignatureForTest
        };

        performMessageChunkManagerTest(options);

    });


});

