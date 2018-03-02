"use strict";
var should = require("should");
var assert = require("node-opcua-assert");
var _ = require("underscore");


var Variant = require("..").Variant;
var DataType = require("..").DataType;
var VariantArrayType = require("..").VariantArrayType;



var sameVariant = require("..").sameVariant;

describe("testing return sameVariant for pull request", function () {
    it('testing same variants of type Boolean', function () {
        var b1 = new Variant({dataType: DataType.Boolean, arrayType: VariantArrayType.Scalar, value: true});
        var b1c = new Variant({dataType: DataType.Boolean, arrayType: VariantArrayType.Scalar, value: true});
        assert(sameVariant(b1,b1c), "should be true");
    });

    it('testing different variants of type Boolean', function () {
        var b1 = new Variant({dataType: DataType.Boolean, arrayType: VariantArrayType.Scalar, value: true});
        var b2 = new Variant({dataType: DataType.Boolean, arrayType: VariantArrayType.Scalar, value: false});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type Boolean array', function () {
        var b1 = new Variant({dataType: DataType.Boolean, arrayType: VariantArrayType.Array, value: [true, false]});
        var b1c = new Variant({dataType: DataType.Boolean, arrayType: VariantArrayType.Array, value: [true, false]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type Boolean array', function () {
        var b1 = new Variant({dataType: DataType.Boolean, arrayType: VariantArrayType.Array, value: [true, false]});
        var b2 = new Variant({dataType: DataType.Boolean, arrayType: VariantArrayType.Array, value: [true, true]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type Boolean matrix', function () {
        var b1 = new Variant({dataType: DataType.Boolean, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [true, true, true, true, true, true]});
        var b1c = new Variant({dataType: DataType.Boolean, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [true, true, true, true, true, true]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type Boolean matrix', function () {
        var b1 = new Variant({dataType: DataType.Boolean, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [true, true, true, true, true, true]});
        var b2 = new Variant({dataType: DataType.Boolean, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [true, true, true, true, true, false]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type Byte', function () {
        var b1 = new Variant({dataType: DataType.Byte, arrayType: VariantArrayType.Scalar, value: 1});
        var b1c = new Variant({dataType: DataType.Byte, arrayType: VariantArrayType.Scalar, value: 1});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type Byte', function () {
        var b1 = new Variant({dataType: DataType.Byte, arrayType: VariantArrayType.Scalar, value: 1});
        var b2 = new Variant({dataType: DataType.Byte, arrayType: VariantArrayType.Scalar, value: 2});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type Byte array', function () {
        var b1 = new Variant({dataType: DataType.Byte, arrayType: VariantArrayType.Array, value: [1, 1]});
        var b1c = new Variant({dataType: DataType.Byte, arrayType: VariantArrayType.Array, value: [1, 1]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type Byte array', function () {
        var b1 = new Variant({dataType: DataType.Byte, arrayType: VariantArrayType.Array, value: [1, 1]});
        var b2 = new Variant({dataType: DataType.Byte, arrayType: VariantArrayType.Array, value: [1, 2]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type Byte matrix', function () {
        var b1 = new Variant({dataType: DataType.Byte, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        var b1c = new Variant({dataType: DataType.Byte, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type Byte matrix', function () {
        var b1 = new Variant({dataType: DataType.Byte, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        var b2 = new Variant({dataType: DataType.Byte, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 0, 6]});
        sameVariant(b1,b2).should.equal(false);
    });
    
    it('testing same variants of type SByte', function () {
        var b1 = new Variant({dataType: DataType.SByte, arrayType: VariantArrayType.Scalar, value: 1});
        var b1c = new Variant({dataType: DataType.SByte, arrayType: VariantArrayType.Scalar, value: 1});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type SByte', function () {
        var b1 = new Variant({dataType: DataType.SByte, arrayType: VariantArrayType.Scalar, value: 1});
        var b2 = new Variant({dataType: DataType.SByte, arrayType: VariantArrayType.Scalar, value: 2});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type SByte array', function () {
        var b1 = new Variant({dataType: DataType.SByte, arrayType: VariantArrayType.Array, value: [1, 1]});
        var b1c = new Variant({dataType: DataType.SByte, arrayType: VariantArrayType.Array, value: [1, 1]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type SByte array', function () {
        var b1 = new Variant({dataType: DataType.SByte, arrayType: VariantArrayType.Array, value: [1, 1]});
        var b2 = new Variant({dataType: DataType.SByte, arrayType: VariantArrayType.Array, value: [1, 2]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type SByte matrix', function () {
        var b1 = new Variant({dataType: DataType.SByte, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        var b1c = new Variant({dataType: DataType.SByte, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type SByte matrix', function () {
        var b1 = new Variant({dataType: DataType.SByte, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        var b2 = new Variant({dataType: DataType.SByte, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 0, 6]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type Int16', function () {
        var b1 = new Variant({dataType: DataType.Int16, arrayType: VariantArrayType.Scalar, value: 1});
        var b1c = new Variant({dataType: DataType.Int16, arrayType: VariantArrayType.Scalar, value: 1});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type Int16', function () {
        var b1 = new Variant({dataType: DataType.Int16, arrayType: VariantArrayType.Scalar, value: 1});
        var b2 = new Variant({dataType: DataType.Int16, arrayType: VariantArrayType.Scalar, value: 2});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type Int16 array', function () {
        var b1 = new Variant({dataType: DataType.Int16, arrayType: VariantArrayType.Array, value: [1, 1]});
        var b1c = new Variant({dataType: DataType.Int16, arrayType: VariantArrayType.Array, value: [1, 1]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type Int16 array', function () {
        var b1 = new Variant({dataType: DataType.Int16, arrayType: VariantArrayType.Array, value: [1, 1]});
        var b2 = new Variant({dataType: DataType.Int16, arrayType: VariantArrayType.Array, value: [1, 2]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type Int16 matrix', function () {
        var b1 = new Variant({dataType: DataType.Int16, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        var b1c = new Variant({dataType: DataType.Int16, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type Int16 matrix', function () {
        var b1 = new Variant({dataType: DataType.Int16, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        var b2 = new Variant({dataType: DataType.Int16, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 0, 6]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type Int32', function () {
        var b1 = new Variant({dataType: DataType.Int32, arrayType: VariantArrayType.Scalar, value: 1});
        var b1c = new Variant({dataType: DataType.Int32, arrayType: VariantArrayType.Scalar, value: 1});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type Int32', function () {
        var b1 = new Variant({dataType: DataType.Int32, arrayType: VariantArrayType.Scalar, value: 1});
        var b2 = new Variant({dataType: DataType.Int32, arrayType: VariantArrayType.Scalar, value: 2});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type Int32 array', function () {
        var b1 = new Variant({dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: [1, 1]});
        var b1c = new Variant({dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: [1, 1]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type Int32 array', function () {
        var b1 = new Variant({dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: [1, 1]});
        var b2 = new Variant({dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: [1, 2]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type Int32 matrix', function () {
        var b1 = new Variant({dataType: DataType.Int32, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        var b1c = new Variant({dataType: DataType.Int32, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type Int32 matrix', function () {
        var b1 = new Variant({dataType: DataType.Int32, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        var b2 = new Variant({dataType: DataType.Int32, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 0, 6]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type Int64', function () {
        var b1 = new Variant({dataType: DataType.Int64, arrayType: VariantArrayType.Scalar, value: [1,0]});
        var b1c = new Variant({dataType: DataType.Int64, arrayType: VariantArrayType.Scalar, value: [1,0]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type Int64', function () {
        var b1 = new Variant({dataType: DataType.Int64, arrayType: VariantArrayType.Scalar, value: [1,0]});
        var b2 = new Variant({dataType: DataType.Int64, arrayType: VariantArrayType.Scalar, value: [1,1]});
       sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type Int64 array', function () {
        var b1 = new Variant({dataType: DataType.Int64, arrayType: VariantArrayType.Array, value: [1, 1]});
        var b1c = new Variant({dataType: DataType.Int64, arrayType: VariantArrayType.Array, value: [1, 1]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type Int64 array', function () {
        var b1 = new Variant({dataType: DataType.Int64, arrayType: VariantArrayType.Array, value: [1, 1]});
        var b2 = new Variant({dataType: DataType.Int64, arrayType: VariantArrayType.Array, value: [1, 2]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type Int64 matrix', function () {
        var b1 = new Variant({dataType: DataType.Int64, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [[1,1], [1,1], [1,1], [1,1], [1,1], [1,1]]});
        var b1c = new Variant({dataType: DataType.Int64, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [[1,1], [1,1], [1,1], [1,1], [1,1], [1,1]]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type Int64 matrix', function () {
        var b1 = new Variant({dataType: DataType.Int64, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [[1,1], [1,1], [1,1], [1,1], [1,1], [1,1]]});
        var b2 = new Variant({dataType: DataType.Int64, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [[1,2], [1,1], [1,1], [1,1], [1,1], [1,1]]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type UInt16', function () {
        var b1 = new Variant({dataType: DataType.UInt16, arrayType: VariantArrayType.Scalar, value: 1});
        var b1c = new Variant({dataType: DataType.UInt16, arrayType: VariantArrayType.Scalar, value: 1});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type UInt16', function () {
        var b1 = new Variant({dataType: DataType.UInt16, arrayType: VariantArrayType.Scalar, value: 1});
        var b2 = new Variant({dataType: DataType.UInt16, arrayType: VariantArrayType.Scalar, value: 2});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type UInt16 array', function () {
        var b1 = new Variant({dataType: DataType.UInt16, arrayType: VariantArrayType.Array, value: [1, 1]});
        var b1c = new Variant({dataType: DataType.UInt16, arrayType: VariantArrayType.Array, value: [1, 1]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type UInt16 array', function () {
        var b1 = new Variant({dataType: DataType.UInt16, arrayType: VariantArrayType.Array, value: [1, 1]});
        var b2 = new Variant({dataType: DataType.UInt16, arrayType: VariantArrayType.Array, value: [1, 2]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type UInt16 matrix', function () {
        var b1 = new Variant({dataType: DataType.UInt16, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        var b1c = new Variant({dataType: DataType.UInt16, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type UInt16 matrix', function () {
        var b1 = new Variant({dataType: DataType.UInt16, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        var b2 = new Variant({dataType: DataType.UInt16, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 0, 6]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type UInt32', function () {
        var b1 = new Variant({dataType: DataType.UInt32, arrayType: VariantArrayType.Scalar, value: 1});
        var b1c = new Variant({dataType: DataType.UInt32, arrayType: VariantArrayType.Scalar, value: 1});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type UInt32', function () {
        var b1 = new Variant({dataType: DataType.UInt32, arrayType: VariantArrayType.Scalar, value: 1});
        var b2 = new Variant({dataType: DataType.UInt32, arrayType: VariantArrayType.Scalar, value: 2});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type UInt32 array', function () {
        var b1 = new Variant({dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: [1, 1]});
        var b1c = new Variant({dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: [1, 1]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type UInt32 array', function () {
        var b1 = new Variant({dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: [1, 1]});
        var b2 = new Variant({dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: [1, 2]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type UInt32 matrix', function () {
        var b1 = new Variant({dataType: DataType.UInt32, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        var b1c = new Variant({dataType: DataType.UInt32, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type UInt32 matrix', function () {
        var b1 = new Variant({dataType: DataType.UInt32, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        var b2 = new Variant({dataType: DataType.UInt32, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 0, 6]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type UInt64', function () {
        var b1 = new Variant({dataType: DataType.UInt64, arrayType: VariantArrayType.Scalar, value: [1,0]});
        var b1c = new Variant({dataType: DataType.UInt64, arrayType: VariantArrayType.Scalar, value: [1,0]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type UInt64', function () {
        var b1 = new Variant({dataType: DataType.UInt64, arrayType: VariantArrayType.Scalar, value: [1,0]});
        var b2 = new Variant({dataType: DataType.UInt64, arrayType: VariantArrayType.Scalar, value: [1,1]});
       sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type UInt64 array', function () {
        var b1 = new Variant({dataType: DataType.UInt64, arrayType: VariantArrayType.Array, value: [1, 1]});
        var b1c = new Variant({dataType: DataType.UInt64, arrayType: VariantArrayType.Array, value: [1, 1]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type UInt64 array', function () {
        var b1 = new Variant({dataType: DataType.UInt64, arrayType: VariantArrayType.Array, value: [1, 1]});
        var b2 = new Variant({dataType: DataType.UInt64, arrayType: VariantArrayType.Array, value: [1, 2]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type UInt64 matrix', function () {
        var b1 = new Variant({dataType: DataType.UInt64, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [[1,1], [1,1], [1,1], [1,1], [1,1], [1,1]]});
        var b1c = new Variant({dataType: DataType.UInt64, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [[1,1], [1,1], [1,1], [1,1], [1,1], [1,1]]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type UInt64 matrix', function () {
        var b1 = new Variant({dataType: DataType.UInt64, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [[1,1], [1,1], [1,1], [1,1], [1,1], [1,1]]});
        var b2 = new Variant({dataType: DataType.UInt64, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [[1,2], [1,1], [1,1], [1,1], [1,1], [1,1]]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type Float', function () {
        var b1 = new Variant({dataType: DataType.Float, arrayType: VariantArrayType.Scalar, value: 1});
        var b1c = new Variant({dataType: DataType.Float, arrayType: VariantArrayType.Scalar, value: 1});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type Float', function () {
        var b1 = new Variant({dataType: DataType.Float, arrayType: VariantArrayType.Scalar, value: 1});
        var b2 = new Variant({dataType: DataType.Float, arrayType: VariantArrayType.Scalar, value: 2});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type Float array', function () {
        var b1 = new Variant({dataType: DataType.Float, arrayType: VariantArrayType.Array, value: [1, 1]});
        var b1c = new Variant({dataType: DataType.Float, arrayType: VariantArrayType.Array, value: [1, 1]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type Float array', function () {
        var b1 = new Variant({dataType: DataType.Float, arrayType: VariantArrayType.Array, value: [1, 1]});
        var b2 = new Variant({dataType: DataType.Float, arrayType: VariantArrayType.Array, value: [1, 2]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type Float matrix', function () {
        var b1 = new Variant({dataType: DataType.Float, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        var b1c = new Variant({dataType: DataType.Float, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type Float matrix', function () {
        var b1 = new Variant({dataType: DataType.Float, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        var b2 = new Variant({dataType: DataType.Float, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 0, 6]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type Double', function () {
        var b1 = new Variant({dataType: DataType.Double, arrayType: VariantArrayType.Scalar, value: 1});
        var b1c = new Variant({dataType: DataType.Double, arrayType: VariantArrayType.Scalar, value: 1});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type Double', function () {
        var b1 = new Variant({dataType: DataType.Double, arrayType: VariantArrayType.Scalar, value: 1});
        var b2 = new Variant({dataType: DataType.Double, arrayType: VariantArrayType.Scalar, value: 2});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type Double array', function () {
        var b1 = new Variant({dataType: DataType.Double, arrayType: VariantArrayType.Array, value: [1, 1]});
        var b1c = new Variant({dataType: DataType.Double, arrayType: VariantArrayType.Array, value: [1, 1]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type Double array', function () {
        var b1 = new Variant({dataType: DataType.Double, arrayType: VariantArrayType.Array, value: [1, 1]});
        var b2 = new Variant({dataType: DataType.Double, arrayType: VariantArrayType.Array, value: [1, 2]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type Double matrix', function () {
        var b1 = new Variant({dataType: DataType.Double, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        var b1c = new Variant({dataType: DataType.Double, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type Double matrix', function () {
        var b1 = new Variant({dataType: DataType.Double, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 5, 6]});
        var b2 = new Variant({dataType: DataType.Double, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [1, 2, 3, 4, 0, 6]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type String', function () {
        var b1 = new Variant({dataType: DataType.String, arrayType: VariantArrayType.Scalar, value: "Hello"});
        var b1c = new Variant({dataType: DataType.String, arrayType: VariantArrayType.Scalar, value: "Hello"});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type String', function () {
        var b1 = new Variant({dataType: DataType.String, arrayType: VariantArrayType.Scalar, value: "Hello"});
        var b2 = new Variant({dataType: DataType.String, arrayType: VariantArrayType.Scalar, value: "Helloo"});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type String array', function () {
        var b1 = new Variant({dataType: DataType.String, arrayType: VariantArrayType.Array, value: ["Hello", "world"]});
        var b1c = new Variant({dataType: DataType.String, arrayType: VariantArrayType.Array, value: ["Hello", "world"]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type String array', function () {
        var b1 = new Variant({dataType: DataType.String, arrayType: VariantArrayType.Array, value: ["Hello", "world"]});
        var b2 = new Variant({dataType: DataType.String, arrayType: VariantArrayType.Array, value: ["Hello", "woorld"]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type String matrix', function () {
        var b1 = new Variant({dataType: DataType.String, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: ["this","is","a","2x3","dimension","matrix"]});
        var b1c = new Variant({dataType: DataType.String, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: ["this","is","a","2x3","dimension","matrix"]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type String matrix', function () {
        var b1 = new Variant({dataType: DataType.String, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: ["this","is","a","2x3","dimension","matrix"]});
        var b2 = new Variant({dataType: DataType.String, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: ["this","is","a","2x3","dimension","maatrix"]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type ByteString', function () {
        var b1 = new Variant({dataType: DataType.ByteString, arrayType: VariantArrayType.Scalar, value: new Buffer([1,2,3])});
        var b1c = new Variant({dataType: DataType.ByteString, arrayType: VariantArrayType.Scalar, value: new Buffer([1,2,3])});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type ByteString', function () {
        var b1 = new Variant({dataType: DataType.ByteString, arrayType: VariantArrayType.Scalar, value: new Buffer([1,2,3])});
        var b2 = new Variant({dataType: DataType.ByteString, arrayType: VariantArrayType.Scalar, value: new Buffer([1,2,4])});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type ByteString array', function () {
        var b1 = new Variant({dataType: DataType.ByteString, arrayType: VariantArrayType.Array, value: [new Buffer([1,2,3]), new Buffer([1,2,3])]});
        var b1c = new Variant({dataType: DataType.ByteString, arrayType: VariantArrayType.Array, value: [new Buffer([1,2,3]), new Buffer([1,2,3])]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type ByteString array', function () {
        var b1 = new Variant({dataType: DataType.ByteString, arrayType: VariantArrayType.Array, value: [new Buffer([1,2,3]), new Buffer([1,2,3])]});
        var b2 = new Variant({dataType: DataType.ByteString, arrayType: VariantArrayType.Array, value: [new Buffer([1,2,4]), new Buffer([1,2,4])]});
        sameVariant(b1,b2).should.equal(false);
    });

    it('testing same variants of type ByteString matrix', function () {
        var b1 = new Variant({dataType: DataType.ByteString, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [new Buffer([1,2,3]), new Buffer([4,5,6]), new Buffer([7,8,9]), new Buffer([10,11,12]), new Buffer([13,14,15]), new Buffer([16,17,18])]});
        var b1c = new Variant({dataType: DataType.ByteString, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [new Buffer([1,2,3]), new Buffer([4,5,6]), new Buffer([7,8,9]), new Buffer([10,11,12]), new Buffer([13,14,15]), new Buffer([16,17,18])]});
        sameVariant(b1,b1c).should.equal(true);
    });

    it('testing different variants of type ByteString matrix', function () {
        var b1 = new Variant({dataType: DataType.ByteString, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [new Buffer([1,2,3]), new Buffer([4,5,6]), new Buffer([7,8,9]), new Buffer([10,11,12]), new Buffer([13,14,15]), new Buffer([16,17,18])]});
        var b2 = new Variant({dataType: DataType.ByteString, arrayType: VariantArrayType.Matrix, dimensions: [2, 3], value: [new Buffer([1,2,3]), new Buffer([4,5,6]), new Buffer([7,8,9]), new Buffer([10,11,12]), new Buffer([13,0,15]), new Buffer([16,17,18])]});
        sameVariant(b1,b2).should.equal(false);
    });
});
