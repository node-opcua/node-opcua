import should from "should";
import { BinaryStream, BinaryStreamSizeCalculator } from "..";

//
// writeArrayBuffer has two implementations that MUST stay in lockstep:
//
//   BinaryStream.writeArrayBuffer               -> writes the bytes
//   BinaryStreamSizeCalculator.writeArrayBuffer -> counts the bytes
//
// The encoder relies on this: MessageChunker sizes a message with the calculator,
// allocates a buffer of exactly that size, then encodes for real with the stream.
// If the two disagree, the allocated buffer is the wrong size and chunk framing
// breaks (either an overrun, or uninitialised tail bytes going out on the wire).
//
// These tests pin that invariant, plus the argument conventions the encoder
// depends on. See encodeTypedArray() in node-opcua-variant, the only production
// caller, which always passes (typedArray.buffer, byteOffset, byteLength).
//

const SIZE = 64;

type WriteArgs = [] | [number] | [number, number];

function makeArrayBuffer(): ArrayBuffer {
    // 64 bytes: 0x00 0x01 0x02 ... 0x3f, so position is recoverable from content
    const b = Buffer.alloc(SIZE);
    for (let i = 0; i < SIZE; i++) {
        b[i] = i;
    }
    return b.buffer.slice(b.byteOffset, b.byteOffset + SIZE);
}

describe("Testing BinaryStream.writeArrayBuffer", () => {
    let arrayBuffer: ArrayBuffer;
    beforeEach(() => {
        arrayBuffer = makeArrayBuffer();
    });

    // the arguments the encoder actually uses, plus the degenerate forms
    const cases: { title: string; args: WriteArgs }[] = [
        { title: "no offset, no length", args: [] },
        { title: "offset only", args: [16] },
        { title: "offset 0, explicit full length", args: [0, SIZE] },
        { title: "offset 0, partial length", args: [0, 32] },
        { title: "offset 16, partial length", args: [16, 32] },
        { title: "offset 16, length to end", args: [16, SIZE - 16] },
        { title: "explicit zero length", args: [0, 0] },
        { title: "offset 16, explicit zero length", args: [16, 0] },
        { title: "single byte", args: [0, 1] }
    ];

    for (const { title, args } of cases) {
        it(`should agree with BinaryStreamSizeCalculator - ${title}`, () => {
            const stream = new BinaryStream(Buffer.allocUnsafe(SIZE * 4));
            const calculator = new BinaryStreamSizeCalculator();

            stream.writeArrayBuffer(arrayBuffer, ...args);
            calculator.writeArrayBuffer(arrayBuffer, ...args);

            calculator.length.should.eql(
                stream.length,
                `size calculator and binary stream disagree for writeArrayBuffer(buffer, ${args.join(", ")})`
            );
        });
    }

    it("should write the whole buffer when offset and length are omitted", () => {
        const stream = new BinaryStream(Buffer.allocUnsafe(SIZE * 4));
        stream.writeArrayBuffer(arrayBuffer);

        stream.length.should.eql(SIZE);
        stream.buffer.subarray(0, SIZE).should.eql(Buffer.from(new Uint8Array(arrayBuffer)));
    });

    it("should write exactly the requested slice when offset and length are explicit", () => {
        const stream = new BinaryStream(Buffer.allocUnsafe(SIZE * 4));
        stream.writeArrayBuffer(arrayBuffer, 16, 32);

        stream.length.should.eql(32);
        // bytes 16..47 of the source, i.e. values 16..47
        stream.buffer.subarray(0, 32).should.eql(Buffer.from(new Uint8Array(arrayBuffer, 16, 32)));
    });

    it("should write from offset 0 when only a length is given", () => {
        const stream = new BinaryStream(Buffer.allocUnsafe(SIZE * 4));
        stream.writeArrayBuffer(arrayBuffer, 0, 8);

        stream.length.should.eql(8);
        stream.buffer.subarray(0, 8).should.eql(Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]));
    });

    it("should append at the current cursor rather than at the start", () => {
        const stream = new BinaryStream(Buffer.allocUnsafe(SIZE * 4));
        stream.writeUInt32(0xdeadbeef);
        stream.writeArrayBuffer(arrayBuffer, 0, 4);

        stream.length.should.eql(8);
        stream.buffer.subarray(4, 8).should.eql(Buffer.from([0, 1, 2, 3]));
    });

    it("should accept a TypedArray as first argument (legacy caller shape)", () => {
        // test_binary_stream_overflow.js relies on this: it passes an Int32Array
        // where an ArrayBuffer is declared. new Uint8Array(typedArray) takes the
        // array-like constructor path (element-wise truncation), not a byte view.
        const stream = new BinaryStream(Buffer.allocUnsafe(64));
        const int32Array = new Int32Array([1, 2, 3, 4]);

        should(() => stream.writeArrayBuffer(int32Array as unknown as ArrayBuffer)).not.throw();
        stream.length.should.eql(4);
        stream.buffer.subarray(0, 4).should.eql(Buffer.from([1, 2, 3, 4]));
    });

    it("should write nothing when an explicit zero length is given", () => {
        // `length || byteArr.length` used to turn an explicit 0 into a full-buffer copy,
        // so encoding an empty typed array wrote the whole backing ArrayBuffer.
        const stream = new BinaryStream(Buffer.allocUnsafe(SIZE * 4));
        stream.writeArrayBuffer(arrayBuffer, 0, 0);
        stream.length.should.eql(0);

        stream.writeArrayBuffer(arrayBuffer, 16, 0);
        stream.length.should.eql(0);
    });

    it("should write from offset to the end when length is omitted", () => {
        // the old form ignored `offset` when computing the count, so it read 16 bytes
        // past the end of the source and wrote 64 bytes instead of 48.
        const stream = new BinaryStream(Buffer.allocUnsafe(SIZE * 4));
        stream.writeArrayBuffer(arrayBuffer, 16);

        stream.length.should.eql(SIZE - 16);
        stream.buffer.subarray(0, SIZE - 16).should.eql(Buffer.from(new Uint8Array(arrayBuffer, 16)));
    });

    it("should clamp a length that runs past the end of the source", () => {
        const stream = new BinaryStream(Buffer.allocUnsafe(SIZE * 4));
        const calculator = new BinaryStreamSizeCalculator();

        stream.writeArrayBuffer(arrayBuffer, 32, 999);
        calculator.writeArrayBuffer(arrayBuffer, 32, 999);

        stream.length.should.eql(SIZE - 32);
        calculator.length.should.eql(stream.length);
        stream.buffer.subarray(0, SIZE - 32).should.eql(Buffer.from(new Uint8Array(arrayBuffer, 32)));
    });

    it("should write nothing when offset is at or past the end of the source", () => {
        const stream = new BinaryStream(Buffer.allocUnsafe(SIZE * 4));
        const calculator = new BinaryStreamSizeCalculator();

        stream.writeArrayBuffer(arrayBuffer, SIZE);
        calculator.writeArrayBuffer(arrayBuffer, SIZE);
        stream.length.should.eql(0);
        calculator.length.should.eql(0);

        stream.writeArrayBuffer(arrayBuffer, SIZE + 8);
        calculator.writeArrayBuffer(arrayBuffer, SIZE + 8);
        stream.length.should.eql(0);
        calculator.length.should.eql(0);
    });

    it("should reject a negative offset rather than desynchronising the cursor", () => {
        // subarray() reads a negative start as an offset from the END of the source, so
        // writeArrayBuffer(buf, -4) would copy the last 4 bytes while advancing the cursor
        // by 68 - leaving 64 bytes of untouched destination memory inside the stream, and
        // the size calculator agreeing on the wrong number.
        const stream = new BinaryStream(Buffer.allocUnsafe(SIZE * 4));
        const calculator = new BinaryStreamSizeCalculator();

        should(() => stream.writeArrayBuffer(arrayBuffer, -4)).throw(/offset must be a non-negative number/);
        should(() => calculator.writeArrayBuffer(arrayBuffer, -4)).throw(/offset must be a non-negative number/);

        stream.length.should.eql(0);
        calculator.length.should.eql(0);
    });

    it("should reject a NaN offset", () => {
        const stream = new BinaryStream(Buffer.allocUnsafe(SIZE * 4));

        should(() => stream.writeArrayBuffer(arrayBuffer, Number.NaN)).throw(/offset must be a non-negative number/);
        stream.length.should.eql(0);
    });

    it("should throw rather than silently truncate when the destination is too small", () => {
        // the byte-by-byte loop used to drop the overflowing writes on the floor while
        // still advancing `length`, producing a stream that claimed bytes it never wrote.
        const stream = new BinaryStream(Buffer.allocUnsafe(16));

        should(() => stream.writeArrayBuffer(arrayBuffer, 0, SIZE)).throw(/not enough bytes left in buffer/);
    });

    it("should round-trip a large Float64Array through writeArrayBuffer/readArrayBuffer", () => {
        const n = 4096;
        const arr = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            arr[i] = i * 1.5;
        }

        const stream = new BinaryStream(Buffer.allocUnsafe(arr.byteLength + 16));
        stream.writeArrayBuffer(arr.buffer as ArrayBuffer, arr.byteOffset, arr.byteLength);
        stream.length.should.eql(arr.byteLength);

        stream.rewind();
        const readBack = stream.readArrayBuffer(arr.byteLength);
        const roundTripped = new Float64Array(readBack.buffer, readBack.byteOffset, n);
        Array.from(roundTripped).should.eql(Array.from(arr));
    });
});
