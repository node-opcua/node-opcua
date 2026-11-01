import { BinaryStream } from "node-opcua-binary-stream";
import should from "should";
import { DataType, Variant, VariantArrayType } from "../dist/index.js";

describe("test variant array decoding - should prevent resource exhaustion", () => {
    it("should raise an exception if array buffer is too large", () => {
        const variant = new Variant({
            dataType: DataType.Int32,
            arrayType: VariantArrayType.Array,
            value: new Int32Array(Variant.maxTypedArrayLength + 10)
        });

        const binaryStream = new BinaryStream(variant.binaryStoreSize());

        variant.encode(binaryStream);

        binaryStream.rewind();

        should.throws(() => {
            const reloadedVariant = new Variant();
            reloadedVariant.decode(binaryStream);
        }, "expecting Variant.decode to raise an exception if array is too large");
    });

    it("should not raise an exception if array buffer is as large as possible", () => {
        const variant = new Variant({
            dataType: DataType.Byte,
            arrayType: VariantArrayType.Array,
            value: new Int8Array(Variant.maxTypedArrayLength)
        });

        const binaryStream = new BinaryStream(variant.binaryStoreSize());

        variant.encode(binaryStream);

        binaryStream.rewind();

        const reloadedVariant = new Variant();
        reloadedVariant.decode(binaryStream);
    });

    it("should raise an exception if array buffer is too large - generic array", () => {
        const largeArray: string[] = [];
        largeArray.length = Variant.maxArrayLength + 10;
        const variant = new Variant({
            dataType: DataType.String,
            arrayType: VariantArrayType.Array,
            value: largeArray
        });

        const binaryStream = new BinaryStream(variant.binaryStoreSize());

        variant.encode(binaryStream);

        binaryStream.rewind();

        should.throws(() => {
            const reloadedVariant = new Variant();
            reloadedVariant.decode(binaryStream);
        }, "expecting Variant.decode to raise an exception if array is too large");
    });
    it("should  Not raise an exception if array buffer is as large as possible - generic array", () => {
        const largeArray: string[] = [];
        largeArray.length = Variant.maxArrayLength;
        const variant = new Variant({
            dataType: DataType.String,
            arrayType: VariantArrayType.Array,
            value: largeArray
        });

        const binaryStream = new BinaryStream(variant.binaryStoreSize());

        variant.encode(binaryStream);

        binaryStream.rewind();

        const reloadedVariant = new Variant();
        reloadedVariant.decode(binaryStream);
    });
});

describe("test variant decoding - hostile encoding byte", () => {
    // The Variant encoding byte carries the DataType in its low 6 bits (VARIANT_TYPE_MASK
    // = 0x3f), so a peer can put 0..63 there while only 0..25 are defined. The decoder must
    // reject the undefined ones with a real Error rather than dying on an incidental
    // TypeError from an undefined function reference - that distinction is what tells a
    // caller "bad input from the wire" apart from "bug in the SDK".
    const UNDEFINED_DATA_TYPES = [26, 31, 63];
    const VARIANT_ARRAY_MASK = 0x80;

    for (const dataType of UNDEFINED_DATA_TYPES) {
        for (const isArray of [false, true]) {
            const label = isArray ? "array" : "scalar";
            it(`should reject an undefined DataType ${dataType} on the wire (${label})`, () => {
                const buffer = Buffer.alloc(32);
                buffer[0] = dataType | (isArray ? VARIANT_ARRAY_MASK : 0);

                let caught: unknown;
                try {
                    const variant = new Variant();
                    variant.decode(new BinaryStream(buffer));
                } catch (err) {
                    caught = err;
                }

                should.exist(caught, `decoding DataType ${dataType} should have thrown`);
                should(caught).be.instanceOf(Error);
                should(caught).not.be.instanceOf(TypeError);
            });
        }
    }

    it("should still accept the highest defined DataType", () => {
        // guards the boundary: 25 (DiagnosticInfo) must keep decoding
        const buffer = Buffer.alloc(32);
        buffer[0] = DataType.DiagnosticInfo;

        const variant = new Variant();
        variant.decode(new BinaryStream(buffer));

        variant.dataType.should.eql(DataType.DiagnosticInfo);
    });
});

describe("test variant array decoding - wire-controlled length must be backed by the payload", () => {
    // decodeGeneralArray reads a 32-bit element count straight off the wire. Checking it only
    // against the maxArrayLength ceiling is not enough: an element decoder that consumes zero
    // bytes (DataType.Null, encode_decode.ts: decodeNull) lets a declared length far below the
    // ceiling size an allocation that the tiny buffer behind it can never justify. A 5-byte
    // buffer declaring 1,048,575 Null elements sits under maxArrayLength (1,048,576) yet expands
    // into a 1,048,575-slot array. The decoder must reject any length the remaining bytes cannot
    // back, not just lengths above the ceiling.
    const VARIANT_ARRAY_MASK = 0x80;

    function decodeOf(buffer: Buffer): { caught: unknown; value: unknown } {
        let caught: unknown;
        const variant = new Variant();
        try {
            variant.decode(new BinaryStream(buffer));
        } catch (err) {
            caught = err;
        }
        return { caught, value: variant.value };
    }

    it("rejects an array length larger than the bytes remaining (Null element, zero bytes each)", () => {
        // encodingByte = DataType.Null | array flag, then UInt32 length = 1,048,575, and no body.
        const buffer = Buffer.from([VARIANT_ARRAY_MASK | DataType.Null, 0xff, 0xff, 0x0f, 0x00]);

        const { caught, value } = decodeOf(buffer);

        should.exist(caught, "decoding an unsatisfiable Null array must throw, not allocate 1,048,575 slots");
        should(caught).be.instanceOf(Error); // catchable: the transport try/catch closes only this connection
        should(caught).not.be.instanceOf(TypeError);
        should.not.exist(value);
    });

    it("rejects a generic array whose declared length exceeds the bytes remaining", () => {
        // Boolean has no typed-array helper, so it goes through decodeGeneralArray. Declare 3
        // elements but supply only 2 bytes of body.
        const buffer = Buffer.from([VARIANT_ARRAY_MASK | DataType.Boolean, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00]);

        const { caught } = decodeOf(buffer);

        should.exist(caught, "a Boolean[3] backed by only 2 bytes must be rejected");
        should(caught).be.instanceOf(Error);
    });

    it("still accepts a generic array that the payload fully backs (no off-by-one, ceiling intact)", () => {
        // Boolean[3] with exactly 3 bytes of body must decode normally.
        const buffer = Buffer.from([VARIANT_ARRAY_MASK | DataType.Boolean, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01]);

        const { caught, value } = decodeOf(buffer);

        should.not.exist(caught);
        (value as boolean[]).should.eql([true, false, true]);
    });
});
