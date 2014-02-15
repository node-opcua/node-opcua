
var Variant = require("../lib/variant").Variant;
var DataType = require("../lib/variant").DataType;
var VariantArrayType = require("../lib/variant").VariantArrayType;

var should = require("should");
var encode_decode_round_trip_test = require("./utils/encode_decode_round_trip_test").encode_decode_round_trip_test;
var s = require("./../lib/structures");


describe("Variant",function(){

    it("should create a empty Variant",function(){
        var var1 = new Variant();

        var1.dataType.should.eql(DataType.Null);
        var1.arrayType.should.eql(VariantArrayType.Scalar);
        should(var1.value).be.equal(null);

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

    it("should create a Scalar LocalizedText Variant 1/2",function(){
        var var1 = new Variant({
            dataType: DataType.LocalizedText,
            value: new s.LocalizedText({ text: "Hello" , locale: "en" })
        });

        var1.dataType.should.eql(DataType.LocalizedText);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        var1.value._schema.name.should.equal("LocalizedText");

        encode_decode_round_trip_test(var1,function(stream){
            stream.length.should.equal(17);
        });
    });

    it("should create a Scalar LocalizedText Variant 2/2",function(){
        var var1 = new Variant({
            dataType: DataType.LocalizedText,
            value: { text: "Hello" , locale: "en" }
        });

        var1.dataType.should.eql(DataType.LocalizedText);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        var1.value._schema.name.should.equal("LocalizedText");

        encode_decode_round_trip_test(var1,function(stream){
            stream.length.should.equal(17);
        });
    });

    it("should create a Scalar QualifiedName Variant 1/2",function(){
        var var1 = new Variant({
            dataType: DataType.QualifiedName,
            value: new s.QualifiedName({ name: "Hello" , namespaceIndex: 0 })
        });

        var1.dataType.should.eql(DataType.QualifiedName);
        var1.arrayType.should.eql(VariantArrayType.Scalar);
        var1.value._schema.name.should.equal("QualifiedName");

        encode_decode_round_trip_test(var1,function(stream){
            stream.length.should.equal(12);
        });
    });

    it("should create a Scalar QualifiedName Variant 2/2",function(){
        var var1 = new Variant({
            dataType: DataType.QualifiedName,
            value: { name: "Hello" , namespaceIndex: 0 }
        });

        var1.dataType.should.eql(DataType.QualifiedName);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        var1.value._schema.name.should.equal("QualifiedName");

        encode_decode_round_trip_test(var1,function(stream){
            stream.length.should.equal(12);
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

    it("should create a Array QualifiedName Variant",function(){

        var var1 = new Variant({
            dataType: DataType.QualifiedName,
            arrayType: VariantArrayType.Array,
            value: [
                { name: "Hello" , namespaceIndex: 0 },
                { name: "World" , namespaceIndex: 0 }
            ]
        });

        var1.dataType.should.eql(DataType.QualifiedName);
        var1.arrayType.should.eql(VariantArrayType.Array);

        var1.value[0]._schema.name.should.equal("QualifiedName");

        encode_decode_round_trip_test(var1,function(stream){
            stream.length.should.equal(27);
        });
    });

});