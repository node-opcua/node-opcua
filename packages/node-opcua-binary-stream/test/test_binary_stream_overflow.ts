import should from "should";
import { BinaryStream } from "../dist/index.js";

describe("test buffer overflow prevention", function () {
    this.timeout(10000);

    it("readString - should raise an exception if array buffer is too large", () => {
        const str = "*".padEnd(BinaryStream.maxStringLength + 1);

        const binaryStream = new BinaryStream(str.length + 4);

        binaryStream.writeString(str);

        binaryStream.rewind();

        should.throws(() => {
            binaryStream.readString();
        }, "expecting Binary.readString to raise an exception if array is too large");
    });

    it("readString - should not raise an exception if array buffer is as large as possible", () => {
        const str = " ".padEnd(BinaryStream.maxStringLength);

        const binaryStream = new BinaryStream(str.length + 4);

        binaryStream.writeString(str);

        binaryStream.rewind();

        const reloadedBuf = binaryStream.readString();
        should(reloadedBuf?.length).eql(str.length);
    });

    it("readByteStream - should raise an exception if array buffer is too large", () => {
        const buffer = Buffer.alloc(BinaryStream.maxByteStringLength + 1);

        const binaryStream = new BinaryStream(buffer.length + 4);

        binaryStream.writeByteStream(buffer);

        binaryStream.rewind();

        should.throws(() => {
            binaryStream.readByteStream();
        }, "expecting Binary.readByteStream to raise an exception if array is too large");
    });

    it("readByteStream - should not raise an exception if array buffer is as large as possible", () => {
        const buffer = Buffer.alloc(BinaryStream.maxByteStringLength);

        const binaryStream = new BinaryStream(buffer.length + 4);

        binaryStream.writeByteStream(buffer);

        binaryStream.rewind();

        const _reloadedBuf = binaryStream.readByteStream();
    });

    it("readArrayBuffer - should raise an exception if array buffer is too large", () => {
        const arrayBuffer = new Int32Array(BinaryStream.maxByteStringLength / 4 + 1);
        const byteLength = arrayBuffer.byteLength;
        byteLength.should.eql(BinaryStream.maxByteStringLength + 4);
        const binaryStream = new BinaryStream(byteLength);

        binaryStream.writeArrayBuffer(arrayBuffer.buffer);

        binaryStream.rewind();

        should.throws(() => {
            const _arrayBuffer2 = binaryStream.readArrayBuffer(byteLength);
        }, "expecting Binary.readArrayBuffer to raise an exception if array is too large");
    });

    it("readArrayBuffer - should not raise an exception if array buffer is as large as possible", () => {
        const arrayBuffer = new Int32Array(BinaryStream.maxByteStringLength / 4);
        const byteLength = arrayBuffer.byteLength;
        const binaryStream = new BinaryStream(byteLength);

        binaryStream.writeArrayBuffer(arrayBuffer.buffer);

        binaryStream.rewind();

        const _arrayBuffer2 = binaryStream.readArrayBuffer(byteLength);
    });
});
