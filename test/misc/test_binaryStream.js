var BinaryStream = require("../../lib/misc/binaryStream").BinaryStream;
var BinaryStreamSizeCalculator = require("../../lib/misc/binaryStream").BinaryStreamSizeCalculator;
var should = require("should");


describe("Testing BinaryStream", function () {


    it("should create a binary stream", function () {


        var stream = new BinaryStream();
        stream.length.should.equal(0);

        stream.writeDouble(10.00234);
        stream.length.should.equal(8);

        stream.writeInteger(100000);
        stream.length.should.equal(12);

        stream.rewind();
        stream.length.should.equal(0);

        var f = stream.readDouble();
        f.should.equal(10.00234);
        stream.length.should.equal(8);

        var i = stream.readInteger();
        i.should.equal(100000);
        stream.length.should.equal(12);


    });

});

describe("Testing BinaryStreamSizeCalculator", function () {

    it("should calculate the right size", function () {

        var stream = new BinaryStreamSizeCalculator();
        stream.writeFloat(10.00234);
        stream.writeInteger(100000);
        stream.writeDouble(100000.0);
        stream.writeByteStream(new Buffer("Hello"));
        stream.length.should.equal(4 + 4 + 8 + 4 + 5);

    })
});

