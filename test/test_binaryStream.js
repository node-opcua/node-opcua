var BinaryStream2 = require("../lib/binaryStream").BinaryStream2;
var BinaryStream = require("../lib/binaryStream").BinaryStream;
var BinaryReader = require("../lib/binaryStream").BinaryReader;


var fs=require("fs");


describe("binaryStream",function() {
    it("should create a binary stream",function(){

        var binStream = new BinaryStream(48);

        binStream.writeFloat(10.00234);
        binStream.writeInteger(100000);
        binStream._buffer.write("HelloWorld",8);
        // binStream.end();

        var binReader = new BinaryReader(binStream._buffer);

        binReader.pipe(fs.createWriteStream("tmp/output.bin","binary"));

        var r = new require("stream").Readable();
        r.push("Hello World");
        r.push(null);
        r.pipe(fs.createWriteStream("tmp/output2.bin","binary"));

    });

});