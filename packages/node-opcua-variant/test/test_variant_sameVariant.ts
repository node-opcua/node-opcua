/* eslint-disable max-statements */
import "should";
import { assert } from "node-opcua-assert";
import { ExtensionObject } from "node-opcua-extension-object";

import { sameVariant, Variant, DataType, VariantArrayType, buildVariantArray } from "..";

describe("testing return sameVariant for pull request", () => {
    it("testing same variants of type Boolean", () => {
        const b1 = new Variant({ dataType: DataType.Boolean, arrayType: VariantArrayType.Scalar, value: true });
        const b1c = new Variant({ dataType: DataType.Boolean, arrayType: VariantArrayType.Scalar, value: true });
        assert(sameVariant(b1, b1c), "should be true");
    });

    it("testing different variants of type Boolean", () => {
        const b1 = new Variant({ dataType: DataType.Boolean, arrayType: VariantArrayType.Scalar, value: true });
        const b2 = new Variant({ dataType: DataType.Boolean, arrayType: VariantArrayType.Scalar, value: false });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type Boolean array", () => {
        const b1 = new Variant({ dataType: DataType.Boolean, arrayType: VariantArrayType.Array, value: [true, false] });
        const b1c = new Variant({
            dataType: DataType.Boolean,
            arrayType: VariantArrayType.Array,
            value: [true, false]
        });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type Boolean array", () => {
        const b1 = new Variant({ dataType: DataType.Boolean, arrayType: VariantArrayType.Array, value: [true, false] });
        const b2 = new Variant({ dataType: DataType.Boolean, arrayType: VariantArrayType.Array, value: [true, true] });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type Boolean matrix", () => {
        const b1 = new Variant({
            dataType: DataType.Boolean,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [true, true, true, true, true, true]
        });
        const b1c = new Variant({
            dataType: DataType.Boolean,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [true, true, true, true, true, true]
        });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type Boolean matrix", () => {
        const b1 = new Variant({
            dataType: DataType.Boolean,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [true, true, true, true, true, true]
        });
        const b2 = new Variant({
            dataType: DataType.Boolean,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [true, true, true, true, true, false]
        });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing different variants of type Boolean matrix different dimension, same size", () => {
        const b1 = new Variant({
            dataType: DataType.Boolean,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [true, true, true, true, true, true]
        });
        const b2 = new Variant({
            dataType: DataType.Boolean,
            arrayType: VariantArrayType.Matrix,
            dimensions: [3, 2],
            value: [true, true, true, true, true, true]
        });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type Byte", () => {
        const b1 = new Variant({ dataType: DataType.Byte, arrayType: VariantArrayType.Scalar, value: 1 });
        const b1c = new Variant({ dataType: DataType.Byte, arrayType: VariantArrayType.Scalar, value: 1 });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type Byte", () => {
        const b1 = new Variant({ dataType: DataType.Byte, arrayType: VariantArrayType.Scalar, value: 1 });
        const b2 = new Variant({ dataType: DataType.Byte, arrayType: VariantArrayType.Scalar, value: 2 });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type Byte array", () => {
        const b1 = new Variant({ dataType: DataType.Byte, arrayType: VariantArrayType.Array, value: [1, 1] });
        const b1c = new Variant({ dataType: DataType.Byte, arrayType: VariantArrayType.Array, value: [1, 1] });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type Byte array", () => {
        const b1 = new Variant({ dataType: DataType.Byte, arrayType: VariantArrayType.Array, value: [1, 1] });
        const b2 = new Variant({ dataType: DataType.Byte, arrayType: VariantArrayType.Array, value: [1, 2] });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type Byte matrix", () => {
        const b1 = new Variant({
            dataType: DataType.Byte,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        const b1c = new Variant({
            dataType: DataType.Byte,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type Byte matrix", () => {
        const b1 = new Variant({
            dataType: DataType.Byte,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        const b2 = new Variant({
            dataType: DataType.Byte,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 0, 6]
        });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type SByte", () => {
        const b1 = new Variant({ dataType: DataType.SByte, arrayType: VariantArrayType.Scalar, value: 1 });
        const b1c = new Variant({ dataType: DataType.SByte, arrayType: VariantArrayType.Scalar, value: 1 });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type SByte", () => {
        const b1 = new Variant({ dataType: DataType.SByte, arrayType: VariantArrayType.Scalar, value: 1 });
        const b2 = new Variant({ dataType: DataType.SByte, arrayType: VariantArrayType.Scalar, value: 2 });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type SByte array", () => {
        const b1 = new Variant({ dataType: DataType.SByte, arrayType: VariantArrayType.Array, value: [1, 1] });
        const b1c = new Variant({ dataType: DataType.SByte, arrayType: VariantArrayType.Array, value: [1, 1] });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type SByte array", () => {
        const b1 = new Variant({ dataType: DataType.SByte, arrayType: VariantArrayType.Array, value: [1, 1] });
        const b2 = new Variant({ dataType: DataType.SByte, arrayType: VariantArrayType.Array, value: [1, 2] });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type SByte matrix", () => {
        const b1 = new Variant({
            dataType: DataType.SByte,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        const b1c = new Variant({
            dataType: DataType.SByte,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type SByte matrix", () => {
        const b1 = new Variant({
            dataType: DataType.SByte,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        const b2 = new Variant({
            dataType: DataType.SByte,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 0, 6]
        });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type Int16", () => {
        const b1 = new Variant({ dataType: DataType.Int16, arrayType: VariantArrayType.Scalar, value: 1 });
        const b1c = new Variant({ dataType: DataType.Int16, arrayType: VariantArrayType.Scalar, value: 1 });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type Int16", () => {
        const b1 = new Variant({ dataType: DataType.Int16, arrayType: VariantArrayType.Scalar, value: 1 });
        const b2 = new Variant({ dataType: DataType.Int16, arrayType: VariantArrayType.Scalar, value: 2 });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type Int16 array", () => {
        const b1 = new Variant({ dataType: DataType.Int16, arrayType: VariantArrayType.Array, value: [1, 1] });
        const b1c = new Variant({ dataType: DataType.Int16, arrayType: VariantArrayType.Array, value: [1, 1] });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type Int16 array", () => {
        const b1 = new Variant({ dataType: DataType.Int16, arrayType: VariantArrayType.Array, value: [1, 1] });
        const b2 = new Variant({ dataType: DataType.Int16, arrayType: VariantArrayType.Array, value: [1, 2] });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type Int16 matrix", () => {
        const b1 = new Variant({
            dataType: DataType.Int16,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        const b1c = new Variant({
            dataType: DataType.Int16,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type Int16 matrix", () => {
        const b1 = new Variant({
            dataType: DataType.Int16,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        const b2 = new Variant({
            dataType: DataType.Int16,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 0, 6]
        });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type Int32", () => {
        const b1 = new Variant({ dataType: DataType.Int32, arrayType: VariantArrayType.Scalar, value: 1 });
        const b1c = new Variant({ dataType: DataType.Int32, arrayType: VariantArrayType.Scalar, value: 1 });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type Int32", () => {
        const b1 = new Variant({ dataType: DataType.Int32, arrayType: VariantArrayType.Scalar, value: 1 });
        const b2 = new Variant({ dataType: DataType.Int32, arrayType: VariantArrayType.Scalar, value: 2 });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type Int32 array", () => {
        const b1 = new Variant({ dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: [1, 1] });
        const b1c = new Variant({ dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: [1, 1] });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type Int32 array", () => {
        const b1 = new Variant({ dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: [1, 1] });
        const b2 = new Variant({ dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: [1, 2] });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type Int32 matrix", () => {
        const b1 = new Variant({
            dataType: DataType.Int32,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        const b1c = new Variant({
            dataType: DataType.Int32,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type Int32 matrix", () => {
        const b1 = new Variant({
            dataType: DataType.Int32,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        const b2 = new Variant({
            dataType: DataType.Int32,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 0, 6]
        });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type Int64", () => {
        const b1 = new Variant({ dataType: DataType.Int64, arrayType: VariantArrayType.Scalar, value: [1, 0] });
        const b1c = new Variant({ dataType: DataType.Int64, arrayType: VariantArrayType.Scalar, value: [1, 0] });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type Int64", () => {
        const b1 = new Variant({ dataType: DataType.Int64, arrayType: VariantArrayType.Scalar, value: [1, 0] });
        const b2 = new Variant({ dataType: DataType.Int64, arrayType: VariantArrayType.Scalar, value: [1, 1] });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type Int64 array", () => {
        const b1 = new Variant({ dataType: DataType.Int64, arrayType: VariantArrayType.Array, value: [1, 1] });
        const b1c = new Variant({ dataType: DataType.Int64, arrayType: VariantArrayType.Array, value: [1, 1] });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type Int64 array", () => {
        const b1 = new Variant({ dataType: DataType.Int64, arrayType: VariantArrayType.Array, value: [1, 1] });
        const b2 = new Variant({ dataType: DataType.Int64, arrayType: VariantArrayType.Array, value: [1, 2] });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type Int64 matrix", () => {
        const b1 = new Variant({
            dataType: DataType.Int64,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [
                [1, 1],
                [1, 1],
                [1, 1],
                [1, 1],
                [1, 1],
                [1, 1]
            ]
        });
        const b1c = new Variant({
            dataType: DataType.Int64,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [
                [1, 1],
                [1, 1],
                [1, 1],
                [1, 1],
                [1, 1],
                [1, 1]
            ]
        });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type Int64 matrix", () => {
        const b1 = new Variant({
            dataType: DataType.Int64,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [
                [1, 1],
                [1, 1],
                [1, 1],
                [1, 1],
                [1, 1],
                [1, 1]
            ]
        });
        const b2 = new Variant({
            dataType: DataType.Int64,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [
                [1, 2],
                [1, 1],
                [1, 1],
                [1, 1],
                [1, 1],
                [1, 1]
            ]
        });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type UInt16", () => {
        const b1 = new Variant({ dataType: DataType.UInt16, arrayType: VariantArrayType.Scalar, value: 1 });
        const b1c = new Variant({ dataType: DataType.UInt16, arrayType: VariantArrayType.Scalar, value: 1 });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type UInt16", () => {
        const b1 = new Variant({ dataType: DataType.UInt16, arrayType: VariantArrayType.Scalar, value: 1 });
        const b2 = new Variant({ dataType: DataType.UInt16, arrayType: VariantArrayType.Scalar, value: 2 });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type UInt16 array", () => {
        const b1 = new Variant({ dataType: DataType.UInt16, arrayType: VariantArrayType.Array, value: [1, 1] });
        const b1c = new Variant({ dataType: DataType.UInt16, arrayType: VariantArrayType.Array, value: [1, 1] });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type UInt16 array", () => {
        const b1 = new Variant({ dataType: DataType.UInt16, arrayType: VariantArrayType.Array, value: [1, 1] });
        const b2 = new Variant({ dataType: DataType.UInt16, arrayType: VariantArrayType.Array, value: [1, 2] });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type UInt16 matrix", () => {
        const b1 = new Variant({
            dataType: DataType.UInt16,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        const b1c = new Variant({
            dataType: DataType.UInt16,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type UInt16 matrix", () => {
        const b1 = new Variant({
            dataType: DataType.UInt16,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        const b2 = new Variant({
            dataType: DataType.UInt16,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 0, 6]
        });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type UInt32", () => {
        const b1 = new Variant({ dataType: DataType.UInt32, arrayType: VariantArrayType.Scalar, value: 1 });
        const b1c = new Variant({ dataType: DataType.UInt32, arrayType: VariantArrayType.Scalar, value: 1 });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type UInt32", () => {
        const b1 = new Variant({ dataType: DataType.UInt32, arrayType: VariantArrayType.Scalar, value: 1 });
        const b2 = new Variant({ dataType: DataType.UInt32, arrayType: VariantArrayType.Scalar, value: 2 });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type UInt32 array", () => {
        const b1 = new Variant({ dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: [1, 1] });
        const b1c = new Variant({ dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: [1, 1] });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type UInt32 array", () => {
        const b1 = new Variant({ dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: [1, 1] });
        const b2 = new Variant({ dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: [1, 2] });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type UInt32 matrix", () => {
        const b1 = new Variant({
            dataType: DataType.UInt32,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        const b1c = new Variant({
            dataType: DataType.UInt32,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type UInt32 matrix", () => {
        const b1 = new Variant({
            dataType: DataType.UInt32,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        const b2 = new Variant({
            dataType: DataType.UInt32,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 0, 6]
        });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type UInt64", () => {
        const b1 = new Variant({ dataType: DataType.UInt64, arrayType: VariantArrayType.Scalar, value: [1, 0] });
        const b1c = new Variant({ dataType: DataType.UInt64, arrayType: VariantArrayType.Scalar, value: [1, 0] });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type UInt64", () => {
        const b1 = new Variant({ dataType: DataType.UInt64, arrayType: VariantArrayType.Scalar, value: [1, 0] });
        const b2 = new Variant({ dataType: DataType.UInt64, arrayType: VariantArrayType.Scalar, value: [1, 1] });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type UInt64 array", () => {
        const b1 = new Variant({ dataType: DataType.UInt64, arrayType: VariantArrayType.Array, value: [1, 1] });
        const b1c = new Variant({ dataType: DataType.UInt64, arrayType: VariantArrayType.Array, value: [1, 1] });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type UInt64 array", () => {
        const b1 = new Variant({ dataType: DataType.UInt64, arrayType: VariantArrayType.Array, value: [1, 1] });
        const b2 = new Variant({ dataType: DataType.UInt64, arrayType: VariantArrayType.Array, value: [1, 2] });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type UInt64 matrix", () => {
        const b1 = new Variant({
            dataType: DataType.UInt64,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [
                [1, 1],
                [1, 1],
                [1, 1],
                [1, 1],
                [1, 1],
                [1, 1]
            ]
        });
        const b1c = new Variant({
            dataType: DataType.UInt64,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [
                [1, 1],
                [1, 1],
                [1, 1],
                [1, 1],
                [1, 1],
                [1, 1]
            ]
        });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type UInt64 matrix", () => {
        const b1 = new Variant({
            dataType: DataType.UInt64,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [
                [1, 1],
                [1, 1],
                [1, 1],
                [1, 1],
                [1, 1],
                [1, 1]
            ]
        });
        const b2 = new Variant({
            dataType: DataType.UInt64,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [
                [1, 2],
                [1, 1],
                [1, 1],
                [1, 1],
                [1, 1],
                [1, 1]
            ]
        });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type Float", () => {
        const b1 = new Variant({ dataType: DataType.Float, arrayType: VariantArrayType.Scalar, value: 1 });
        const b1c = new Variant({ dataType: DataType.Float, arrayType: VariantArrayType.Scalar, value: 1 });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type Float", () => {
        const b1 = new Variant({ dataType: DataType.Float, arrayType: VariantArrayType.Scalar, value: 1 });
        const b2 = new Variant({ dataType: DataType.Float, arrayType: VariantArrayType.Scalar, value: 2 });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type Float array", () => {
        const b1 = new Variant({ dataType: DataType.Float, arrayType: VariantArrayType.Array, value: [1, 1] });
        const b1c = new Variant({ dataType: DataType.Float, arrayType: VariantArrayType.Array, value: [1, 1] });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type Float array", () => {
        const b1 = new Variant({ dataType: DataType.Float, arrayType: VariantArrayType.Array, value: [1, 1] });
        const b2 = new Variant({ dataType: DataType.Float, arrayType: VariantArrayType.Array, value: [1, 2] });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type Float matrix", () => {
        const b1 = new Variant({
            dataType: DataType.Float,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        const b1c = new Variant({
            dataType: DataType.Float,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type Float matrix", () => {
        const b1 = new Variant({
            dataType: DataType.Float,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        const b2 = new Variant({
            dataType: DataType.Float,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 0, 6]
        });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type Double", () => {
        const b1 = new Variant({ dataType: DataType.Double, arrayType: VariantArrayType.Scalar, value: 1 });
        const b1c = new Variant({ dataType: DataType.Double, arrayType: VariantArrayType.Scalar, value: 1 });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type Double", () => {
        const b1 = new Variant({ dataType: DataType.Double, arrayType: VariantArrayType.Scalar, value: 1 });
        const b2 = new Variant({ dataType: DataType.Double, arrayType: VariantArrayType.Scalar, value: 2 });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type Double array", () => {
        const b1 = new Variant({ dataType: DataType.Double, arrayType: VariantArrayType.Array, value: [1, 1] });
        const b1c = new Variant({ dataType: DataType.Double, arrayType: VariantArrayType.Array, value: [1, 1] });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type Double array", () => {
        const b1 = new Variant({ dataType: DataType.Double, arrayType: VariantArrayType.Array, value: [1, 1] });
        const b2 = new Variant({ dataType: DataType.Double, arrayType: VariantArrayType.Array, value: [1, 2] });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type Double matrix", () => {
        const b1 = new Variant({
            dataType: DataType.Double,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        const b1c = new Variant({
            dataType: DataType.Double,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type Double matrix", () => {
        const b1 = new Variant({
            dataType: DataType.Double,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6]
        });
        const b2 = new Variant({
            dataType: DataType.Double,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 0, 6]
        });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type String", () => {
        const b1 = new Variant({ dataType: DataType.String, arrayType: VariantArrayType.Scalar, value: "Hello" });
        const b1c = new Variant({ dataType: DataType.String, arrayType: VariantArrayType.Scalar, value: "Hello" });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type String", () => {
        const b1 = new Variant({ dataType: DataType.String, arrayType: VariantArrayType.Scalar, value: "Hello" });
        const b2 = new Variant({ dataType: DataType.String, arrayType: VariantArrayType.Scalar, value: "Helloo" });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type String array", () => {
        const b1 = new Variant({
            dataType: DataType.String,
            arrayType: VariantArrayType.Array,
            value: ["Hello", "world"]
        });
        const b1c = new Variant({
            dataType: DataType.String,
            arrayType: VariantArrayType.Array,
            value: ["Hello", "world"]
        });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type String array", () => {
        const b1 = new Variant({
            dataType: DataType.String,
            arrayType: VariantArrayType.Array,
            value: ["Hello", "world"]
        });
        const b2 = new Variant({
            dataType: DataType.String,
            arrayType: VariantArrayType.Array,
            value: ["Hello", "woorld"]
        });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type String matrix", () => {
        const b1 = new Variant({
            dataType: DataType.String,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: ["this", "is", "a", "2x3", "dimension", "matrix"]
        });
        const b1c = new Variant({
            dataType: DataType.String,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: ["this", "is", "a", "2x3", "dimension", "matrix"]
        });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type String matrix", () => {
        const b1 = new Variant({
            dataType: DataType.String,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: ["this", "is", "a", "2x3", "dimension", "matrix"]
        });
        const b2 = new Variant({
            dataType: DataType.String,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: ["this", "is", "a", "2x3", "dimension", "maatrix"]
        });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type ByteString", () => {
        const b1 = new Variant({
            dataType: DataType.ByteString,
            arrayType: VariantArrayType.Scalar,
            value: Buffer.from([1, 2, 3])
        });
        const b1c = new Variant({
            dataType: DataType.ByteString,
            arrayType: VariantArrayType.Scalar,
            value: Buffer.from([1, 2, 3])
        });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type ByteString", () => {
        const b1 = new Variant({
            dataType: DataType.ByteString,
            arrayType: VariantArrayType.Scalar,
            value: Buffer.from([1, 2, 3])
        });
        const b2 = new Variant({
            dataType: DataType.ByteString,
            arrayType: VariantArrayType.Scalar,
            value: Buffer.from([1, 2, 4])
        });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type ByteString array", () => {
        const b1 = new Variant({
            dataType: DataType.ByteString,
            arrayType: VariantArrayType.Array,
            value: [Buffer.from([1, 2, 3]), Buffer.from([1, 2, 3])]
        });
        const b1c = new Variant({
            dataType: DataType.ByteString,
            arrayType: VariantArrayType.Array,
            value: [Buffer.from([1, 2, 3]), Buffer.from([1, 2, 3])]
        });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type ByteString array", () => {
        const b1 = new Variant({
            dataType: DataType.ByteString,
            arrayType: VariantArrayType.Array,
            value: [Buffer.from([1, 2, 3]), Buffer.from([1, 2, 3])]
        });
        const b2 = new Variant({
            dataType: DataType.ByteString,
            arrayType: VariantArrayType.Array,
            value: [Buffer.from([1, 2, 4 /* spot the diff here !*/]), Buffer.from([1, 2, 4 /* spot the diff here !*/])]
        });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing same variants of type ByteString matrix", () => {
        const b1 = new Variant({
            dataType: DataType.ByteString,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [
                Buffer.from([1, 2, 3]),
                Buffer.from([4, 5, 6]),
                Buffer.from([7, 8, 9]),
                Buffer.from([10, 11, 12]),
                Buffer.from([13, 14, 15]),
                Buffer.from([16, 17, 18])
            ]
        });
        const b1c = new Variant({
            dataType: DataType.ByteString,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [
                Buffer.from([1, 2, 3]),
                Buffer.from([4, 5, 6]),
                Buffer.from([7, 8, 9]),
                Buffer.from([10, 11, 12]),
                Buffer.from([13, 14, 15]),
                Buffer.from([16, 17, 18])
            ]
        });
        sameVariant(b1, b1c).should.equal(true);
    });

    it("testing different variants of type ByteString matrix", () => {
        const b1 = new Variant({
            dataType: DataType.ByteString,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [
                Buffer.from([1, 2, 3]),
                Buffer.from([4, 5, 6]),
                Buffer.from([7, 8, 9]),
                Buffer.from([10, 11, 12]),
                Buffer.from([13, 14, 15]),
                Buffer.from([16, 17, 18])
            ]
        });
        const b2 = new Variant({
            dataType: DataType.ByteString,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [
                Buffer.from([1, 2, 3]),
                Buffer.from([4, 5, 6]),
                Buffer.from([7, 8, 9]),
                Buffer.from([10, 11, 12]),
                Buffer.from([13, 0, 15]),
                Buffer.from([16, 17, 18])
            ]
        });
        sameVariant(b1, b2).should.equal(false);
    });

    it("testing difference variant matrix with different dimension", () => {
        const b1 = new Variant({
            dataType: DataType.ByteString,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [
                Buffer.from([1, 2, 3]),
                Buffer.from([4, 5, 6]),
                Buffer.from([7, 8, 9]),
                Buffer.from([10, 11, 12]),
                Buffer.from([13, 14, 15]),
                Buffer.from([16, 17, 18])
            ]
        });
        const b2 = new Variant({
            dataType: DataType.ByteString,
            arrayType: VariantArrayType.Matrix,
            dimensions: [3, 2],
            value: [
                Buffer.from([1, 2, 3]),
                Buffer.from([4, 5, 6]),
                Buffer.from([7, 8, 9]),
                Buffer.from([10, 11, 12]),
                Buffer.from([13, 14, 15]),
                Buffer.from([16, 17, 18])
            ]
        });
        sameVariant(b1, b2).should.equal(false);
    });
    it("testing  variants with empty array", () => {
        const b1 = new Variant({ dataType: DataType.ByteString, arrayType: VariantArrayType.Array, value: [] });
        const b2 = new Variant({ dataType: DataType.ByteString, arrayType: VariantArrayType.Array, value: [] });
        sameVariant(b1, b2).should.equal(true);
    });

    it("testing  variants with string array", () => {
        const b1 = new Variant({
            dataType: DataType.String,
            arrayType: VariantArrayType.Array,
            value: buildVariantArray(DataType.String, 3, "Hello")
        });
        const b2 = new Variant({
            dataType: DataType.String,
            arrayType: VariantArrayType.Array,
            value: buildVariantArray(DataType.String, 3, "Hello")
        });
        sameVariant(b1, b2).should.equal(true);
    });

    function test(dataType: DataType) {
        const b1 = new Variant({
            dataType,
            arrayType: VariantArrayType.Array,
            value: buildVariantArray(dataType, 3, 123)
        });
        const b2 = new Variant({
            dataType: DataType.SByte,
            arrayType: VariantArrayType.Array,
            value: buildVariantArray(DataType.SByte, 3, 1)
        });
        sameVariant(b1, b2).should.equal(false);
    }
    it("testing  variants with SByte array", () => {
        test(DataType.SByte);
    });
    it("testing  variants with Byte array", () => {
        test(DataType.Byte);
    });
    it("testing  variants with UInt16 array", () => {
        test(DataType.UInt16);
    });
    it("testing  variants with Int16 array", () => {
        test(DataType.Int16);
    });
    it("testing  variants with UInt32 array", () => {
        test(DataType.UInt32);
    });
    it("testing  variants with Int32 array", () => {
        test(DataType.Int32);
    });
    it("testing  variants with Float array", () => {
        test(DataType.Float);
    });
    it("testing  variants with Double array", () => {
        test(DataType.Double);
    });

    class SomeExtensionObjectA extends ExtensionObject {
        public a: number;
        constructor(options: { a: number }) {
            super();
            this.a = options.a;
        }
    }
    class SomeExtensionObjectB extends ExtensionObject {
        public a: unknown;
        constructor(options: { a: unknown }) {
            super();
            this.a = options.a;
        }
    }
    /// same variant with extension object
    it("sameVariant with extension objects - 1", () => {
        const ext1 = new SomeExtensionObjectA({ a: 32 });
        const ext2 = new SomeExtensionObjectA({ a: 32 });

        const b1 = new Variant({ dataType: DataType.ExtensionObject, value: ext1 });
        const b2 = new Variant({ dataType: DataType.ExtensionObject, value: ext2 });

        sameVariant(b1, b2).should.eql(true);
    });
    it("sameVariant with extension objects - 2", () => {
        const ext1 = new SomeExtensionObjectA({ a: 32 });
        const ext2 = new SomeExtensionObjectA({ a: 10000 });

        const b1 = new Variant({ dataType: DataType.ExtensionObject, value: ext1 });
        const b2 = new Variant({ dataType: DataType.ExtensionObject, value: ext2 });

        sameVariant(b1, b2).should.eql(false);
    });
    it("sameVariant with extension objects - 3", () => {
        const ext1 = new SomeExtensionObjectA({ a: 32 });
        const ext2 = new SomeExtensionObjectB({ a: 32 });

        const b1 = new Variant({ dataType: DataType.ExtensionObject, value: ext1 });
        const b2 = new Variant({ dataType: DataType.ExtensionObject, value: ext2 });

        sameVariant(b1, b2).should.eql(false);
    });
    it("sameVariant with array of Extension objects - 4", () => {
        const ext1 = new SomeExtensionObjectA({ a: 32 });
        const _ext2 = new SomeExtensionObjectB({ a: 32 });

        const b1 = new Variant({ dataType: DataType.ExtensionObject, arrayType: VariantArrayType.Array, value: [ext1] });
        const b2 = new Variant({ dataType: DataType.ExtensionObject, arrayType: VariantArrayType.Array, value: null });

        sameVariant(b1, b2).should.eql(false);
    });
    it("sameVariant with array of Extension objects - 5", () => {
        const ext1 = new SomeExtensionObjectA({ a: 32 });
        const ext2 = new SomeExtensionObjectB({ a: 32 });

        const b1 = new Variant({ dataType: DataType.ExtensionObject, arrayType: VariantArrayType.Array, value: [ext1] });
        const b2 = new Variant({ dataType: DataType.ExtensionObject, arrayType: VariantArrayType.Array, value: [ext2] });

        sameVariant(b1, b2).should.eql(false);
    });
    it("sameVariant with array of Extension objects - 6", () => {
        const ext1 = new SomeExtensionObjectA({ a: 32 });
        const ext2 = new SomeExtensionObjectA({ a: 32 });

        const b1 = new Variant({ dataType: DataType.ExtensionObject, arrayType: VariantArrayType.Array, value: [ext1] });
        const b2 = new Variant({ dataType: DataType.ExtensionObject, arrayType: VariantArrayType.Array, value: [ext2] });

        sameVariant(b1, b2).should.eql(true);
    });
    it("sameVariant with array of Extension objects - 7", () => {
        const ext1 = new SomeExtensionObjectA({ a: 32 });
        const ext2 = new SomeExtensionObjectA({ a: 32 });

        const b1 = new Variant({ dataType: DataType.ExtensionObject, arrayType: VariantArrayType.Array, value: [ext1, ext1] });
        const b2 = new Variant({ dataType: DataType.ExtensionObject, arrayType: VariantArrayType.Array, value: [ext2] });

        sameVariant(b1, b2).should.eql(false);
    });
    it("sameVariant with array of Extension objects - 8", () => {
        const ext1 = new SomeExtensionObjectA({ a: 32 });
        const b1 = new Variant({ dataType: DataType.ExtensionObject, arrayType: VariantArrayType.Array, value: [ext1] });
        const b2 = new Variant({ dataType: DataType.ExtensionObject, arrayType: VariantArrayType.Array, value: [ext1] });

        sameVariant(b1, b2).should.eql(true);
    });

    // ── Coverage for __check_same_object edge cases ──

    it("sameVariant with extension objects having different key counts", () => {
        // Exercises __check_same_object: keys1.length !== keys2.length
        // Both objects must share the same constructor name to pass
        // the check at line 977, so we add an extra key dynamically.
        const ext1 = new SomeExtensionObjectA({ a: 32 });
        const ext2 = new SomeExtensionObjectA({ a: 32 });
        (ext2 as any).extraKey = 99;

        const b1 = new Variant({ dataType: DataType.ExtensionObject, value: ext1 });
        const b2 = new Variant({ dataType: DataType.ExtensionObject, value: ext2 });

        sameVariant(b1, b2).should.eql(false);
    });

    class ExtObjWithBigInt extends ExtensionObject {
        public value: bigint;
        constructor(options: { value: bigint }) {
            super();
            this.value = options.value;
        }
    }

    it("sameVariant with extension objects containing BigInt values - same", () => {
        // Exercises __check_same_object: BigInt comparison branch
        const ext1 = new ExtObjWithBigInt({ value: BigInt(42) });
        const ext2 = new ExtObjWithBigInt({ value: BigInt(42) });

        const b1 = new Variant({ dataType: DataType.ExtensionObject, value: ext1 });
        const b2 = new Variant({ dataType: DataType.ExtensionObject, value: ext2 });

        sameVariant(b1, b2).should.eql(true);
    });

    it("sameVariant with extension objects containing BigInt values - different", () => {
        const ext1 = new ExtObjWithBigInt({ value: BigInt(42) });
        const ext2 = new ExtObjWithBigInt({ value: BigInt(99) });

        const b1 = new Variant({ dataType: DataType.ExtensionObject, value: ext1 });
        const b2 = new Variant({ dataType: DataType.ExtensionObject, value: ext2 });

        sameVariant(b1, b2).should.eql(false);
    });

    class ExtObjWithDate extends ExtensionObject {
        public timestamp: Date;
        constructor(options: { timestamp: Date }) {
            super();
            this.timestamp = options.timestamp;
        }
    }

    it("sameVariant with extension objects containing Date values - same", () => {
        // Exercises __check_same_object: Date comparison branch
        const d = new Date("2025-01-01T00:00:00Z");
        const ext1 = new ExtObjWithDate({ timestamp: new Date(d.getTime()) });
        const ext2 = new ExtObjWithDate({ timestamp: new Date(d.getTime()) });

        const b1 = new Variant({ dataType: DataType.ExtensionObject, value: ext1 });
        const b2 = new Variant({ dataType: DataType.ExtensionObject, value: ext2 });

        sameVariant(b1, b2).should.eql(true);
    });

    it("sameVariant with extension objects containing Date values - different", () => {
        const ext1 = new ExtObjWithDate({ timestamp: new Date("2025-01-01T00:00:00Z") });
        const ext2 = new ExtObjWithDate({ timestamp: new Date("2025-06-15T12:00:00Z") });

        const b1 = new Variant({ dataType: DataType.ExtensionObject, value: ext1 });
        const b2 = new Variant({ dataType: DataType.ExtensionObject, value: ext2 });

        sameVariant(b1, b2).should.eql(false);
    });
});
