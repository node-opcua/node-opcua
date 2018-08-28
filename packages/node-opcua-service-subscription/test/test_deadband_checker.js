/*global describe, it, require*/


const should = require("should");

const DataType = require("node-opcua-variant").DataType;
const Variant = require("node-opcua-variant").Variant;
const VariantArrayType = require("node-opcua-variant").VariantArrayType;


const DeadbandType = require("..").DeadbandType;
const checkDeadBand = require("..").checkDeadBand;


describe("test DeadBand Checker",function() {



    const vInt32_1000 = new Variant({ dataType: DataType.Int32,  value: 1000 });
    const vInt32_1010 = new Variant({ dataType: DataType.Int32,  value: 1010 });

    const vInt32_1000_Array = new Variant({ arrayType: VariantArrayType.Array, dataType: DataType.Int32,  value: [ 1000 , 1000 ] });
    const vInt32_1010_Array = new Variant({ arrayType: VariantArrayType.Array, dataType: DataType.Int32,  value: [ 1010 ,  982 ] });



    it("Scalar - DeadbandType.None - should detect difference between two Int scalar",function() {
        checkDeadBand(vInt32_1000,vInt32_1010,DeadbandType.None,NaN,null).should.eql(true);
        checkDeadBand(vInt32_1000,vInt32_1000,DeadbandType.None,NaN,null).should.eql(false);
    });

    it("Scalar - DeadbandType.Absolute - should detect difference between two Int scalar",function() {
        checkDeadBand(vInt32_1000,vInt32_1010,DeadbandType.Absolute, 5,null).should.eql(true);
        checkDeadBand(vInt32_1000,vInt32_1010,DeadbandType.Absolute,12,null).should.eql(false);
    });

    it("Scalar - DeadbandType.Percent - should detect difference between two Int scalar",function() {
        checkDeadBand(vInt32_1000,vInt32_1010,DeadbandType.Percent, 1, 200 ).should.eql(true);
        checkDeadBand(vInt32_1000,vInt32_1010,DeadbandType.Percent,12, 200).should.eql(false);
    });

    it("Array  - DeadbandType.None - should detect difference between two Int scalar",function() {
        checkDeadBand(vInt32_1000_Array,vInt32_1000_Array,DeadbandType.None,NaN,null).should.eql(false);
        checkDeadBand(vInt32_1000_Array,vInt32_1010_Array,DeadbandType.None,NaN,null).should.eql(true);
    });

    it("Array  - DeadbandType.Absolute - should detect difference between two Int scalar",function() {
        checkDeadBand(vInt32_1000_Array,vInt32_1000_Array,DeadbandType.Absolute, 5,null).should.eql(false);

        checkDeadBand(vInt32_1000_Array,vInt32_1010_Array,DeadbandType.Absolute, 5,null).should.eql(true);
        checkDeadBand(vInt32_1000_Array,vInt32_1010_Array,DeadbandType.Absolute,10,null).should.eql(true);
        checkDeadBand(vInt32_1000_Array,vInt32_1010_Array,DeadbandType.Absolute,20,null).should.eql(false);
    });


    const vInt64_1000 = new Variant({ arrayType: VariantArrayType.Scalar, dataType: DataType.Int64,  value: [0, 1000] });
    const vInt64_1010 = new Variant({ arrayType: VariantArrayType.Scalar, dataType: DataType.Int64,  value: [0, 1010] });

    //xx console.log("vInt64_1000",vInt64_1000.toString());
    const vInt64_L1000 = new Variant({ arrayType: VariantArrayType.Scalar, dataType: DataType.Int64,  value: [1, 1000] });
    const vInt64_L1010 = new Variant({ arrayType: VariantArrayType.Scalar, dataType: DataType.Int64,  value: [1, 1010] });

    it("Scalar - DeadbandType.None - should detect difference between two Int64 scalar",function() {

        checkDeadBand(vInt64_1000,vInt64_1010,DeadbandType.None,NaN,null).should.eql(true);
        checkDeadBand(vInt64_1000,vInt64_1000,DeadbandType.None,NaN,null).should.eql(false);

        checkDeadBand(vInt64_1000,vInt64_L1000,DeadbandType.None,NaN,null).should.eql(true);
        checkDeadBand(vInt64_1000,vInt64_L1010,DeadbandType.None,NaN,null).should.eql(true);

    });

    it("Scalar - DeadbandType.Absolute - should detect difference between two Int64 scalar",function() {

        checkDeadBand(vInt64_1000,vInt64_1010,DeadbandType.Absolute,   5,null).should.eql(true);
        checkDeadBand(vInt64_1000,vInt64_1010,DeadbandType.Absolute,  15,null).should.eql(false);


        checkDeadBand(vInt64_1000,vInt64_L1000,DeadbandType.Absolute,5,null).should.eql(true);
        checkDeadBand(vInt64_1000,vInt64_L1010,DeadbandType.Absolute,5,null).should.eql(true);

    });

});
