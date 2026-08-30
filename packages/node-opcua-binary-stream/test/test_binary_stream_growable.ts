import should from "should";
import { BinaryStream, BinaryStreamMaxSizeExceededError } from "..";

//
// A growable BinaryStream lets a length-prefixed message be encoded in one pass: you no
// longer have to run the whole object graph through a BinaryStreamSizeCalculator first
// just to learn how big the buffer must be.
//
// Growth must be invisible to the caller - same bytes, same cursor - and must stop at the
// declared ceiling so a runaway encode cannot exhaust memory.
//

const MAX = 1024 * 1024;

describe("Testing growable BinaryStream", () => {
    it("should start at the requested capacity and not grow while it fits", () => {
        const stream = BinaryStream.createGrowable(64, MAX);
        const initialBuffer = stream.buffer;

        for (let i = 0; i < 16; i++) {
            stream.writeUInt32(i);
        }

        stream.length.should.eql(64);
        stream.buffer.should.equal(initialBuffer, "should not have reallocated");
    });

    it("should grow to accommodate a fixed-width write past the end", () => {
        const stream = BinaryStream.createGrowable(8, MAX);

        for (let i = 0; i < 100; i++) {
            stream.writeUInt32(i);
        }

        stream.length.should.eql(400);
        stream.buffer.length.should.be.greaterThanOrEqual(400);

        // every value must have survived the reallocations
        stream.rewind();
        for (let i = 0; i < 100; i++) {
            stream.readUInt32().should.eql(i);
        }
    });

    it("should preserve already written bytes across a growth", () => {
        const stream = BinaryStream.createGrowable(4, MAX);
        stream.writeUInt8(0xaa);
        stream.writeUInt8(0xbb);
        stream.writeDouble(1.5);
        stream.writeUInt8(0xcc);

        stream.rewind();
        stream.readUInt8().should.eql(0xaa);
        stream.readUInt8().should.eql(0xbb);
        stream.readDouble().should.eql(1.5);
        stream.readUInt8().should.eql(0xcc);
    });

    it("should grow for a string longer than the current buffer", () => {
        const stream = BinaryStream.createGrowable(8, MAX);
        const text = "x".repeat(5000);

        stream.writeString(text);

        stream.rewind();
        should(stream.readString()).eql(text);
    });

    it("should grow for a byte stream longer than the current buffer", () => {
        const stream = BinaryStream.createGrowable(8, MAX);
        const payload = Buffer.alloc(5000, 0x5a);

        stream.writeByteStream(payload);

        stream.rewind();
        (stream.readByteStream() as Buffer).should.eql(payload);
    });

    it("should grow for an array buffer longer than the current buffer", () => {
        const stream = BinaryStream.createGrowable(8, MAX);
        const arr = new Float64Array(1000);
        for (let i = 0; i < arr.length; i++) {
            arr[i] = i * 0.5;
        }

        stream.writeArrayBuffer(arr.buffer as ArrayBuffer, arr.byteOffset, arr.byteLength);

        stream.length.should.eql(arr.byteLength);
        stream.rewind();
        const readBack = stream.readArrayBuffer(arr.byteLength);
        Array.from(new Float64Array(readBack.buffer, readBack.byteOffset, arr.length)).should.eql(Array.from(arr));
    });

    it("should keep a reserved slot patchable after a growth", () => {
        // reserveUInt32/patchUInt32 hand back an absolute position; a reallocation between
        // the two must not invalidate it, or every nested ExtensionObject length breaks
        const stream = BinaryStream.createGrowable(8, MAX);
        const position = stream.reserveUInt32();
        const bodyStart = stream.length;

        for (let i = 0; i < 200; i++) {
            stream.writeUInt8(i & 0xff);
        }
        stream.patchUInt32(position, stream.length - bodyStart);

        stream.rewind();
        stream.readUInt32().should.eql(200);
        stream.readUInt8().should.eql(0);
    });

    it("should throw a distinguishable error when the ceiling is reached", () => {
        const stream = BinaryStream.createGrowable(8, 64);

        should(() => {
            for (let i = 0; i < 100; i++) {
                stream.writeUInt32(i);
            }
        }).throw(BinaryStreamMaxSizeExceededError);
    });

    it("should report the ceiling and the requested size in the error", () => {
        const stream = BinaryStream.createGrowable(8, 16);

        let caught: unknown;
        try {
            stream.writeString("y".repeat(1000));
        } catch (err) {
            caught = err;
        }

        should.exist(caught);
        (caught as Error).message.should.match(/maximum allowed size is 16/);
    });

    it("should never grow a plain fixed-size stream", () => {
        // the default constructor must keep its old behaviour: overflowing throws rather
        // than silently reallocating, since callers size it from binaryStoreSize()
        const stream = new BinaryStream(8);
        const initialBuffer = stream.buffer;

        should(() => {
            for (let i = 0; i < 100; i++) {
                stream.writeUInt32(i);
            }
        }).throw();
        stream.buffer.should.equal(initialBuffer, "a fixed stream must never reallocate");
    });

    it("should produce byte-identical output to a fixed stream of the right size", () => {
        const write = (s: BinaryStream) => {
            s.writeUInt8(1);
            s.writeUInt32(0xdeadbeef);
            s.writeDouble(3.25);
            s.writeString("hello world");
            s.writeByteStream(Buffer.from([9, 8, 7]));
            s.writeInt16(-2);
        };

        const growable = BinaryStream.createGrowable(2, MAX);
        write(growable);

        const fixed = new BinaryStream(Buffer.allocUnsafe(growable.length));
        write(fixed);

        growable.length.should.eql(fixed.length);
        growable.buffer.subarray(0, growable.length).should.eql(fixed.buffer.subarray(0, fixed.length));
    });
});
