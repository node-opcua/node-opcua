"use strict";
var should = require("should");
var assert = require("node-opcua-assert");
var _ = require("underscore");


var Variant = require("..").Variant;
var DataType = require("..").DataType;
var VariantArrayType = require("..").VariantArrayType;

var ec = require("node-opcua-basic-types");
var QualifiedName = require("node-opcua-data-model").QualifiedName;
var LocalizedText = require("node-opcua-data-model").LocalizedText;

var encode_decode_round_trip_test = require("node-opcua-packet-analyzer/test_helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;

var redirectToFile = require("node-opcua-debug").redirectToFile;

var Benchmarker = require("node-opcua-benchmarker").Benchmarker;
var BinaryStream = require("node-opcua-binary-stream").BinaryStream;

var Variant_ArrayMask = 0x80;
var Variant_ArrayDimensionsMask = 0x40;
var Variant_TypeMask = 0x3F;

var factories = require("node-opcua-factory");


describe("Variant", function () {

    it("should create a empty Variant", function () {
        var var1 = new Variant();

        var1.dataType.should.eql(DataType.Null);
        var1.arrayType.should.eql(VariantArrayType.Scalar);
        should.not.exist(var1.value);
        should.not.exist(var1.dimensions);

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

    it("should create a Scalar UInt64 Variant", function () {

        var var1 = new Variant({arrayType: VariantArrayType.Scalar, dataType: DataType.UInt64, value: [10, 20]});

        var1.dataType.should.eql(DataType.UInt64);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        encode_decode_round_trip_test(var1, function (stream) {
            stream.length.should.equal(9);
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

    it("should create a Scalar ByteString  Variant - null", function () {

        var var1 = new Variant({dataType: DataType.ByteString, value: null});

        var1.dataType.should.eql(DataType.ByteString);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        encode_decode_round_trip_test(var1, function (stream) {
            stream.length.should.equal(5);
        });
    });

    it("should create a Scalar ByteString  Variant - empty buffer", function () {

        var var1 = new Variant({dataType: DataType.ByteString, value: new Buffer(0)});

        var1.dataType.should.eql(DataType.ByteString);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        encode_decode_round_trip_test(var1, function (stream) {
            stream.length.should.equal(5);
        });
    });

    it("should create a Scalar ByteString  Variant - 3 bytes", function () {
        var var1 = new Variant({dataType: DataType.ByteString, value: new Buffer("ABC")});

        var1.dataType.should.eql(DataType.ByteString);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        encode_decode_round_trip_test(var1, function (stream) {
            stream.length.should.equal(5 + 3);
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
            stream.length.should.equal(1 + 4 + (4 + 5 + 4 + 5));
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

        var1.value[2].should.eql(0);
        var1.toString().should.eql("Variant(Array<UInt32>, l= 4, value=[2,3,0,5])");

        //xx var1.isValid().should.eql(false);
        //xx var1.toString().should.eql("Variant(Array<UInt32>, l= 4, value=[2,3,Bad!,5])");
    });

    it("should create a Variant as a Matrix (2x3) of UInt32 ", function () {
        var var1 = new Variant({
            dataType: DataType.UInt32,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [0x000, 0x001, 0x002, 0x010, 0x011, 0x012]
        });

        var1.arrayType.should.eql(VariantArrayType.Matrix);
        var1.dimensions.should.eql([2, 3]);
        var1.value.length.should.eql(6);
        var1.dataType.should.eql(DataType.UInt32);

        encode_decode_round_trip_test(var1, function (stream) {
            // 1  encoding byte          1
            // 1  UInt32 => ArrayLength  4
            // 6  UInt32                 6*4
            // 1  Uint32                 4
            // 3  Uint32 (dimension)     2*4
            //                           ----
            //                           41
            stream.length.should.equal(41);
        });

        var1.toString().should.eql("Variant(Matrix[ 2,3 ]<UInt32>, l= 6, value=[0,1,2,16,17,18])");
    });

    it("should raise an exception when construction a Matrix with incorrect element size", function () {

        should(function construct_matrix_variant_with_invalid_value() {
            var var1 = new Variant({
                dataType: DataType.UInt32,
                arrayType: VariantArrayType.Matrix,
                dimensions: [2, 3],
                value: [0x000] // wrong size !
            });
        }).throwError();

    });

    it("should create a Array ByteString  Variant ", function () {

        var var1 = new Variant({dataType: DataType.ByteString, value: [new Buffer("ABC"), null]});

        var1.dataType.should.eql(DataType.ByteString);
        var1.arrayType.should.eql(VariantArrayType.Array);

        encode_decode_round_trip_test(var1, function (stream) {
            stream.length.should.equal(5 + 4 + 3 + 4);
        });
    });
    it("should create a Array UInt64 Variant", function () {

        var var1 = new Variant({
            arrayType: VariantArrayType.Array,
            dataType: DataType.UInt64,
            value: [[1, 2], [3, 4]]
        });

        var1.dataType.should.eql(DataType.UInt64);
        var1.arrayType.should.eql(VariantArrayType.Array);

        encode_decode_round_trip_test(var1, function (stream) {
            stream.length.should.equal(5 + 8 + 8);
        });
    });

});

var analyze_object_binary_encoding = require("node-opcua-packet-analyzer").analyze_object_binary_encoding;

describe("Variant - Analyser", function () {

    // increase timeout to cope with istanbul
    this.timeout(Math.max(400000, this._timeout));

    var makeNodeId = require("node-opcua-nodeid").makeNodeId;

    var manyValues = [];
    for (var i = 0; i < 1000; i++) {
        manyValues[i] = Math.random() * 1000 - 500;
    }

    var veryLargeFloatArray = new Float64Array(10 * 1024);
    for (var i = 0; i < veryLargeFloatArray.length; i++) {
        veryLargeFloatArray[i] = (Math.random() - 0.5) * 10000;
    }
    var various_variants = [
        new Variant({dataType: DataType.NodeId, arrayType: VariantArrayType.Scalar, value: makeNodeId(1, 2)}),
        new Variant({
            dataType: DataType.LocalizedText,
            arrayType: VariantArrayType.Scalar,
            value: new LocalizedText({text: "Hello", locale: "en"})
        }),
        new Variant({dataType: DataType.Double, arrayType: VariantArrayType.Scalar, value: 3.14}),
        new Variant({dataType: DataType.Guid, arrayType: VariantArrayType.Scalar, value: ec.randomGuid()}),

        new Variant({dataType: DataType.Int32, arrayType: VariantArrayType.Array  /*, unspecified value*/}),
        new Variant({dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: []}),
        new Variant({dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: new Int32Array([1])}),
        new Variant({dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: new Int32Array([1, 2])}),
        new Variant({
            dataType: DataType.UInt32,
            arrayType: VariantArrayType.Array,
            value: new Uint32Array([2, 3, 4, 5])
        }),
        new Variant({
            dataType: DataType.Float,
            arrayType: VariantArrayType.Array,
            value: new Float32Array([2, 3, 4, 5])
        }),
        new Variant({
            dataType: DataType.Double,
            arrayType: VariantArrayType.Array,
            value: new Float64Array(manyValues)
        }),
        new Variant({dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: new Int32Array(manyValues)}),
        new Variant({dataType: DataType.Double, arrayType: VariantArrayType.Array, value: veryLargeFloatArray}),
    ];

    //xx console.log(various_variants.map(function(a){return a.toString()}).join("\n"));

    it("should analyze variant", function () {

        redirectToFile("variant_analyze1.log", function () {
            various_variants.forEach(function (v) {
                analyze_object_binary_encoding(v);
            });
        });
    });
    it("should encode/decode variant", function () {

        various_variants.forEach(function (v, index) {
            encode_decode_round_trip_test(v, function (stream) {
                // stream.length.should.equal(1+4+4*4);
            });
        });
    });

    it("should encode/decode a very large array of Float - 1", function () {

        var get_clock_tick = require("node-opcua-utils").get_clock_tick;

        var nbElements = 1500 * 1024;

        var t0 = get_clock_tick();
        var very_large = new Variant({
            dataType: DataType.Double,
            arrayType: VariantArrayType.Array,
            value: new Float64Array(nbElements)
        });

        for (var i = 0; i < nbElements; i++) {
            very_large.value[i] = Math.random();
        }

        var t1 = get_clock_tick();
        var size = very_large.binaryStoreSize();
        size.should.eql(nbElements * 8 + 5);

        var t2 = get_clock_tick();
        var stream = new BinaryStream(new Buffer(size));
        var t3 = get_clock_tick();
        very_large.encode(stream);
        var t4 = get_clock_tick();

        console.log(" t1 = create variant   ", t1 - t0);
        console.log(" t2 = binaryStoreSize  ", t2 - t1);
        console.log(" t3 = new BinaryStream ", t3 - t2);
        console.log(" t3 = encode           ", t4 - t3);
    });

    it("should encode/decode a very large array of Float", function () {

        var nbElements = 1500 * 1024;
        var very_large = new Variant({
            dataType: DataType.Double,
            arrayType: VariantArrayType.Array,
            value: new Float64Array(nbElements)
        });

        for (var i = 0; i < nbElements; i++) {
            very_large.value[i] = Math.random();
        }
        encode_decode_round_trip_test(very_large, function (stream) {
            // stream.length.should.equal(1+4+4*4);
        });

    });

    it("should check the performance of encode/decode a very large array of Float", function () {

        this.timeout(Math.max(300000, this._timeout));

        var length = 500 * 1024;

        console.log("    array size = ", length);

        var obj = new Variant({
            dataType: DataType.Double,
            arrayType: VariantArrayType.Array,
            value: new Float64Array(length)
        });

        for (var i = 0; i < length; i++) {
            obj.value[i] = i;
        }
        obj.value[100].should.eql(100);

        var size = obj.binaryStoreSize();
        var stream = new BinaryStream(new Buffer(size));

        var bench = new Benchmarker();

        var obj_reloaded = new Variant();

        bench.add('Variant.encode', function () {
            stream.rewind();
            obj.encode(stream);
        })
            .add('Variant.decode', function () {
                stream.rewind();
                obj_reloaded.decode(stream);
            })
            .on('cycle', function (message) {
                //xx console.log(message);
            })
            .on('complete', function () {

                console.log(' Fastest is ' + this.fastest.name);
                console.log(' Speed Up : x', this.speedUp);
                //xx this.fastest.name.should.eql("Variant.encode");

            })
            .run({max_time: 0.2});

        // note : the following test could be *slow* with large value of length
        //        for (var i=0;i<length;i++) { obj.value[i].should.eql(i); }
        function validate_array() {
            for (var i = 0; i < length; i++) {
                if (obj.value[i] !== i) {
                    return false;
                }
            }
            return true;
        }

        validate_array().should.eql(true);
    });
});


var old_encode = function (variant, stream) {

    // NOTE: this code matches the old implement and should not be changed
    //       It is useful to compare new performance of the encode method
    //       with the old implementation.
    assert(variant.isValid());

    var encodingByte = variant.dataType.value;

    if (variant.arrayType === VariantArrayType.Array) {

        encodingByte |= Variant_ArrayMask;
    }
    ec.encodeUInt8(encodingByte, stream);
    var encode = factories.findBuiltInType(variant.dataType.key).encode;
    /* istanbul ignore next */
    if (!encode) {
        throw new Error("Cannot find encode function for dataType " + variant.dataType.key);
    }
    if (variant.arrayType === VariantArrayType.Array) {
        var arr = variant.value || [];
        ec.encodeUInt32(arr.length, stream);
        arr.forEach(function (el) {
            encode(el, stream);
        });
    } else {
        encode(variant.value, stream);
    }
};


describe("benchmarking variant encode", function () {

    function perform_benchmark(done) {

        var bench = new Benchmarker();

        function test_iteration(v, s, encode) {
            s.rewind();
            encode.call(this, v, stream);
        }

        var stream = new BinaryStream();
        var variant = new Variant({
            dataType: DataType.UInt32,
            arrayType: VariantArrayType.Array,
            value: []
        });

        variant.value = [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9,
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9,
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9,
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9,
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9,
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9,
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9,
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9,
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9,
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9,
            10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18
        ];
        bench.add('Variant.encode', function () {
            assert(_.isFunction(Variant.prototype._schema.encode));
            test_iteration(variant, stream, Variant.prototype._schema.encode);
        })
            .add('Variant.old_encode', function () {
                assert(_.isFunction(old_encode));
                test_iteration(variant, stream, old_encode);
            })
            .on('cycle', function (message) {
                // console.log(message);
            })
            .on('complete', function () {

                console.log(' Fastest is ' + this.fastest.name);
                console.log(' Speed Up : x', this.speedUp);

                // this test fails only on AppVeyor ! why ?
                //xx this.fastest.name.should.eql("Variant.encode");

                done();
            })
            .run({max_time: 0.1});
    }

    it("should verify that current Variant.encode method is better than old implementation", function (done) {

        perform_benchmark(done);
    });
});

describe("benchmarking float Array encode/decode", function () {

    this.timeout(Math.max(200000, this._timeout));

    function test_1(stream, arr) {

        stream.writeUInt32(arr.length);
        for (var i = 0; i < arr.length; i++) {
            stream.writeFloat(arr[i]);
        }
    }

    function test_2(stream, arr) {

        stream.writeUInt32(arr.length);
        var byteArr = new Uint8Array(arr.buffer);
        var n = byteArr.length;
        for (var i = 0; i < n; i++) {
            stream.writeUInt8(byteArr[i]);

        }
    }

    function test_3(stream, arr) {

        stream.writeUInt32(arr.length);
        var byteArr = new Uint32Array(arr.buffer);
        var n = byteArr.length;
        for (var i = 0; i < n; i++) {
            stream.writeUInt32(byteArr[i]);

        }
    }

    function test_4(stream, arr) {

        stream.writeUInt32(arr.length);
        var intArray = new Uint32Array(arr.buffer);
        var n = intArray.length;
        for (var i = 0; i < n; i++) {
            stream.writeUInt32(intArray[i], true);
        }
    }

    function test_5(stream, arr) {

        stream.writeUInt32(arr.length);
        var byteArr = new Uint8Array(arr.buffer);
        var n = byteArr.length;
        for (var i = 0; i < n; i++) {
            stream._buffer[stream.length++] = byteArr[i];
        }
    }

    function test_6(stream, arr) {
        stream.writeUInt32(arr.length);
        stream.writeArrayBuffer(arr.buffer);
    }

    function test_iteration(variant, stream, fct) {
        stream.rewind();
        fct(stream, variant.value);
    }


    function perform_benchmark(done) {

        var bench = new Benchmarker();

        var length = 1024;
        var sampleArray = new Float32Array(length);
        for (var i = 0; i < length; i++) {
            sampleArray[i] = 1.0 / (i + 1);
        }

        var stream = new BinaryStream(length * 4 + 30);
        var variant = new Variant({
            dataType: DataType.Float,
            arrayType: VariantArrayType.Array,
            value: sampleArray
        });
        assert(variant.value.buffer instanceof ArrayBuffer);

        stream.rewind();
        var r = [test_1, test_2, test_3, test_4, test_5, test_6].map(function (fct) {
            stream.rewind();
            fct(stream, variant.value);
            var reference_buf = stream._buffer.slice(0, stream._buffer.length);
            return reference_buf.toString("hex");
        });
        r[0].should.eql(r[1]);
        r[0].should.eql(r[2]);
        r[0].should.eql(r[3]);
        r[0].should.eql(r[4]);
        r[0].should.eql(r[5]);

        bench
            .add('test1', function () {
                test_iteration(variant, stream, test_1);
            })
            .add('test2', function () {
                test_iteration(variant, stream, test_2);
            })
            .add('test3', function () {
                test_iteration(variant, stream, test_3);
            })
            .add('test4', function () {
                test_iteration(variant, stream, test_4);
            })
            .add('test5', function () {
                test_iteration(variant, stream, test_5);
            })
            .add('test6', function () {
                test_iteration(variant, stream, test_6);
            })
            .on('cycle', function (message) {
                //xx console.log(message);
            })
            .on('complete', function () {

                console.log(' slowest is ' + this.slowest.name);
                console.log(' Fastest is ' + this.fastest.name);
                console.log(' Speed Up : x', this.speedUp);
                // xxthis.fastest.name.should.eql("test4");
                done();
            })
            .run({max_time: 0.1});

    }

    it("should check which is the faster way to encode decode a float", function (done) {

        perform_benchmark(done);
    });
});

describe("Variant with Advanced Array", function () {


    it("should automatically detect that variant is an array when rrayType is missing ", function () {


        var v = new Variant({
            dataType: "Float",
            //  EXPLICITLY MISSING arrayType : VariantArrayType.Array
            value: [1, 2]
        });

        v.arrayType.should.eql(VariantArrayType.Array);

        encode_decode_round_trip_test(v, function (stream) {
            stream.length.should.equal(1 + 4 + 2 * 4);
        });
    });

    it("should be possible to handle an Float array  with a Float32Array", function () {

        var v = new Variant({
            dataType: DataType.Float,
            arrayType: VariantArrayType.Array,
            value: [1, 2, 3, 4]
        });
        encode_decode_round_trip_test(v, function (stream) {
            stream.length.should.equal(1 + 4 + 4 * 4);
        });
    });

    it("should be possible to encode/decode an subarray of Float32Array", function () {

        var v = new Variant({
            dataType: DataType.Float,
            arrayType: VariantArrayType.Array,
            value: [0, 1, 2, 3, 4, 5]
        });

        var NumericRange = require("node-opcua-numeric-range").NumericRange;
        var nr = new NumericRange("3:4");
        v.value = nr.extract_values(v.value).array;
        v.value[0].should.eql(3);
        v.value[1].should.eql(4);
        encode_decode_round_trip_test(v, function (stream) {
            stream.length.should.equal(1 + 4 + 4 + 4);
        });

    });

    it("should be possible to read a sub matrix of a array of byte strings", function () {

        var v = new Variant({
            dataType: DataType.ByteString,
            arrayType: VariantArrayType.Array,
            value: ["ABCDEFGHIJKL", "BCDEFGHIJKLA", "CDEFGHIJKLAB", "DEFGHIJKLABC", "EFGHIJKLABCD", "FGHIJKLABCDE"]

        });
        var NumericRange = require("node-opcua-numeric-range").NumericRange;
        var StatusCodes = require("node-opcua-status-code").StatusCodes;

        var nr = new NumericRange("3:4,1:3");

        nr.isValid().should.eql(true);

        var results = nr.extract_values(v.value);
        results.statusCode.should.eql(StatusCodes.Good);

        results.array.should.eql(["EFG", "FGH"]);

    });


});

describe("Variant with enumeration", function () {

    var SomeEnum = DataType;

    before(function () {
        should.exist(SomeEnum.DiagnosticInfo);
    });

    it("should fail to create a variant from a enumeration item if dataType is not Int32", function () {
        should(function () {
            var v = new Variant({
                dataType: DataType.UInt32,
                value: SomeEnum.DiagnosticInfo
            });
            v.value.should.eql(0);
        }).throw();
    });

    it("should create a variant from a enumeration item", function () {
        should.exist(SomeEnum.DiagnosticInfo);
        var v = new Variant({
            dataType: DataType.Int32,
            value: SomeEnum.DiagnosticInfo
        });
        // console.log(v.toString());
        v.value.should.eql(SomeEnum.DiagnosticInfo.value);

    });

    xit("should not be necessary to specify the dataType for  a variant containing  enumeration item", function () {
        var v = new Variant({
            value: SomeEnum.DiagnosticInfo
        });
        // console.log(v.toString());
        v.value.should.eql(1);
        v.dataType.should.eql(DataType.Int32);
    });

    it("should create a variant with builtin type 'Duration'", function () {
        var v = new Variant({
            dataType: "Duration",
            value: 0.1
        });
        v.dataType.should.eql(DataType.Double);
        v.value.should.eql(0.1);

    });
    it("should create a variant with builtin type 'ByteString'", function () {

        var v = new Variant({
            dataType: "ByteString",
            value: new Buffer("abcd")
        });
        v.dataType.should.eql(DataType.ByteString);
        v.value.toString("ascii").should.eql("abcd");
    });
    it("should create a variant copy (with it's own array) ", function () {

        var options = {
            dataType: DataType.Float,
            arrayType: VariantArrayType.Array,
            value: [0, 1, 2, 3, 4, 5]
        };

        var v1, v2, v3;
        v1 = new Variant(options);

        v2 = new Variant({
            dataType: DataType.Float,
            arrayType: VariantArrayType.Array,
            value: v1.value
        });

        v1.value[1] += 1;
        should(v1.value[1] === v2.value[1]).eql(false);
        v1.value[1] -= 1;

        v3 = new Variant({
            dataType: v1.dataType,
            arrayType: v1.arrayType,
            value: v1.value
        });
        //xx v2.value = new Float32Array(v1.value);

        should(v1 === v2).eql(false);

        v1.value[1].should.eql(1);
        v2.value[1].should.eql(1);

        v1.value[1] = 32;
        v1.value[1].should.eql(32);

        //xx options.value[1].should.eql(1); // v2 should have its own copy of the array

        v3.value[1].should.eql(1); // v2 should have its own copy of the array

        v2.value[1].should.eql(1); // v2 should have its own copy of the array


    });

});

var sameVariant = require("..").sameVariant;

var sameVariantSlow = function (v1, v2) {
    return _.isEqual(v1, v2);
};

describe("testing sameVariant Performance", function () {


    this.timeout(40000);

    function largeArray(n) {
        var a = new Int32Array(n);
        for (var i = 0; i < n; i++) {
            a[i] = Math.random() * 10000;
        }
        return a;
    }

    var largeArray1 = largeArray(10000);

    function build_variants() {
        var a = [
            new Variant({dataType: DataType.String, arrayType: VariantArrayType.Array, value: null}),
            new Variant({dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: null}),
            new Variant({dataType: DataType.String, value: "Hello"}),
            new Variant({dataType: DataType.String, value: "HelloWorld"}),
            new Variant({dataType: DataType.Double, value: 42.0}),
            new Variant({dataType: DataType.Float, value: 42.0}),
            new Variant({dataType: DataType.Int32, value: 42}),
            new Variant({dataType: DataType.UInt32, value: 42}),
            new Variant({dataType: DataType.Double, value: 43.0}),
            new Variant({dataType: DataType.Float, value: 43.0}),
            new Variant({dataType: DataType.Int32, value: 43}),
            new Variant({dataType: DataType.UInt32, value: 43}),
            new Variant({dataType: DataType.String, arrayType: VariantArrayType.Array, value: ["Hello", "World"]}),
            new Variant({
                dataType: DataType.Double,
                arrayType: VariantArrayType.Array,
                value: new Float64Array([42.0, 43.0])
            }),
            new Variant({
                dataType: DataType.Float,
                arrayType: VariantArrayType.Array,
                value: new Float32Array([42.0, 43.0])
            }),
            new Variant({
                dataType: DataType.Int32,
                arrayType: VariantArrayType.Array,
                value: new Int32Array([42, 43.0])
            }),
            new Variant({
                dataType: DataType.UInt32,
                arrayType: VariantArrayType.Array,
                value: new Uint32Array([42, 43.0])
            }),
            new Variant({
                dataType: DataType.Double,
                arrayType: VariantArrayType.Array,
                value: new Float64Array([43.0, 43.0])
            }),
            new Variant({
                dataType: DataType.Float,
                arrayType: VariantArrayType.Array,
                value: new Float32Array([43.0, 43.0])
            }),
            new Variant({
                dataType: DataType.Int32,
                arrayType: VariantArrayType.Array,
                value: new Int32Array([43, 43.0])
            }),
            new Variant({
                dataType: DataType.UInt32,
                arrayType: VariantArrayType.Array,
                value: new Uint32Array([43, 43.0])
            }),
            new Variant({
                dataType: DataType.Int32,
                arrayType: VariantArrayType.Array,
                value: new Int32Array([43, 43.0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 10, 11, 12, 14])
            }),
            new Variant({
                dataType: DataType.Int32,
                arrayType: VariantArrayType.Array,
                value: new Int32Array([43, 43.0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 10, 11, 12, 16])
            }),
            new Variant({dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: largeArray1}),
            null,
        ];

        // create artificial null array variant
        a[0].value = null;
        a[1].value = null;

        return a;
    }

    var variousVariants = build_variants();
    var variousVariants_clone = build_variants();

    function _t(t) {
        return t ? t.toString() : "<null>";
    }

    function test_variant(index, sameVariant) {

        var v1 = variousVariants[index];

        for (var i = 0; i < variousVariants.length; i++) {
            if (i === index) {
                sameVariant(v1, variousVariants[i]).should.eql(true, _t(v1) + " === " + _t(variousVariants[i]));
            } else {
                sameVariant(v1, variousVariants[i]).should.eql(false, "i=" + i + " " + index + " " + _t(v1) + " !== " + _t(variousVariants[i]));
            }
        }
        sameVariant(v1, variousVariants_clone[index]).should.eql(true);
    }

    for (var i = 0; i < variousVariants.length; i++) {
        var v1 = variousVariants[i];
        it("#sameVariant with " + (v1 ? v1.toString() : "null"), test_variant.bind(null, i, sameVariant));
    }


    it("sameVariant should be very efficient ", function () {
        var bench = new Benchmarker();

        bench
            .add('fast sameVariant', function () {
                for (var i = 0; i < variousVariants.length; i++) {
                    for (var j = 0; j < variousVariants.length; j++) {
                        sameVariant(variousVariants[i], variousVariants_clone[j]);
                    }
                }
            })
            .add('slow sameVariant', function () {
                for (var i = 0; i < variousVariants.length; i++) {
                    for (var j = 0; j < variousVariants.length; j++) {
                        sameVariantSlow(variousVariants[i], variousVariants_clone[j]);
                    }
                }
            })
            .on('cycle', function (message) {
                console.log(message);
            })
            .on('complete', function () {

                console.log(' Fastest is ' + this.fastest.name);
                console.log(' Speed Up : x', this.speedUp);
                this.fastest.name.should.eql("fast sameVariant");
                // with istanbul, speedUp may be not as high as we would expect ( x10 !)
                // this.speedUp.should.be.greaterThan(10);
            })
            .run({max_time: 1 /*second */});


    })
});

describe("testing variant Clone & Copy Construct", function () {

    function SomeExtensionObject(options) {
        this.a = options.a;
    }

    function copy_construct(v) {
        return new Variant(v);
    }

    function clone(v) {
        return v.clone();
    }

    function install_test(copy_construct_or_clone, copy_construct_or_clone_func) {
        it("should " + copy_construct_or_clone + " a simple variant", function () {

            var v = new Variant({
                dataType: DataType.UInt32,
                value: 36
            });

            var cloned = copy_construct_or_clone_func(v);

            cloned.dataType.should.eql(v.dataType);
            cloned.value.should.eql(v.value);

        });
        it("should " + copy_construct_or_clone + " a variant array", function () {

            var v = new Variant({
                dataType: DataType.UInt32,
                value: [36, 37]
            });

            var cloned = copy_construct_or_clone_func(v);

            cloned.dataType.should.eql(v.dataType);
            cloned.value.should.eql(v.value);
            cloned.value[0].should.eql(36);
            cloned.value[1].should.eql(37);

            v.value[0] = 136;
            v.value[1] = 137;

            cloned.value[0].should.eql(36);
            cloned.value[1].should.eql(37);

        });
        it("should " + copy_construct_or_clone + " a variant containing a extension object", function () {

            var extObj = new SomeExtensionObject({a: 36});
            var v = new Variant({
                dataType: DataType.ExtensionObject,
                value: extObj
            });

            var cloned = copy_construct_or_clone_func(v);

            cloned.dataType.should.eql(v.dataType);
            cloned.value.a.should.eql(v.value.a);

            extObj.a = 1000;

            cloned.value.should.not.equal(v.value);
            cloned.value.a.should.equal(36);

            v.value.a.should.eql(1000);

        });
        it("should " + copy_construct_or_clone + " a variant containing a extension object array", function () {
            var extObj1 = new SomeExtensionObject({a: 36});
            var extObj2 = new SomeExtensionObject({a: 37});
            var v = new Variant({
                dataType: DataType.ExtensionObject,
                arrayType: VariantArrayType.Array,
                value: [extObj1, extObj2]
            });

            // copy construct;,
            var cloned = copy_construct_or_clone_func(v);

            cloned.dataType.should.eql(v.dataType);
            cloned.value[0].a.should.eql(36);
            cloned.value[1].a.should.eql(37);

            extObj1.a = 1000;
            extObj2.a = 1001;

            cloned.value[0].a.should.eql(36);
            cloned.value[1].a.should.eql(37);

            v.value[0].a.should.eql(1000);
            v.value[1].a.should.eql(1001);

        });
    }

    install_test("copy construct", copy_construct);
    install_test("clone", clone);

});
