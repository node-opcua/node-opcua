import { BinaryStream } from "node-opcua-binary-stream";
import * as should from "should";
import { DataType, Variant, VariantArrayType } from "../dist";

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
        const largeArray = [];
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
        const largeArray = [];
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
