import { BinaryStream, BinaryStreamSizeCalculator } from "node-opcua-binary-stream";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import should from "should";
import { DataValue, decodeDataValue, EncodedDataValue, encodeDataValue, encodedDataValue } from "../dist/index.js";

function encode(dataValue: DataValue): Buffer {
    const size = new BinaryStreamSizeCalculator();
    encodeDataValue(dataValue, size);
    const stream = new BinaryStream(size.length);
    encodeDataValue(dataValue, stream);
    should(stream.length).eql(size.length);
    return stream.buffer.subarray(0, stream.length);
}

describe("a DataValue kept in its binary encoding", () => {
    const original = new DataValue({
        value: new Variant({ dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: new Int32Array([1, 2, 3, 4]) }),
        statusCode: StatusCodes.Good,
        sourceTimestamp: new Date(Date.UTC(2026, 0, 1)),
        sourcePicoseconds: 10,
        serverTimestamp: new Date(Date.UTC(2026, 0, 2)),
        serverPicoseconds: 20
    });
    const bytes = encode(original);

    it("is encoded again as the very bytes it was given, without decoding them", () => {
        // a slice of a larger buffer, as a message carries it
        const message = new Uint8Array(bytes.length + 7);
        message.set(bytes, 3);
        const dataValue = encodedDataValue(message.subarray(3, 3 + bytes.length)) as EncodedDataValue;
        should(encode(dataValue)).eql(bytes);
        should(dataValue._decoded).eql(null, "encoding it did not decode it");
    });

    it("decodes its fields the first time one is read", () => {
        const dataValue = encodedDataValue(new Uint8Array(bytes)) as EncodedDataValue;
        should(dataValue).be.instanceOf(DataValue);
        should(Array.from(dataValue.value.value as Int32Array)).eql([1, 2, 3, 4]);
        should(dataValue.statusCode).eql(StatusCodes.Good);
        should(dataValue.sourceTimestamp).eql(original.sourceTimestamp);
        should(dataValue.sourcePicoseconds).eql(10);
        should(dataValue.serverTimestamp).eql(original.serverTimestamp);
        should(dataValue.serverPicoseconds).eql(20);
        should(dataValue._bytes).eql(null);
    });

    it("is encoded from its fields once one of them has been changed", () => {
        const dataValue = encodedDataValue(new Uint8Array(bytes));
        dataValue.statusCode = StatusCodes.BadDeviceFailure;
        const decoded = decodeDataValue(new BinaryStream(encode(dataValue)));
        should(decoded.statusCode).eql(StatusCodes.BadDeviceFailure);
        should(Array.from(decoded.value.value as Int32Array)).eql([1, 2, 3, 4]);
    });

    it("clones into an ordinary DataValue", () => {
        const clone = encodedDataValue(new Uint8Array(bytes)).clone();
        should(clone).not.be.instanceOf(EncodedDataValue);
        should(Array.from(clone.value.value as Int32Array)).eql([1, 2, 3, 4]);
        should(clone.serverPicoseconds).eql(20);
    });
});
