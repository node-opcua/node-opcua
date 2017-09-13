"use strict";

var BinaryStream = require("..").BinaryStream; // node-opcua-binary-stream
var BinaryStreamSizeCalculator = require("..").BinaryStreamSizeCalculator;
var should = require("should");
var assert = require("node-opcua-assert");

var Benchmarker = require("node-opcua-benchmarker").Benchmarker;

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

    });
});


BinaryStream.prototype.writeArrayBuffer_old = function (arrayBuf, offset, length) {

    offset = offset || 0;

    //xx assert(arrayBuf instanceof ArrayBuffer);
    var byteArr = new Uint8Array(arrayBuf);
    var n = (length || byteArr.length) + offset;
    for (var i = offset; i < n; i++) {
        this._buffer[this.length++] = byteArr[i];
    }
};

BinaryStream.prototype.readArrayBuffer_old = function (length) {

    assert(this.length + length <= this._buffer.length, "not enough bytes in buffer");
    var slice = this._buffer.slice(this.length, this.length + length);
    assert(slice.length === length);
    var byteArr = new Uint8Array(slice);
    assert(byteArr.length === length);
    this.length += length;
    return byteArr;
};


describe("Testing BinaryStream#writeArrayBuffer /  BinaryStream#readArrayBuffer", function () {

    this.timeout(200000);


    var n = 1024 * 1024 + 3;
    var largeArray;
    beforeEach(function () {
        largeArray = new Float64Array(n);
        for (var i = 0; i < n; i++) {
            largeArray[i] = ( i * 0.14 );
        }
        largeArray[10].should.eql(10 * 0.14);
        largeArray[100].should.eql(100 * 0.14);
    });


    function isValidBuffer(buf) {
        if (buf.length !== n) {
            return false;
        }
        for (var i = 0; i < buf.length; i++) {
            if (buf[i] !== i * 0.14) {
                return false;
            }
        }
        return true;
    }

    it("should provide a working writeArrayBuffer", function () {

        function perform(binStream_writeArrayBuffer, binStream_readArrayBuffer) {

            largeArray[10].should.eql(10 * 0.14);
            largeArray[100].should.eql(100 * 0.14);
            var binStream = new BinaryStream(new Buffer(n * 8 + 20));

            largeArray.length.should.eql(n);
            largeArray.byteLength.should.eql(n * 8);

            binStream_writeArrayBuffer.call(binStream, largeArray.buffer, 0, largeArray.byteLength);
            //xx console.log(binStream._buffer.slice(0,100).toString("hex"));

            binStream.rewind();
            var arr = binStream_readArrayBuffer.call(binStream, largeArray.byteLength);
            arr.length.should.eql(largeArray.byteLength);
            var reloaded = new Float64Array(arr.buffer);

            reloaded.length.should.eql(largeArray.length);

            reloaded[10].should.eql(10 * 0.14);
            reloaded[100].should.eql(100 * 0.14);
            isValidBuffer(reloaded, largeArray).should.eql(true);
        }

        perform(BinaryStream.prototype.writeArrayBuffer, BinaryStream.prototype.readArrayBuffer);

        perform(BinaryStream.prototype.writeArrayBuffer_old, BinaryStream.prototype.readArrayBuffer_old);

    });

    it("should provide a efficient writeArrayBuffer", function () {

        var binStream1 = new BinaryStream(new Buffer(n * 8 + 20));
        var binStream2 = new BinaryStream(new Buffer(n * 8 + 20));

        largeArray.byteLength.should.eql(n * 8);
        var bench = new Benchmarker();
        bench
            .add("writeArrayBuffer (old version with byte copy)", function () {
                binStream1.rewind();
                binStream1.writeArrayBuffer_old(largeArray.buffer, 0, largeArray.byteLength);
            })
            .add("writeArrayBuffer", function () {
                binStream2.rewind();
                binStream2.writeArrayBuffer(largeArray.buffer, 0, largeArray.byteLength);
            })
            .on('cycle', function (message) {
                console.log(message);
            })
            .on('complete', function () {

                console.log(' Fastest is ' + this.fastest.name);
                console.log(' Speed Up : x', this.speedUp);
                //xx this.fastest.name.should.eql("Variant.encode");

            })
            .run({max_time: 0.2});
    });

    it("should provide a efficient readArrayBuffer", function () {

        var binStream1 = new BinaryStream(new Buffer(n * 8 + 20));
        binStream1.writeArrayBuffer(largeArray.buffer, 0, largeArray.byteLength);

        var binStream2 = new BinaryStream(new Buffer(n * 8 + 20));
        binStream2.writeArrayBuffer(largeArray.buffer, 0, largeArray.byteLength);

        largeArray.byteLength.should.eql(n * 8);

        var bench = new Benchmarker();
        bench
            .add("readArrayBuffer_old (old version with byte copy)", function () {
                binStream1.rewind();
                var arr = binStream1.readArrayBuffer_old(largeArray.byteLength);
                isValidBuffer(new Float64Array(arr.buffer), largeArray).should.eql(true);
            })
            .add("readArrayBuffer", function () {
                binStream2.rewind();
                var arr = binStream2.readArrayBuffer(largeArray.byteLength);
                isValidBuffer(new Float64Array(arr.buffer), largeArray).should.eql(true);
            })
            .on('cycle', function (message) {
                console.log(message);
            })
            .on('complete', function () {

                console.log(' Fastest is ' + this.fastest.name);
                console.log(' Speed Up : x', this.speedUp);
                //xx this.fastest.name.should.eql("Variant.encode");

            })
            .run({max_time: 0.2});
    });

    it("round trip", function () {

        var binStream1 = new BinaryStream(new Buffer(n * 8 + 20));
        binStream1.writeArrayBuffer(largeArray.buffer, 0, largeArray.byteLength);

        var binStream2 = new BinaryStream(new Buffer(n * 8 + 20));
        binStream2.writeArrayBuffer(largeArray.buffer, 0, largeArray.byteLength);

        largeArray.byteLength.should.eql(n * 8);

        var bench = new Benchmarker();
        bench
            .add("writeArrayBuffer_old/readArrayBuffer_old (old version with byte copy)", function () {
                binStream1.rewind();
                binStream1.writeArrayBuffer_old(largeArray.buffer, 0, largeArray.byteLength);
                binStream1.rewind();
                var arr = binStream1.readArrayBuffer_old(largeArray.byteLength);
                isValidBuffer(new Float64Array(arr.buffer), largeArray).should.eql(true);
            })
            .add("writeArrayBuffer/readArrayBuffer", function () {
                binStream2.rewind();
                binStream2.writeArrayBuffer(largeArray.buffer, 0, largeArray.byteLength);
                binStream2.rewind();
                var arr = binStream2.readArrayBuffer(largeArray.byteLength);
                isValidBuffer(new Float64Array(arr.buffer), largeArray).should.eql(true);
            })
            .on('cycle', function (message) {
                console.log(message);
            })
            .on('complete', function () {

                console.log(' Fastest is ' + this.fastest.name);
                console.log(' Speed Up : x', this.speedUp);
                //xx this.fastest.name.should.eql("Variant.encode");
                largeArray.byteLength.should.eql(n * 8);

            })
            .run({max_time: 0.2});
    });
});
