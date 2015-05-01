require("requirish")._(module);

var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var s = require("lib/datamodel/structures");
var ec = require("lib/misc/encode_decode");
var QualifiedName   = require("lib/datamodel/qualified_name").QualifiedName;
var LocalizedText   = require("lib/datamodel/localized_text").LocalizedText;
var should = require("should");
var encode_decode_round_trip_test = require("test/helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;
var redirectToFile = require("lib/misc/utils").redirectToFile;

describe("Variant",function() {

    it("should create a empty Variant", function () {
        var var1 = new Variant();

        var1.dataType.should.eql(DataType.Null);
        var1.arrayType.should.eql(VariantArrayType.Scalar);
        should(var1.value).be.equal(null);

        encode_decode_round_trip_test(var1, function (stream) {
            stream.length.should.equal(1);
        });
    });

    it("should create a Scalar UInt32 Variant", function () {
        var var1 = new Variant({dataType: DataType.UInt32, value: 10});

        var1.dataType.should.eql(DataType.UInt32);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        encode_decode_round_trip_test(var1, function (stream) {
            stream.length.should.equal(5);
        });
    });

    it("should create a Scalar LocalizedText Variant 1/2", function () {
        var var1 = new Variant({
            dataType: DataType.LocalizedText,
            value: new LocalizedText({text: "Hello", locale: "en"})
        });

        var1.dataType.should.eql(DataType.LocalizedText);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        var1.value._schema.name.should.equal("LocalizedText");

        encode_decode_round_trip_test(var1, function (stream) {
            stream.length.should.equal(17);
        });
    });

    it("should create a Scalar LocalizedText Variant 2/2", function () {
        var var1 = new Variant({
            dataType: DataType.LocalizedText,
            value: {text: "Hello", locale: "en"}
        });

        var1.dataType.should.eql(DataType.LocalizedText);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        var1.value._schema.name.should.equal("LocalizedText");

        encode_decode_round_trip_test(var1, function (stream) {
            stream.length.should.equal(17);
        });
    });

    it("should create a Scalar QualifiedName Variant 1/2", function () {
        var var1 = new Variant({
            dataType: DataType.QualifiedName,
            value: new QualifiedName({name: "Hello", namespaceIndex: 0})
        });

        var1.dataType.should.eql(DataType.QualifiedName);
        var1.arrayType.should.eql(VariantArrayType.Scalar);
        var1.value._schema.name.should.equal("QualifiedName");

        encode_decode_round_trip_test(var1, function (stream) {
            stream.length.should.equal(12);
        });
    });

    it("should create a Scalar QualifiedName Variant 2/2", function () {
        var var1 = new Variant({
            dataType: DataType.QualifiedName,
            value: {name: "Hello", namespaceIndex: 0}
        });

        var1.dataType.should.eql(DataType.QualifiedName);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        var1.value._schema.name.should.equal("QualifiedName");

        encode_decode_round_trip_test(var1, function (stream) {
            stream.length.should.equal(12);
        });
    });


    it("should create a Scalar String  Variant", function () {
        var var1 = new Variant({dataType: DataType.String, value: "Hello"});

        var1.dataType.should.eql(DataType.String);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        encode_decode_round_trip_test(var1, function (stream) {
            stream.length.should.equal(1 + 4 + 5);
        });
    });

    it("should create a Array String Variant", function () {

        var var1 = new Variant({
            dataType: DataType.String,
            arrayType: VariantArrayType.Array,
            value: ["Hello", "World"]
        });

        var1.dataType.should.eql(DataType.String);
        var1.arrayType.should.eql(VariantArrayType.Array);
        var1.value.length.should.eql(2);
        var1.value[0].should.eql("Hello");
        var1.value[1].should.eql("World");

        encode_decode_round_trip_test(var1, function (stream) {
            stream.length.should.equal(1 + 4 + ( 4 + 5 + 4 + 5));
        });
    });

    it("should create a Array QualifiedName Variant", function () {

        var var1 = new Variant({
            dataType: DataType.QualifiedName,
            arrayType: VariantArrayType.Array,
            value: [
                {name: "Hello", namespaceIndex: 0},
                {name: "World", namespaceIndex: 0}
            ]
        });

        var1.dataType.should.eql(DataType.QualifiedName);
        var1.arrayType.should.eql(VariantArrayType.Array);

        var1.value[0]._schema.name.should.equal("QualifiedName");

        encode_decode_round_trip_test(var1, function (stream) {
            stream.length.should.equal(27);
        });
    });

    it("should create a Array of GUID Variant", function () {

        var var1 = new Variant({
            dataType: DataType.Guid,
            arrayType: VariantArrayType.Array,
            value: [
                ec.emptyGuid,
                ec.randomGuid(),
                ec.randomGuid(),
                ec.emptyGuid,
                ec.randomGuid(),
                ec.randomGuid()
            ]
        });

        var1.dataType.should.eql(DataType.Guid);
        var1.arrayType.should.eql(VariantArrayType.Array);

        should(typeof var1.value[0]).be.eql("string");

        encode_decode_round_trip_test(var1, function (stream) {
            stream.length.should.equal(101);
        });

    });

    it("should detect invalid SByte Variant", function () {
        var var1 = new Variant({
            dataType: DataType.SByte,
            value: 63
        });
        var1.isValid().should.eql(true);
        var1.value = "Bad!";
        var1.isValid().should.eql(false);

    });

    it("should detect invalid Array<Int32> Variant", function () {
        var var1 = new Variant({
            dataType: DataType.UInt32,
            arrayType: VariantArrayType.Array,
            value: [2, 3, 4, 5]
        });
        var1.toString().should.eql("Variant(Array<UInt32>, l= 4, value=[2,3,4,5])");
        var1.isValid().should.eql(true);

        var1.value[2] = "Bad!";
        var1.isValid().should.eql(false);

        var1.toString().should.eql("Variant(Array<UInt32>, l= 4, value=[2,3,Bad!,5])");
    });


});

var analyze_object_binary_encoding = require("lib/misc/packet_analyzer").analyze_object_binary_encoding;

describe("Variant - Analyser",function(){

    var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;

    var various_variants = [
        new Variant({  dataType: DataType.UInt32,       arrayType: VariantArrayType.Array,  value: [  2,3,4,5 ]   }),
        new Variant({  dataType: DataType.NodeId,       arrayType: VariantArrayType.Scalar, value: makeNodeId(1,2)}),
        new Variant({  dataType: DataType.LocalizedText,arrayType: VariantArrayType.Scalar, value: new LocalizedText({text: "Hello", locale: "en"}) }),
        new Variant({  dataType: DataType.Double,       arrayType: VariantArrayType.Scalar, value: 3.14 }),
        new Variant({  dataType: DataType.Guid   ,       arrayType: VariantArrayType.Scalar, value:  ec.randomGuid() }),

        new Variant({  dataType: DataType.Int32  ,       arrayType: VariantArrayType.Array     }),
        new Variant({  dataType: DataType.Int32  ,       arrayType: VariantArrayType.Array ,value:[]   }),
        new Variant({  dataType: DataType.Int32  ,       arrayType: VariantArrayType.Array ,value:[1]  }),
        new Variant({  dataType: DataType.Int32  ,       arrayType: VariantArrayType.Array ,value:[1,2]})
    ];

    it("should analyze variant",function() {

        redirectToFile("variant_analyze.log",function() {
            various_variants.forEach(function(v){
                analyze_object_binary_encoding(v);
            });
        });
    });


});



var Benchmarker = require("test/helpers/benchmarker").Benchmarker;

var BinaryStream = require("lib/misc/binaryStream").BinaryStream;

var assert = require("better-assert");
var _ = require("underscore");
var Variant_ArrayMask            = 0x80;
var Variant_ArrayDimensionsMask  = 0x40;
var Variant_TypeMask             = 0x3F;
var factories = require("lib/misc/factories");
var old_encode=  function(variant,stream){

    assert(variant.isValid());

    var encodingByte = variant.dataType.value;

    if (variant.arrayType ===  VariantArrayType.Array ) {

        encodingByte = encodingByte | Variant_ArrayMask;
    }
    ec.encodeUInt8(encodingByte,stream);
    var encode = factories.findBuiltInType(variant.dataType.key).encode;
    /* istanbul ignore next */
    if (!encode) {
        throw new Error("Cannot find encode function for dataType "+variant.dataType.key);
    }
    if (variant.arrayType ===  VariantArrayType.Array ) {
        var arr = variant.value || [];
        ec.encodeUInt32(arr.length,stream);
        arr.forEach(function(el){
            encode(el,stream);
        });
    } else {
        encode(variant.value,stream);
    }
};


describe("benchmarking variant encode",function() {


    function perform_benchmark(done) {

        var bench = new Benchmarker();

        function test_iteration(v,s,encode) {

            s.rewind();
            encode.call(this,v,stream);
        }

        var stream = new BinaryStream();
        var variant = new Variant({
            dataType: DataType.Double,
            arrayType: VariantArrayType.Array,
            value : [ 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]
        });

        bench.add('Variant.encode', function () {
            assert(_.isFunction(Variant.prototype._schema.encode));
            test_iteration(variant,stream,Variant.prototype._schema.encode);
        })
        .add('Variant.old_encode', function () {
            assert(_.isFunction(old_encode));
            test_iteration(variant,stream,old_encode);
        })
        .on('cycle', function (message) {
            console.log(message);
        })
        .on('complete', function () {

            console.log(' Fastest is ' + this.fastest.name);
            console.log(' Speed Up : x', this.speedUp);
            this.fastest.name.should.eql("Variant.encode");
            done();
        })
        .run();
    }

    it("should ",function(done) {

        perform_benchmark(done);
    });
});

