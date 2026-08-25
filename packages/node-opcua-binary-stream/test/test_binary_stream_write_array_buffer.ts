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
