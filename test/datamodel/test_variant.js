"use strict";
require("requirish")._(module);

var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var s = require("lib/datamodel/structures");
var ec = require("lib/misc/encode_decode");
var QualifiedName = require("lib/datamodel/qualified_name").QualifiedName;
var LocalizedText = require("lib/datamodel/localized_text").LocalizedText;
var should = require("should");
var encode_decode_round_trip_test = require("test/helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;
var redirectToFile = require("lib/misc/utils").redirectToFile;

var Benchmarker = require("test/helpers/benchmarker").Benchmarker;

var BinaryStream = require("lib/misc/binaryStream").BinaryStream;

var assert = require("better-assert");
var _ = require("underscore");
var Variant_ArrayMask = 0x80;
var Variant_ArrayDimensionsMask = 0x40;
var Variant_TypeMask = 0x3F;
var factories = require("lib/misc/factories");


describe("Variant", function () {

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

        var1.value[2].should.eql(0);
        var1.toString().should.eql("Variant(Array<UInt32>, l= 4, value=[2,3,0,5])");

        //xx var1.isValid().should.eql(false);
        //xx var1.toString().should.eql("Variant(Array<UInt32>, l= 4, value=[2,3,Bad!,5])");
    });


});

var analyze_object_binary_encoding = require("lib/misc/packet_analyzer").analyze_object_binary_encoding;

describe("Variant - Analyser", function () {

    // increase timeout to cope with istanbul
    this.timeout(200000);

    var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;

    var manyValues = [];
    for (var i = 0; i < 1000; i++) {
        manyValues[i] = Math.random() * 1000 - 500;
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
        new Variant({dataType: DataType.Double, arrayType: VariantArrayType.Array, value: new Float64Array(10 * 1024)}),
        new Variant({dataType: DataType.Double, arrayType: VariantArrayType.Array, value: new Float64Array(50 * 1024)})
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

        various_variants.forEach(function (v) {
            encode_decode_round_trip_test(v, function (stream) {
                // stream.length.should.equal(1+4+4*4);
            });
        });
    });

    it("should encode/decode a very large array of Float - 1", function () {

        var get_clock_tick = require("lib/misc/utils").get_clock_tick;

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

        this.timeout(30000);

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
                console.log(message);
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
    })
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
                console.log(message);
            })
            .on('complete', function () {

                console.log(' Fastest is ' + this.fastest.name);
                console.log(' Speed Up : x', this.speedUp);
                this.fastest.name.should.eql("Variant.encode");
                done();
            })
            .run({max_time: 0.1});
    }

    it("should verify that current Variant.encode method is better than old implementation", function (done) {

        perform_benchmark(done);
    });
});

describe("benchmarking float Array encode/decode", function () {

    this.timeout(200000);

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
                console.log(message);
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

        var NumericRange = require("lib/datamodel/numeric_range").NumericRange;
        var nr = new NumericRange("3:4");
        v.value = nr.extract_values(v.value).array;
        v.value[0].should.eql(3);
        v.value[1].should.eql(4);
        encode_decode_round_trip_test(v, function (stream) {
            stream.length.should.equal(1 + 4 + 4 + 4);
        });

    })


});