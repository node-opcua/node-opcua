import { decodeArray } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import { encodeStatusCode, StatusCodes } from "node-opcua-status-code";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import should from "should";
import { DataValue, decodeDataValue } from "../dist/index.js";

//
// decodeDataValue(stream) - the single-argument form - is reached from
// decodeArray(stream, decodeDataValue), which is how ReadResponse.results and
// HistoryData.dataValues are decoded. It is therefore on the client read path.
//
// The existing tests never exercise it: encode_decode_round_trip_test builds the
// target with `new (obj.constructor)()` and then calls obj.decode(stream), which
// enters decodeDataValueInternal directly and bypasses decodeDataValue entirely.
//
// These tests pin the wire-level contract, in particular that a DataValue decoded
// from a mask with no StatusCode bit reports Good. decodeDataValueInternal assigns
// statusCode on *both* branches of that test, and the cheap-constructor
// optimisation depends on it: the constructor's own statusCode must never be
// observable after a decode.
//

// DataValue encoding mask bits (OPC UA part 6)
const HAS_VALUE = 0x01;
const HAS_STATUS_CODE = 0x02;
const HAS_SOURCE_TIMESTAMP = 0x04;

describe("Testing decodeDataValue (single-argument form)", () => {
    it("should report Good when the encoding mask carries no StatusCode bit", () => {
        const stream = new BinaryStream(Buffer.from([0x00]));

        const dataValue = decodeDataValue(stream);

        dataValue.should.be.instanceOf(DataValue);
        dataValue.statusCode.should.eql(StatusCodes.Good);
    });

    it("should produce a null Variant when the encoding mask carries no Value bit", () => {
        const stream = new BinaryStream(Buffer.from([0x00]));

        const dataValue = decodeDataValue(stream);

        dataValue.value.should.be.instanceOf(Variant);
        dataValue.value.dataType.should.eql(DataType.Null);
        dataValue.value.arrayType.should.eql(VariantArrayType.Scalar);
        should(dataValue.value.value).eql(null);
        should(dataValue.value.dimensions).eql(null);
    });

    it("should leave every timestamp empty when the mask carries no timestamp bits", () => {
        const stream = new BinaryStream(Buffer.from([0x00]));

        const dataValue = decodeDataValue(stream);

        should(dataValue.sourceTimestamp).eql(null);
        should(dataValue.serverTimestamp).eql(null);
        dataValue.sourcePicoseconds.should.eql(0);
        dataValue.serverPicoseconds.should.eql(0);
    });

    it("should preserve a Bad status code carried on the wire", () => {
        const buffer = Buffer.allocUnsafe(8);
        const writer = new BinaryStream(buffer);
        writer.writeUInt8(HAS_STATUS_CODE);
        encodeStatusCode(StatusCodes.BadInternalError, writer);

        const dataValue = decodeDataValue(new BinaryStream(buffer.subarray(0, writer.length)));

        dataValue.statusCode.should.eql(StatusCodes.BadInternalError);
    });

    it("should decode a value and a status code together", () => {
        const source = new DataValue({
            value: new Variant({ dataType: DataType.Double, value: 42.5 }),
            statusCode: StatusCodes.UncertainInitialValue
        });
        const buffer = Buffer.allocUnsafe(source.binaryStoreSize());
        const writer = new BinaryStream(buffer);
        source.encode(writer);
        // sanity: the encoder really did set both bits and nothing else
        buffer[0].should.eql(HAS_VALUE | HAS_STATUS_CODE);

        const dataValue = decodeDataValue(new BinaryStream(buffer));

        dataValue.statusCode.should.eql(StatusCodes.UncertainInitialValue);
        dataValue.value.dataType.should.eql(DataType.Double);
        dataValue.value.value.should.eql(42.5);
    });

    it("should round-trip source and server timestamps", () => {
        const sourceTimestamp = new Date(Date.UTC(2026, 0, 2, 3, 4, 5, 678));
        const serverTimestamp = new Date(Date.UTC(2026, 0, 2, 3, 4, 6, 789));
        const source = new DataValue({
            value: new Variant({ dataType: DataType.UInt32, value: 7 }),
            statusCode: StatusCodes.Good,
            sourceTimestamp,
            serverTimestamp
        });
        const buffer = Buffer.allocUnsafe(source.binaryStoreSize());
        source.encode(new BinaryStream(buffer));

        const dataValue = decodeDataValue(new BinaryStream(buffer));

        should.exist(dataValue.sourceTimestamp);
        should.exist(dataValue.serverTimestamp);
        (dataValue.sourceTimestamp as Date).getTime().should.eql(sourceTimestamp.getTime());
        (dataValue.serverTimestamp as Date).getTime().should.eql(serverTimestamp.getTime());
        dataValue.value.value.should.eql(7);
    });

    it("should not carry state between successive decodes from the same stream", () => {
        // decodeArray(stream, decodeDataValue) is the real caller: each element must be
        // an independent DataValue, and an element with a sparse mask must not inherit
        // fields from the element decoded before it.
        const full = new DataValue({
            value: new Variant({ dataType: DataType.String, value: "first" }),
            statusCode: StatusCodes.BadWaitingForInitialData,
            sourceTimestamp: new Date(Date.UTC(2026, 5, 5))
        });
        const fullBuffer = Buffer.allocUnsafe(full.binaryStoreSize());
        full.encode(new BinaryStream(fullBuffer));
        (fullBuffer[0] & HAS_SOURCE_TIMESTAMP).should.eql(HAS_SOURCE_TIMESTAMP);

        // three elements: a fully populated one, then two empty ones
        const buffer = Buffer.concat([Buffer.from([3, 0, 0, 0]), fullBuffer, Buffer.from([0x00]), Buffer.from([0x00])]);

        const results = decodeArray(new BinaryStream(buffer), decodeDataValue) as DataValue[];

        should.exist(results);
        results.length.should.eql(3);

        results[0].statusCode.should.eql(StatusCodes.BadWaitingForInitialData);
        results[0].value.value.should.eql("first");

        for (const empty of [results[1], results[2]]) {
            empty.statusCode.should.eql(StatusCodes.Good);
            empty.value.dataType.should.eql(DataType.Null);
            should(empty.value.value).eql(null);
            should(empty.sourceTimestamp).eql(null);
        }
    });

    it("should decode into a caller-supplied DataValue when one is given", () => {
        const source = new DataValue({
            value: new Variant({ dataType: DataType.Int32, value: -3 }),
            statusCode: StatusCodes.Good
        });
        const buffer = Buffer.allocUnsafe(source.binaryStoreSize());
        source.encode(new BinaryStream(buffer));

        const target = new DataValue();
        const returned = decodeDataValue(new BinaryStream(buffer), target);

        returned.should.equal(target); // same instance, not a copy
        target.value.value.should.eql(-3);
    });
});
