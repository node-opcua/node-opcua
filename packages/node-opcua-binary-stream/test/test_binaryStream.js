"use strict";

const BinaryStream = require("..").BinaryStream; // node-opcua-binary-stream
const BinaryStreamSizeCalculator = require("..").BinaryStreamSizeCalculator;
const should = require("should");
const assert = require("node-opcua-assert").assert;

const Benchmarker = require("node-opcua-benchmarker").Benchmarker;

describe("Testing BinaryStream", function () {


    it("should create a binary stream", function () {


        const stream = new BinaryStream();
        stream.length.should.equal(0);

        stream.writeDouble(10.00234);
        stream.length.should.equal(8);

        stream.writeInteger(100000);
        stream.length.should.equal(12);

        stream.rewind();
        stream.length.should.equal(0);

        const f = stream.readDouble();
        f.should.equal(10.00234);
        stream.length.should.equal(8);

        const i = stream.readInteger();
        i.should.equal(100000);
        stream.length.should.equal(12);


    });

    it("readArrayBuffer should not returned a shared buffer", function () {

        const stream = new BinaryStream(50);

        const arr = new Int16Array(25);
        for (let i=0;i<25;i++) { arr[i] = 512+i; }

         console.log((new Uint8Array(arr.buffer)).join(" "));
        stream.writeArrayBuffer(arr.buffer)

        // let's verify that a copy has been made
        // changing written array shall not affect innder buffer

        stream._buffer[2*3].should.eql(3);
        stream._buffer[2*3]= 33;

        arr[3].should.not.eql(33);
        arr[3].should.eql(512+3);
        stream._buffer[2*3]= 3;

        stream.rewind();
        const arr2 = new Int16Array(stream.readArrayBuffer(50).buffer);
        console.log((new Uint8Array(arr2.buffer)).join(" "));

        arr2.should.be.instanceof(Int16Array);
        arr2.length.should.eql(25);
        arr2.byteLength.should.eql(50);

        arr2[3].should.eql(512+3);

        stream._buffer[2*3].should.eql(3);
        stream._buffer[2*3]= 33;
        arr2[3].should.not.eql(33);
        arr2[3].should.eql(512+3);
        stream._buffer[2*3]= 3;


    });

});

describe("Testing BinaryStreamSizeCalculator", function () {

    it("should calculate the right size", function () {

        const stream = new BinaryStreamSizeCalculator();
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
    const byteArr = new Uint8Array(arrayBuf);
    const n = (length || byteArr.length) + offset;
    for (let i = offset; i < n; i++) {
        this._buffer[this.length++] = byteArr[i];
    }
};

BinaryStream.prototype.readArrayBuffer_old = function (length) {

    assert(this.length + length <= this._buffer.length, "not enough bytes in buffer");
    const slice = this._buffer.slice(this.length, this.length + length);
    assert(slice.length === length);
    const byteArr = new Uint8Array(slice);
    assert(byteArr.length === length);
    this.length += length;
    return byteArr;
};
BinaryStream.prototype.readArrayBuffer1 = function (length) {

    //var result = new Uint8Array(this._buffer, this.length, length);
    // returns a new Buffer that shares the same allocated memory as the given ArrayBuffer.
    const result = Buffer.from(this._buffer.buffer, this.length, length);
    this.length += length;
    return Buffer.from(result);
}

BinaryStream.prototype.readArrayBuffer2 = function (length) {
    const slice = this._buffer.slice(this.length, this.length + length);
    this.length += length;
    return Buffer.from(slice);

}
BinaryStream.prototype.readArrayBuffer3 = function (length) {
    //xx assert(this.length + length <= this._buffer.length, "not enough bytes in buffer");
    const slice = this._buffer.slice(this.length, this.length + length);
    //xx  assert(slice.length === length);
    const byteArr = new Uint8Array(slice);
    assert(byteArr.length === length);
    this.length += length;
    return byteArr;
};


describe("Testing BinaryStream#writeArrayBuffer /  BinaryStream#readArrayBuffer", function () {

    this.timeout(200000);


    const n = 1024 * 1024 + 3;
    let largeArray;
    beforeEach(function () {
        largeArray = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            largeArray[i] = (i * 0.14);
        }
        largeArray[10].should.eql(10 * 0.14);
        largeArray[100].should.eql(100 * 0.14);

        (largeArray.byteLength % 8).should.eql(0);
    });


    function isValidBuffer(buf) {
        if (buf.length !== n) {
            return false;
        }
        for (let i = 0; i < buf.length; i++) {
            if (buf[i] !== i * 0.14) {
                return false;
            }
        }
        return true;
    }

    function perform(binStream_writeArrayBuffer, binStream_readArrayBuffer) {

        largeArray[10].should.eql(10 * 0.14);
        largeArray[100].should.eql(100 * 0.14);
        const binStream = new BinaryStream(new Buffer(n * 8 + 20));

        largeArray.length.should.eql(n);
        largeArray.byteLength.should.eql(n * 8);

        binStream_writeArrayBuffer.call(binStream, largeArray.buffer, 0, largeArray.byteLength);
        //xx console.log(binStream._buffer.slice(0,100).toString("hex"));

        binStream.rewind();
        const arr = binStream_readArrayBuffer.call(binStream, largeArray.byteLength);
        arr.length.should.eql(largeArray.byteLength);
        const reloaded = new Float64Array(arr.buffer);

        reloaded.length.should.eql(largeArray.length);

        reloaded[10].should.eql(10 * 0.14);
        reloaded[100].should.eql(100 * 0.14);
        isValidBuffer(reloaded, largeArray).should.eql(true);
    }
    it("should provide a working writeArrayBuffer", function () {

        perform(BinaryStream.prototype.writeArrayBuffer, BinaryStream.prototype.readArrayBuffer);
    });
    it("should provide a working writeArrayBuffer_old", function () {

        perform(BinaryStream.prototype.writeArrayBuffer_old, BinaryStream.prototype.readArrayBuffer_old);

    });

    it("should provide a efficient writeArrayBuffer", function () {

        const binStream1 = new BinaryStream(new Buffer(n * 8 + 20));
        const binStream2 = new BinaryStream(new Buffer(n * 8 + 20));

        largeArray.byteLength.should.eql(n * 8);
        const bench = new Benchmarker();
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

        const binStream1 = new BinaryStream(new Buffer(n * 8 + 20));
        binStream1.writeArrayBuffer(largeArray.buffer, 0, largeArray.byteLength);

        //var binStream2 = new BinaryStream(new Buffer(n * 8 + 20));
        //binStream2.writeArrayBuffer(largeArray.buffer, 0, largeArray.byteLength);

        largeArray.byteLength.should.eql(n * 8);

        const bench = new Benchmarker();
        bench
            .add("readArrayBuffer_old (old version with byte copy)", function () {
                binStream1.rewind();
                const arr = binStream1.readArrayBuffer_old(largeArray.byteLength);
                isValidBuffer(new Float64Array(arr.buffer), largeArray).should.eql(true);
            })
            .add("readArrayBuffer1", function () {
                binStream1.rewind();
                const arr = binStream1.readArrayBuffer1(largeArray.byteLength);
                isValidBuffer(new Float64Array(arr.buffer), largeArray).should.eql(true);
            })
            .add("readArrayBuffer2", function () {
                binStream1.rewind();
                const arr = binStream1.readArrayBuffer2(largeArray.byteLength);
                isValidBuffer(new Float64Array(arr.buffer), largeArray).should.eql(true);
            })
            .add("readArrayBuffer3", function () {
                binStream1.rewind();
                const arr = binStream1.readArrayBuffer3(largeArray.byteLength);
                isValidBuffer(new Float64Array(arr.buffer), largeArray).should.eql(true);
            })
            .add("readArrayBuffer", function () {
                binStream1.rewind();
                const arr = binStream1.readArrayBuffer(largeArray.byteLength);
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

        largeArray.byteLength.should.eql(n * 8);

        const binStream1 = new BinaryStream(new Buffer(n * 8 + 20));
        binStream1.writeArrayBuffer(largeArray.buffer, 0, largeArray.byteLength);

        const bench = new Benchmarker();
        bench
            .add("writeArrayBuffer_old/readArrayBuffer_old (old version with byte copy)", function () {
                binStream1.rewind();
                binStream1.writeArrayBuffer_old(largeArray.buffer, 0, largeArray.byteLength);
                binStream1.rewind();
                const arr = binStream1.readArrayBuffer_old(largeArray.byteLength);
                isValidBuffer(new Float64Array(arr.buffer), largeArray).should.eql(true);
            })
            .add("writeArrayBuffer/readArrayBuffer", function () {
                binStream1.rewind();
                binStream1.writeArrayBuffer(largeArray.buffer, 0, largeArray.byteLength);
                binStream1.rewind();
                const arr = binStream1.readArrayBuffer(largeArray.byteLength);

                binStream1.length.should.eql(largeArray.byteLength);
                arr.should.be.instanceOf(Uint8Array);
                arr.length.should.eql(arr.byteLength);
                arr.length.should.eql(largeArray.byteLength,"byteLength should match");
                (arr.length %8).should.eql(0,"must be a multiple of 8");

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
