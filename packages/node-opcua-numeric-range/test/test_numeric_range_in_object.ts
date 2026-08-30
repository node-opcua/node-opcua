import should from "should";

import { BaseUAObject, buildStructuredType, type IStructuredTypeSchema } from "node-opcua-factory";
import type { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { encode_decode_round_trip_test, json_encode_decode_round_trip_test } from "node-opcua-packet-analyzer/dist/test_helpers";

import { NumericRange, encodeNumericRange, decodeNumericRange } from "..";

const schemaObjWithNumericRange: IStructuredTypeSchema = buildStructuredType({
    name: "ObjWithNumericRange",
    baseType: "BaseUAObject",
    fields: [{ name: "numericRange", fieldType: "NumericRange" }]
});

class ObjWithNumericRange extends BaseUAObject {
    public static schema = schemaObjWithNumericRange;

    public numericRange: NumericRange;

    constructor(options?: { numericRange?: string | NumericRange | null }) {
        super();
        this.numericRange = NumericRange.coerce(options?.numericRange);
    }
    encode(stream: OutputBinaryStream): void {
        encodeNumericRange(this.numericRange, stream);
    }
    decode(stream: BinaryStream): void {
        this.numericRange = decodeNumericRange(stream);
    }
}
ObjWithNumericRange.prototype.schema = schemaObjWithNumericRange;

describe(" encoding / decoding", function () {
    function _encode_decode_test(prefix: string, roundTrip: (o: ObjWithNumericRange) => unknown) {
        it(prefix + "should persist an object with a numeric range - empty", function () {
            const o = new ObjWithNumericRange({});
            o.numericRange.type.should.equal(NumericRange.NumericRangeType.Empty);
            should(o.numericRange.isValid()).eql(true);
            should(o.numericRange.toEncodeableString()).eql(null);
            roundTrip(o);
        });

        it(prefix + "should persist an object with a numeric range - value pair", function () {
            const o = new ObjWithNumericRange({
                numericRange: "2:3"
            });
            should(o.numericRange.isValid()).eql(true);
            o.numericRange.type.should.equal(NumericRange.NumericRangeType.ArrayRange);
            should(o.numericRange.toEncodeableString()).eql("2:3");
            roundTrip(o);
        });

        it(prefix + "should persist an object with a numeric range - single value", function () {
            const o = new ObjWithNumericRange({
                numericRange: "100"
            });
            should(o.numericRange.isValid()).eql(true);
            o.numericRange.type.should.equal(NumericRange.NumericRangeType.SingleValue);
            should(o.numericRange.toEncodeableString()).eql("100");
            roundTrip(o);
        });

        it(prefix + "should persist an object with a numeric range - Invalid", function () {
            const o = new ObjWithNumericRange({
                numericRange: "-4,-8"
            });
            should(o.numericRange.isValid()).eql(false);
            o.numericRange.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
            should(o.numericRange.toEncodeableString()).eql("-4,-8");
            roundTrip(o);
        });

        it(prefix + "should persist an object with a numeric range - MatrixRange - type 1", function () {
            const o = new ObjWithNumericRange({
                numericRange: "1:2,3:4"
            });
            o.numericRange.type.should.equal(NumericRange.NumericRangeType.MatrixRange);
            should(o.numericRange.isValid()).eql(true);
            should(o.numericRange.toEncodeableString()).eql("1:2,3:4");
            roundTrip(o);
        });

        it(prefix + "should persist an object with a numeric range - MatrixRange - type 2", function () {
            const o = new ObjWithNumericRange({
                numericRange: "1,3"
            });
            o.numericRange.type.should.equal(NumericRange.NumericRangeType.MatrixRange);
            should(o.numericRange.isValid()).eql(true);
            should(o.numericRange.toEncodeableString()).eql("1,3");
            roundTrip(o);
        });

        it(prefix + "should persist an object with a numeric range - MatrixRange - type 2", function () {
            const o = new ObjWithNumericRange({
                numericRange: "<invalid_range>"
            });
            o.numericRange.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
            should(o.numericRange.isValid()).eql(false);
            roundTrip(o);
        });
    }
    _encode_decode_test("binary : ", encode_decode_round_trip_test);
    _encode_decode_test("json : ", json_encode_decode_round_trip_test);
});
