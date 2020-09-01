"use strict";

import * as should from "should";
import { assert } from "node-opcua-assert";

import {
    Variant,
    DataType,
    VariantArrayType,
    isValidVariant,
    buildVariantArray,
    VARIANT_ARRAY_MASK,
    coerceVariantType,
    decodeVariant,
    adjustVariant
} from "..";

describe("method #adjustVariant", () => {
    it("should adjust a Scalar/ByteString to a Byte/Array", () => {
        const v = new Variant({ dataType: DataType.ByteString, value: Buffer.from("hello") });
        v.dataType.should.eql(DataType.ByteString);
        v.arrayType.should.eql(VariantArrayType.Scalar);

        const v_adjusted = adjustVariant(v, 1, DataType.Byte);
        v_adjusted.dataType.should.eql(DataType.Byte);
        v_adjusted.arrayType.should.eql(VariantArrayType.Array);
    });
    it("should not adjust Scalar/ByteString to a Byte/Array when not required", () => {
        const v = new Variant({ dataType: DataType.ByteString, value: Buffer.from("hello") });
        v.dataType.should.eql(DataType.ByteString);
        v.arrayType.should.eql(VariantArrayType.Scalar);

        const v_adjusted = adjustVariant(v, -1, DataType.ByteString);
        v_adjusted.dataType.should.eql(DataType.ByteString);
        v_adjusted.arrayType.should.eql(VariantArrayType.Scalar);
    });
    it("should adjust a  Byte/Array to Scalar/ByteString", () => {
        const v = new Variant({ dataType: DataType.Byte, arrayType: VariantArrayType.Array, value: Buffer.from("hello") });
        v.dataType.should.eql(DataType.Byte);
        v.arrayType.should.eql(VariantArrayType.Array);

        const v_adjusted = adjustVariant(v, -1, DataType.ByteString);
        v_adjusted.dataType.should.eql(DataType.ByteString);
        v_adjusted.arrayType.should.eql(VariantArrayType.Scalar);
    });
    it("should not adjust a  Byte/Array to Scalar/ByteString when not required", () => {
        const v = new Variant({ dataType: DataType.Byte, arrayType: VariantArrayType.Array, value: Buffer.from("hello") });
        v.dataType.should.eql(DataType.Byte);
        v.arrayType.should.eql(VariantArrayType.Array);

        const v_adjusted = adjustVariant(v, 1, DataType.Byte);
        v_adjusted.dataType.should.eql(DataType.Byte);
        v_adjusted.arrayType.should.eql(VariantArrayType.Array);
    });
});
