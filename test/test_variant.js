
var Variant = require("../lib/variant").Variant;
var DataType = require("../lib/variant").DataType;
var VariantArrayType = require("../lib/variant").VariantArrayType;

var should = require("should");
var encode_decode_round_trip_test = require("./utils/encode_decode_round_trip_test").encode_decode_round_trip_test;


describe("Variant",function(){

    it("should create a empty Variant",function(){
        var var1 = new Variant();

        var1.dataType.should.eql(DataType.Null);
        var1.arrayType.should.eql(VariantArrayType.Scalar);
        should(var1.value).be.equal("null");

        encode_decode_round_trip_test(var1,function(stream){
            stream.length.should.equal(1);
        });
    });

    it("should create a Scalar UInt32 Variant",function(){
        var var1 = new Variant({dataType: DataType.UInt32, value: 10 });

        var1.dataType.should.eql(DataType.UInt32);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        encode_decode_round_trip_test(var1,function(stream){
            stream.length.should.equal(5);
        });
    });

    it("should create a Scalar String  Variant",function(){
        var var1 = new Variant({dataType: DataType.String, value: "Hello" });

        var1.dataType.should.eql(DataType.String);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        encode_decode_round_trip_test(var1,function(stream){
            stream.length.should.equal(1 +4 +5);
        });
    });

    it("should create a Array String Variant",function(){

        var var1 = new Variant({
            dataType: DataType.String,
            arrayType: VariantArrayType.Array,
            value: [ "Hello" , "World" ]
        });

        var1.dataType.should.eql(DataType.String);
        var1.arrayType.should.eql(VariantArrayType.Array);

        encode_decode_round_trip_test(var1,function(stream){
            stream.length.should.equal(1 + 4 + ( 4 +5 + 4 + 5) );
        });
    });


});