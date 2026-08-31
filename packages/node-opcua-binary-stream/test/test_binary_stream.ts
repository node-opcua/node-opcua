import { assert } from "node-opcua-assert";
import { Benchmarker } from "node-opcua-benchmarker";
import { BinaryStream, BinaryStreamSizeCalculator, calculateByteLength } from "../dist/index.js"; // node-opcua-binary-stream
import "should";

// this suite compares the current implementation against earlier ones, which it installs on
// the prototype under alternative names
interface BinaryStreamWithBenchmarkVariants extends BinaryStream {
    writeArrayBuffer_old(arrayBuf: ArrayBuffer, offset?: number, length?: number): void;
    readArrayBuffer_old(length: number): Uint8Array;
    readArrayBuffer1(length: number): Buffer;
    readArrayBuffer2(length: number): Buffer;
    readArrayBuffer3(length: number): Uint8Array;
}
type WriteArrayBufferFn = (this: BinaryStream, arrayBuf: ArrayBuffer, offset?: number, length?: number) => void;
type ReadArrayBufferFn = (this: BinaryStream, length: number) => Uint8Array;

const benchmarkPrototype = BinaryStream.prototype as BinaryStreamWithBenchmarkVariants;

describe("Testing BinaryStream", () => {
    it("should create a binary stream", () => {
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

    it("readArrayBuffer should not returned a shared buffer", () => {
        const stream = new BinaryStream(50);

        const arr = new Int16Array(25);
        for (let i = 0; i < 25; i++) {
            arr[i] = 512 + i;
        }

        // xx console.log((new Uint8Array(arr.buffer)).join(" "));
        stream.writeArrayBuffer(arr.buffer);

        // let's verify that a copy has been made
        // changing written array shall not affect inner buffer

        stream.buffer[2 * 3].should.eql(3);
        stream.buffer[2 * 3] = 33;

        arr[3].should.not.eql(33);
        arr[3].should.eql(512 + 3);
        stream.buffer[2 * 3] = 3;

        stream.rewind();
        const arr2 = new Int16Array(stream.readArrayBuffer(50).buffer);
        // xx console.log((new Uint8Array(arr2.buffer)).join(" "));

        arr2.should.be.instanceof(Int16Array);
        arr2.length.should.eql(25);
        arr2.byteLength.should.eql(50);

        arr2[3].should.eql(512 + 3);

        stream.buffer[2 * 3].should.eql(3);
        stream.buffer[2 * 3] = 33;
        arr2[3].should.not.eql(33);
        arr2[3].should.eql(512 + 3);
        stream.buffer[2 * 3] = 3;
    });
});

describe("Testing BinaryStreamSizeCalculator", () => {
    it("should calculate the right size", () => {
        const stream = new BinaryStreamSizeCalculator();
        stream.writeFloat(10.00234);
        stream.writeInteger(100000);
        stream.writeDouble(100000.0);
        stream.writeByteStream(Buffer.from("Hello"));
        stream.length.should.equal(4 + 4 + 8 + 4 + 5);
    });
});

benchmarkPrototype.writeArrayBuffer_old = function (this: BinaryStream, arrayBuf: ArrayBuffer, offset?: number, length?: number) {
    offset = offset || 0;

    //xx assert(arrayBuf instanceof ArrayBuffer);
    const byteArr = new Uint8Array(arrayBuf);
    const n = (length || byteArr.length) + offset;
    for (let i = offset; i < n; i++) {
        this.buffer[this.length++] = byteArr[i];
    }
};

benchmarkPrototype.readArrayBuffer_old = function (this: BinaryStream, length: number) {
    assert(this.length + length <= this.buffer.length, "not enough bytes in buffer");
    const slice = this.buffer.slice(this.length, this.length + length);
    assert(slice.length === length);
    const byteArr = new Uint8Array(slice);
    assert(byteArr.length === length);
    this.length += length;
    return byteArr;
};
benchmarkPrototype.readArrayBuffer1 = function (this: BinaryStream, length: number) {
    //var result = new Uint8Array(this.buffer, this.length, length);
    // returns a new Buffer that shares the same allocated memory as the given ArrayBuffer.
    const result = Buffer.from(this.buffer.buffer, this.length, length);
    this.length += length;
    return Buffer.from(result);
};

benchmarkPrototype.readArrayBuffer2 = function (this: BinaryStream, length: number) {
    const slice = this.buffer.slice(this.length, this.length + length);
    this.length += length;
    return Buffer.from(slice);
};
benchmarkPrototype.readArrayBuffer3 = function (this: BinaryStream, length: number) {
    //xx assert(this.length + length <= this.buffer.length, "not enough bytes in buffer");
    const slice = this.buffer.slice(this.length, this.length + length);
    //xx  assert(slice.length === length);
    const byteArr = new Uint8Array(slice);
    assert(byteArr.length === length);
    this.length += length;
    return byteArr;
};

describe("Testing BinaryStream#writeArrayBuffer /  BinaryStream#readArrayBuffer", function () {
    this.timeout(200000);

    const n = 1024 * 1024 + 3;
    let largeArray: Float64Array<ArrayBuffer>;
    beforeEach(() => {
        largeArray = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            largeArray[i] = i * 0.14;
        }
        largeArray[10].should.eql(10 * 0.14);
        largeArray[100].should.eql(100 * 0.14);

        (largeArray.byteLength % 8).should.eql(0);
    });

    function isValidBuffer(buf: Float64Array) {
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

    function perform(binStream_writeArrayBuffer: WriteArrayBufferFn, binStream_readArrayBuffer: ReadArrayBufferFn) {
        largeArray[10].should.eql(10 * 0.14);
        largeArray[100].should.eql(100 * 0.14);
        const binStream = new BinaryStream(Buffer.alloc(n * 8 + 20));

        largeArray.length.should.eql(n);
        largeArray.byteLength.should.eql(n * 8);

        binStream_writeArrayBuffer.call(binStream, largeArray.buffer, 0, largeArray.byteLength);
        //xx console.log(binStream.buffer.slice(0,100).toString("hex"));

        binStream.rewind();
        const arr = binStream_readArrayBuffer.call(binStream, largeArray.byteLength);
        arr.length.should.eql(largeArray.byteLength);
        const reloaded = new Float64Array(arr.buffer);

        reloaded.length.should.eql(largeArray.length);

        reloaded[10].should.eql(10 * 0.14);
        reloaded[100].should.eql(100 * 0.14);
        isValidBuffer(reloaded).should.eql(true);
    }

    it("should provide a working writeArrayBuffer", () => {
        perform(BinaryStream.prototype.writeArrayBuffer, BinaryStream.prototype.readArrayBuffer);
    });
    it("should provide a working writeArrayBuffer_old", () => {
        perform(benchmarkPrototype.writeArrayBuffer_old, benchmarkPrototype.readArrayBuffer_old);
    });
    it("should provide a efficient calculateByteLength", () => {
        const bench = new Benchmarker();

        const demoString1 = "&✌☃(｡◕‿◕｡)Ƹ̵̡Ӝ̵̨̄Ʒ  ¯\\_(ツ)_/¯  ٩(⁎❛ᴗ❛⁎)۶   (づ｡◕‿‿◕｡)づ   •*´¨`*•.¸¸.•*´¨`*•.¸¸.•*´¨`*•.¸¸.•*´¨`*•.¸¸.•";
        const demoString2 = "ﭗ";
        const demoString3 = "\uDC20";

        calculateByteLength(demoString1).should.eql(Buffer.from(demoString1).length);
        calculateByteLength(demoString2).should.eql(Buffer.from(demoString2).length);
        calculateByteLength(demoString3).should.eql(Buffer.from(demoString3).length);

        bench
            .add("demoString calculateByteLength", () => {
                const _l1 = calculateByteLength(demoString1);
                const _l2 = calculateByteLength(demoString2);
                const _l3 = calculateByteLength(demoString3);
            })
            .add("demoString with buffer from", () => {
                const _l1 = Buffer.from(demoString1).length;
                const _l2 = Buffer.from(demoString2).length;
                const _l3 = Buffer.from(demoString3).length;
            })

            .on("cycle", (message) => {
                console.log(message);
            })
            .on("complete", function (this: Benchmarker) {
                console.log(` Fastest is ${this.fastest?.name}`);
                console.log(" Speed Up : x", this.speedUp);
                //xx this.fastest?.name.should.eql("Variant.encode");
            })
            .run({ max_time: 0.5 });
    });

    it("should provide a efficient writeArrayBuffer", () => {
        const binStream1 = new BinaryStream(Buffer.alloc(n * 8 + 20)) as BinaryStreamWithBenchmarkVariants;
        const binStream2 = new BinaryStream(Buffer.alloc(n * 8 + 20));
        largeArray.byteLength.should.eql(n * 8);
        const bench = new Benchmarker();
        bench
            .add("writeArrayBuffer (old version with byte copy)", () => {
                binStream1.rewind();
                binStream1.writeArrayBuffer_old(largeArray.buffer, 0, largeArray.byteLength);
            })
            .add("writeArrayBuffer", () => {
                binStream2.rewind();
                binStream2.writeArrayBuffer(largeArray.buffer, 0, largeArray.byteLength);
            })
            .on("cycle", (message) => {
                console.log(message);
            })
            .on("complete", function (this: Benchmarker) {
                console.log(` Fastest is ${this.fastest?.name}`);
                console.log(" Speed Up : x", this.speedUp);
                //xx this.fastest?.name.should.eql("Variant.encode");
            })
            .run({ max_time: 0.2 });
    });

    it("should provide a efficient readArrayBuffer", () => {
        const binStream1 = new BinaryStream(Buffer.alloc(n * 8 + 20)) as BinaryStreamWithBenchmarkVariants;
        binStream1.writeArrayBuffer(largeArray.buffer, 0, largeArray.byteLength);

        //var binStream2 = new BinaryStream(Buffer.alloc(n * 8 + 20));
        //binStream2.writeArrayBuffer(largeArray.buffer, 0, largeArray.byteLength);

        largeArray.byteLength.should.eql(n * 8);

        const bench = new Benchmarker();
        bench
            .add("readArrayBuffer_old (old version with byte copy)", () => {
                binStream1.rewind();
                const arr = binStream1.readArrayBuffer_old(largeArray.byteLength);
                isValidBuffer(new Float64Array(arr.buffer)).should.eql(true);
            })
            .add("readArrayBuffer1", () => {
                binStream1.rewind();
                const arr = binStream1.readArrayBuffer1(largeArray.byteLength);
                isValidBuffer(new Float64Array(arr.buffer)).should.eql(true);
            })
            .add("readArrayBuffer2", () => {
                binStream1.rewind();
                const arr = binStream1.readArrayBuffer2(largeArray.byteLength);
                isValidBuffer(new Float64Array(arr.buffer)).should.eql(true);
            })
            .add("readArrayBuffer3", () => {
                binStream1.rewind();
                const arr = binStream1.readArrayBuffer3(largeArray.byteLength);
                isValidBuffer(new Float64Array(arr.buffer)).should.eql(true);
            })
            .add("readArrayBuffer", () => {
                binStream1.rewind();
                const arr = binStream1.readArrayBuffer(largeArray.byteLength);
                isValidBuffer(new Float64Array(arr.buffer)).should.eql(true);
            })
            .on("cycle", (message) => {
                console.log(message);
            })
            .on("complete", function (this: Benchmarker) {
                console.log(` Fastest is ${this.fastest?.name}`);
                console.log(" Speed Up : x", this.speedUp);
                //xx this.fastest?.name.should.eql("Variant.encode");
            })
            .run({ max_time: 0.2 });
    });

    it("round trip", () => {
        largeArray.byteLength.should.eql(n * 8);

        const binStream1 = new BinaryStream(Buffer.alloc(n * 8 + 20)) as BinaryStreamWithBenchmarkVariants;
        binStream1.writeArrayBuffer(largeArray.buffer, 0, largeArray.byteLength);

        const bench = new Benchmarker();
        bench
            .add("writeArrayBuffer_old/readArrayBuffer_old (old version with byte copy)", () => {
                binStream1.rewind();
                binStream1.writeArrayBuffer_old(largeArray.buffer, 0, largeArray.byteLength);
                binStream1.rewind();
                const arr = binStream1.readArrayBuffer_old(largeArray.byteLength);
                isValidBuffer(new Float64Array(arr.buffer)).should.eql(true);
            })
            .add("writeArrayBuffer/readArrayBuffer", () => {
                binStream1.rewind();
                binStream1.writeArrayBuffer(largeArray.buffer, 0, largeArray.byteLength);
                binStream1.rewind();
                const arr = binStream1.readArrayBuffer(largeArray.byteLength);

                binStream1.length.should.eql(largeArray.byteLength);
                arr.should.be.instanceOf(Uint8Array);
                arr.length.should.eql(arr.byteLength);
                arr.length.should.eql(largeArray.byteLength, "byteLength should match");
                (arr.length % 8).should.eql(0, "must be a multiple of 8");

                isValidBuffer(new Float64Array(arr.buffer)).should.eql(true);
            })
            .on("cycle", (message) => {
                console.log(message);
            })
            .on("complete", function (this: Benchmarker) {
                console.log(` Fastest is ${this.fastest?.name}`);
                console.log(" Speed Up : x", this.speedUp);
                //xx this.fastest?.name.should.eql("Variant.encode");
                largeArray.byteLength.should.eql(n * 8);
            })
            .run({ max_time: 0.2 });
    });
});
