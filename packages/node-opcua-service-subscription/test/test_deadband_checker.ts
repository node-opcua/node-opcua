"use strict";

import * as should from "should";

import { Range } from "node-opcua-types";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import {
    DeadbandType,
    isOutsideDeadbandAbsolute,
    isOutsideDeadbandNone,
    isOutsideDeadbandPercent
} from "..";

function v(value: number) {
    return new Variant({ dataType: "Double", value });
}
function r(low: number, high: number) {
    return new Range({ low, high });
}

describe("test DeadBand Checker", () => {

    const vInt32_1000 = new Variant({ dataType: DataType.Int32, value: 1000 });
    const vInt32_1010 = new Variant({ dataType: DataType.Int32, value: 1010 });

    const vInt32_1000_Array = new Variant({ arrayType: VariantArrayType.Array, dataType: DataType.Int32, value: [1000, 1000] });
    const vInt32_1010_Array = new Variant({ arrayType: VariantArrayType.Array, dataType: DataType.Int32, value: [1010, 982] });

    it("Scalar - DeadbandType.None - should detect difference between two Int scalar", () => {
        isOutsideDeadbandNone(vInt32_1000, vInt32_1010).should.eql(true);
        isOutsideDeadbandNone(vInt32_1000, vInt32_1000).should.eql(false);
    });

    it("Scalar - DeadbandType.Absolute - should detect difference between two Int scalar", () => {
        isOutsideDeadbandAbsolute(vInt32_1000, vInt32_1010, 5).should.eql(true);
        isOutsideDeadbandAbsolute(vInt32_1000, vInt32_1010, 12).should.eql(false);
    });
    it("Scalar - DeadbandType.Percent - should detect difference between two Int scalar", () => {
        isOutsideDeadbandPercent(vInt32_1000, vInt32_1010, 1, r(500, 2000)).should.eql(false);
        isOutsideDeadbandPercent(vInt32_1000, vInt32_1010, 8, r(1000, 1100)).should.eql(true);
    });

    it("Array  - DeadbandType.None - should detect difference between two Int scalar", () => {
        isOutsideDeadbandNone(vInt32_1000_Array, vInt32_1000_Array).should.eql(false);
        isOutsideDeadbandNone(vInt32_1000_Array, vInt32_1010_Array).should.eql(true);
    });

    it("Array  - DeadbandType.Absolute - should detect difference between two Int scalar", () => {
        isOutsideDeadbandAbsolute(vInt32_1000_Array, vInt32_1000_Array, 5).should.eql(false);

        isOutsideDeadbandAbsolute(vInt32_1000_Array, vInt32_1010_Array, 5).should.eql(true);
        isOutsideDeadbandAbsolute(vInt32_1000_Array, vInt32_1010_Array, 10).should.eql(true);
        isOutsideDeadbandAbsolute(vInt32_1000_Array, vInt32_1010_Array, 20).should.eql(false);
    });

    const vInt64_1000 = new Variant({ arrayType: VariantArrayType.Scalar, dataType: DataType.Int64, value: [0, 1000] });
    const vInt64_1010 = new Variant({ arrayType: VariantArrayType.Scalar, dataType: DataType.Int64, value: [0, 1010] });

    // xx console.log("vInt64_1000",vInt64_1000.toString());
    const vInt64_L1000 = new Variant({ arrayType: VariantArrayType.Scalar, dataType: DataType.Int64, value: [1, 1000] });
    const vInt64_L1010 = new Variant({ arrayType: VariantArrayType.Scalar, dataType: DataType.Int64, value: [1, 1010] });

    it("Scalar - DeadbandType.None - should detect difference between two Int64 scalar", () => {

        isOutsideDeadbandNone(vInt64_1000, vInt64_1010).should.eql(true);
        isOutsideDeadbandNone(vInt64_1000, vInt64_1000).should.eql(false);

        isOutsideDeadbandNone(vInt64_1000, vInt64_L1000).should.eql(true);
        isOutsideDeadbandNone(vInt64_1000, vInt64_L1010).should.eql(true);

    });

    it("Scalar - DeadbandType.Absolute - should detect difference between two Int64 scalar", () => {

        isOutsideDeadbandAbsolute(vInt64_1000, vInt64_1010, 5).should.eql(true);
        isOutsideDeadbandAbsolute(vInt64_1000, vInt64_1010, 15).should.eql(false);
        isOutsideDeadbandAbsolute(vInt64_1000, vInt64_L1000, 5).should.eql(true);
        isOutsideDeadbandAbsolute(vInt64_1000, vInt64_L1010, 5).should.eql(true);

    });

    it("Scalar - DeadbandType.Percent - should handle edge case - percent 99", () => {

        isOutsideDeadbandPercent(v(0), v(-200), 99, r(-200, 200)).should.eql(true);
        isOutsideDeadbandPercent(v(0), v(200), 99, r(-200, 200)).should.eql(true);

        isOutsideDeadbandPercent(v(-199), v(-200), 99, r(-200, 200)).should.eql(true);
        isOutsideDeadbandPercent(v(-200), v(200), 99, r(-200, 200)).should.eql(true);

        isOutsideDeadbandPercent(v(199), v(200), 99, r(-200, 200)).should.eql(true);
        isOutsideDeadbandPercent(v(-200), v(-200), 99, r(-200, 200)).should.eql(true);

        isOutsideDeadbandPercent(v(-200), v(200), 99, r(-200, 200)).should.eql(true);
        isOutsideDeadbandPercent(v(-198), v(198), 99, r(-200, 200)).should.eql(false);

    });

    it("Scalar - DeadbandType.Percent - should handle edge case - percent 0", () => {
        isOutsideDeadbandPercent(v(0), v(1), 0, r(-200, 200)).should.eql(true);
        isOutsideDeadbandPercent(v(0), v(2), 0, r(-200, 200)).should.eql(true);
        isOutsideDeadbandPercent(v(1), v(0), 0, r(-200, 200)).should.eql(true);
        isOutsideDeadbandPercent(v(2), v(0), 0, r(-200, 200)).should.eql(true);
        isOutsideDeadbandPercent(v(2), v(2.1), 0, r(-200, 200)).should.eql(true);
    });

});
