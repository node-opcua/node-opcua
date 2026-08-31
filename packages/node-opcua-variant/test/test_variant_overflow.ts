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
