const should = require("should");
const { BinaryStream } = require("..");

describe("test buffer overflow prevention", function () {
    this.timeout(10000);

    it("readString - should raise an exception if array buffer is too large", () => {
        const str = "*".padEnd(BinaryStream.maxAllowedStringSize + 1);

        const binaryStream = new BinaryStream(str.length + 4);

        binaryStream.writeString(str);

        binaryStream.rewind();

        should.throws(() => {
            binaryStream.readString();
        }, "expecting Binary.readString to raise an exception if array is too large");
    });

    it("readString - should not raise an exception if array buffer is as large as possible", () => {
        const str = " ".padEnd(BinaryStream.maxAllowedStringSize);

        const binaryStream = new BinaryStream(str.length + 4);

        binaryStream.writeString(str);

        binaryStream.rewind();

        const reloadedBuf = binaryStream.readString();
        reloadedBuf.length.should.eql(str.length);
    });

    it("readByteStream - should raise an exception if array buffer is too large", () => {
        const buffer = Buffer.alloc(BinaryStream.maxAllowedBufferSize + 1);

        const binaryStream = new BinaryStream(buffer.length + 4);

        binaryStream.writeByteStream(buffer);

        binaryStream.rewind();

        should.throws(() => {
            binaryStream.readByteStream();
        }, "expecting Binary.readByteStream to raise an exception if array is too large");
    });

    it("readByteStream - should not raise an exception if array buffer is as large as possible", () => {
        const buffer = Buffer.alloc(BinaryStream.maxAllowedBufferSize);

        const binaryStream = new BinaryStream(buffer.length + 4);

        binaryStream.writeByteStream(buffer);

        binaryStream.rewind();

        const reloadedBuf = binaryStream.readByteStream();
    });

    it("readArrayBuffer - should raise an exception if array buffer is too large", () => {
        const arrayBuffer = new Int32Array(BinaryStream.maxAllowedBufferSize / 4 + 1);
        const byteLength = arrayBuffer.byteLength;
        byteLength.should.eql(BinaryStream.maxAllowedBufferSize+4);
        const binaryStream = new BinaryStream(byteLength);

        binaryStream.writeArrayBuffer(arrayBuffer);

        binaryStream.rewind();

        should.throws(() => {
            const arrayBuffer2 = binaryStream.readArrayBuffer(byteLength);
        }, "expecting Binary.readArrayBuffer to raise an exception if array is too large");
    });

    it("readArrayBuffer - should not raise an exception if array buffer is as large as possible", () => {
        const arrayBuffer = new Int32Array(BinaryStream.maxAllowedBufferSize / 4);
        const byteLength = arrayBuffer.byteLength;
        const binaryStream = new BinaryStream(byteLength);

        binaryStream.writeArrayBuffer(arrayBuffer);

        binaryStream.rewind();

        const arrayBuffer2 = binaryStream.readArrayBuffer(byteLength);
    });
});
