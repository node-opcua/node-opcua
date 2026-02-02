
import { BinaryStream } from "node-opcua-binary-stream";
import { decodeVariant, Variant, VariantArrayType } from "..";
import { DataType } from "node-opcua-basic-types";
import "should";

describe("Variant Optimization: Zero-Copy and Alignment", () => {

    it("should use zero-copy for large ByteArray (always aligned)", () => {
        const size = 1000;
        const buffer = Buffer.allocUnsafe(size + 10);
        const stream = new BinaryStream(buffer);
        stream.writeUInt8(DataType.Byte | 0x80); // Byte | Array
        stream.writeUInt32(size);
        const startOffset = stream.length;
        for (let i = 0; i < size; i++) stream.writeUInt8(1);

        const encoded = buffer.subarray(0, stream.length);

        const s = new BinaryStream(encoded);
        const v = decodeVariant(s);

        v.dataType.should.equal(DataType.Byte);
        v.arrayType.should.equal(VariantArrayType.Array);
        v.value.should.be.instanceOf(Uint8Array);
        v.value.length.should.equal(size);

        // Zero-copy verification:
        // The value buffer should be the same memory as the input encoded buffer
        // value.buffer (ArrayBuffer) should be the same object or same memory region?
        // Node.js Buffers share memory.
        const valueBuffer = v.value as Uint8Array;

        // Check if modifying the original buffer affects the variant value
        const originalValue = valueBuffer[0];
        encoded[startOffset] = originalValue === 1 ? 2 : 1;

        valueBuffer[0].should.equal(encoded[startOffset]); // Should be coupled
    });

    it("should use zero-copy for Aligned FloatArray", () => {
        // Ensure payload starts at multiple of 4 (Float)
        // Variant Header: 1 byte (encoding) + 4 bytes (Array Length) = 5 bytes.
        // We need 3 bytes padding before the Variant to make payload start at 8?
        // No, we act on the input buffer of BinaryStream.

        // If we start BinaryStream at offset 3 of a buffer:
        // 3 + 1 + 4 = 8. Payload starts at 8. Aligned for Float.

        const size = 10;
        const buffer = Buffer.alloc(100);
        // Start writing at offset 3
        const stream = new BinaryStream(buffer);
        stream.length = 3;

        stream.writeUInt8(DataType.Float | 0x80);
        stream.writeUInt32(size);
        const payloadStart = stream.length;
        // payloadStart should be 3 + 1 + 4 = 8.
        payloadStart.should.equal(8);

        for (let i = 0; i < size; i++) stream.writeFloat(i);

        const encoded = buffer.subarray(3, stream.length);

        const s = new BinaryStream(encoded);
        const v = decodeVariant(s);

        v.dataType.should.equal(DataType.Float);
        v.value.should.be.instanceOf(Float32Array);

        const valueArr = v.value as Float32Array;

        // Verify coupling
        const original = valueArr[0]; // 0
        // access raw buffer at payloadStart (relative to full buffer)
        // Modify float at index 0.
        buffer.writeFloatLE(123.5, payloadStart);
        valueArr[0].should.equal(123.5); // Coupled
    });

    it("should use Clean Copy (Fallback) for Misaligned FloatArray", () => {
        // Variant Header: 1 byte + 4 bytes = 5 bytes.
        // If stream starts at 0: payload at 5. 5 % 4 != 0. Misaligned.

        const size = 10;
        const buffer = Buffer.alloc(100);
        const stream = new BinaryStream(buffer);

        stream.writeUInt8(DataType.Float | 0x80);
        stream.writeUInt32(size);
        const payloadStart = stream.length; // 5
        payloadStart.should.equal(5);

        for (let i = 0; i < size; i++) stream.writeFloat(i);

        const encoded = buffer.subarray(0, stream.length);

        const s = new BinaryStream(encoded);
        const v = decodeVariant(s);

        v.dataType.should.equal(DataType.Float);
        v.value.should.be.instanceOf(Float32Array);

        const valueArr = v.value as Float32Array;

        // Verify Decoupling (Copy happened)
        buffer.writeFloatLE(999.999, payloadStart);
        valueArr[0].should.not.equal(999.999); // Decoupled
        valueArr[0].should.equal(0);
    });

});
