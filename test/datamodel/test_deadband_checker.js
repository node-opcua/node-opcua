/*global describe, it, require*/
require("requirish")._(module);

var should = require("should");

var subscription_service = require("lib/services/subscription_service");
var DeadbandType = subscription_service.DeadbandType;
var DataType = require("lib/datamodel/variant").DataType;
var Variant = require("lib/datamodel/variant").Variant;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;


var check_deadband = require("lib/datamodel/deadband_checker").check_deadband;


describe("test DeadBand Checker",function() {



    var vInt32_1000 = new Variant({ dataType: DataType.Int32,  value: 1000 });
    var vInt32_1010 = new Variant({ dataType: DataType.Int32,  value: 1010 });

    var vInt32_1000_Array = new Variant({ arrayType: VariantArrayType.Array, dataType: DataType.Int32,  value: [ 1000 , 1000 ] });
    var vInt32_1010_Array = new Variant({ arrayType: VariantArrayType.Array, dataType: DataType.Int32,  value: [ 1010 ,  982 ] });



    it("Scalar - DeadbandType.None - should detect difference between two Int scalar",function() {
        check_deadband(vInt32_1000,vInt32_1010,DeadbandType.None,NaN,null).should.eql(true);
        check_deadband(vInt32_1000,vInt32_1000,DeadbandType.None,NaN,null).should.eql(false);
    });

    it("Scalar - DeadbandType.Absolute - should detect difference between two Int scalar",function() {
        check_deadband(vInt32_1000,vInt32_1010,DeadbandType.Absolute, 5,null).should.eql(true);
        check_deadband(vInt32_1000,vInt32_1010,DeadbandType.Absolute,12,null).should.eql(false);
    });

    it("Scalar - DeadbandType.Percent - should detect difference between two Int scalar",function() {
        check_deadband(vInt32_1000,vInt32_1010,DeadbandType.Percent, 1, 200 ).should.eql(true);
        check_deadband(vInt32_1000,vInt32_1010,DeadbandType.Percent,12, 200).should.eql(false);
    });

    it("Array  - DeadbandType.None - should detect difference between two Int scalar",function() {
        check_deadband(vInt32_1000_Array,vInt32_1000_Array,DeadbandType.None,NaN,null).should.eql(false);
        check_deadband(vInt32_1000_Array,vInt32_1010_Array,DeadbandType.None,NaN,null).should.eql(true);
    });

    it("Array  - DeadbandType.Absolute - should detect difference between two Int scalar",function() {
        check_deadband(vInt32_1000_Array,vInt32_1000_Array,DeadbandType.Absolute, 5,null).should.eql(false);

        check_deadband(vInt32_1000_Array,vInt32_1010_Array,DeadbandType.Absolute, 5,null).should.eql(true);
        check_deadband(vInt32_1000_Array,vInt32_1010_Array,DeadbandType.Absolute,10,null).should.eql(true);
        check_deadband(vInt32_1000_Array,vInt32_1010_Array,DeadbandType.Absolute,20,null).should.eql(false);
    });


    var vInt64_1000 = new Variant({ arrayType: VariantArrayType.Scalar, dataType: DataType.Int64,  value: [0, 1000] });
    var vInt64_1010 = new Variant({ arrayType: VariantArrayType.Scalar, dataType: DataType.Int64,  value: [0, 1010] });

    console.log("vInt64_1000",vInt64_1000.toString());
    var vInt64_L1000 = new Variant({ arrayType: VariantArrayType.Scalar, dataType: DataType.Int64,  value: [1, 1000] });
    var vInt64_L1010 = new Variant({ arrayType: VariantArrayType.Scalar, dataType: DataType.Int64,  value: [1, 1010] });

    it("Scalar - DeadbandType.None - should detect difference between two Int64 scalar",function() {

        check_deadband(vInt64_1000,vInt64_1010,DeadbandType.None,NaN,null).should.eql(true);
        check_deadband(vInt64_1000,vInt64_1000,DeadbandType.None,NaN,null).should.eql(false);

        check_deadband(vInt64_1000,vInt64_L1000,DeadbandType.None,NaN,null).should.eql(true);
        check_deadband(vInt64_1000,vInt64_L1010,DeadbandType.None,NaN,null).should.eql(true);

    });

    it("Scalar - DeadbandType.Absolute - should detect difference between two Int64 scalar",function() {

        check_deadband(vInt64_1000,vInt64_1010,DeadbandType.Absolute,   5,null).should.eql(true);
        check_deadband(vInt64_1000,vInt64_1010,DeadbandType.Absolute,  15,null).should.eql(false);


        check_deadband(vInt64_1000,vInt64_L1000,DeadbandType.Absolute,5,null).should.eql(true);
        check_deadband(vInt64_1000,vInt64_L1010,DeadbandType.Absolute,5,null).should.eql(true);

    });

});
