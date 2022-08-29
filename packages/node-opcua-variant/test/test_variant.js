"use strict";

const should = require("should");
const { assert } = require("node-opcua-assert");

const ul = require("lodash");
const uu = require("underscore");
const sameVariantSlow1 = ul.isEqual;
const sameVariantSlow2 = uu.isEqual;

const ec = require("node-opcua-basic-types");
const { QualifiedName, LocalizedText } = require("node-opcua-data-model");

const { encode_decode_round_trip_test } = require("node-opcua-packet-analyzer/dist/test_helpers");

const { redirectToFile } = require("node-opcua-debug/nodeJS");

const { Benchmarker } = require("node-opcua-benchmarker");
const { BinaryStream } = require("node-opcua-binary-stream");

const factories = require("node-opcua-factory");

const { NumericRange } = require("node-opcua-numeric-range");
const { StatusCodes } = require("node-opcua-status-code");
const { ExtensionObject } = require("node-opcua-extension-object");
const { resolveNodeId } = require("node-opcua-nodeid");
const { makeNodeId } = require("node-opcua-nodeid");
const { analyze_object_binary_encoding } = require("node-opcua-packet-analyzer");

const { make_debugLog, checkDebugFlag } = require("node-opcua-debug");
const { get_clock_tick } = require("node-opcua-utils");

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

describe("Variant", () => {
    it("should create a empty Variant", () => {
        const var1 = new Variant();

        var1.dataType.should.eql(DataType.Null);
        var1.arrayType.should.eql(VariantArrayType.Scalar);
        should.not.exist(var1.value);
        should.not.exist(var1.dimensions);

        encode_decode_round_trip_test(var1, (stream) => {
            stream.length.should.equal(1);
        });
    });

    it("should create a Scalar UInt32 Variant", () => {
        const var1 = new Variant({ dataType: DataType.UInt32, value: 10 });

        var1.dataType.should.eql(DataType.UInt32);
        var1.arrayType.should.eql(VariantArrayType.Scalar);
        var1.value.should.eql(10);
        encode_decode_round_trip_test(var1, (stream) => {
            stream.length.should.equal(5);
        });
    });

    it("should create a Scalar UInt64 Variant", () => {
        const var1 = new Variant({ arrayType: VariantArrayType.Scalar, dataType: DataType.UInt64, value: [10, 20] });

        var1.dataType.should.eql(DataType.UInt64);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        encode_decode_round_trip_test(var1, (stream) => {
            stream.length.should.equal(9);
        });
    });

    it("should create a Scalar LocalizedText Variant 1/2", () => {
        const var1 = new Variant({
            dataType: DataType.LocalizedText,
            value: new LocalizedText({ text: "Hello", locale: "en" })
        });

        var1.dataType.should.eql(DataType.LocalizedText);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        var1.value.schema.name.should.equal("LocalizedText");

        encode_decode_round_trip_test(var1, (stream) => {
            stream.length.should.equal(17);
        });
    });

    it("should create a Scalar LocalizedText Variant 2/2", () => {
        const var1 = new Variant({
            dataType: DataType.LocalizedText,
            value: { text: "Hello", locale: "en" }
        });

        var1.dataType.should.eql(DataType.LocalizedText);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        var1.value.schema.name.should.equal("LocalizedText");

        encode_decode_round_trip_test(var1, (stream) => {
            stream.length.should.equal(17);
        });
    });

    it("should create a Scalar QualifiedName Variant 1/2", () => {
        const var1 = new Variant({
            dataType: DataType.QualifiedName,
            value: new QualifiedName({ name: "Hello", namespaceIndex: 0 })
        });

        var1.dataType.should.eql(DataType.QualifiedName);
        var1.arrayType.should.eql(VariantArrayType.Scalar);
        var1.value.schema.name.should.equal("QualifiedName");

        encode_decode_round_trip_test(var1, (stream) => {
            // ETIENNE 26/07/2018
            stream.length.should.equal(12);
        });
    });

    it("should create a Scalar QualifiedName Variant 2/2", () => {
        const var1 = new Variant({
            dataType: DataType.QualifiedName,
            value: { name: "Hello", namespaceIndex: 0 }
        });

        var1.dataType.should.eql(DataType.QualifiedName);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        var1.value.schema.name.should.equal("QualifiedName");

        encode_decode_round_trip_test(var1, (stream) => {
            // ETIENNE 26/07/2018
            stream.length.should.equal(12);
        });
    });

    it("should create a Scalar Date Variant", () => {
        const var1 = new Variant({
            dataType: DataType.DateTime,
            value: new Date()
        });
        var1.dataType.should.eql(DataType.DateTime);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        encode_decode_round_trip_test(var1, (stream) => {
            stream.length.should.equal(9);
        });
    });
    it("should create a Scalar ByteString  Variant - null", () => {
        const var1 = new Variant({ dataType: DataType.ByteString, value: null });

        var1.dataType.should.eql(DataType.ByteString);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        encode_decode_round_trip_test(var1, (stream) => {
            stream.length.should.equal(5);
        });
    });

    it("should create a Scalar ByteString  Variant - empty buffer", () => {
        const var1 = new Variant({ dataType: DataType.ByteString, value: Buffer.alloc(0) });

        var1.dataType.should.eql(DataType.ByteString);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        encode_decode_round_trip_test(var1, (stream) => {
            stream.length.should.equal(5);
        });
    });

    it("should create a Scalar ByteString  Variant - 3 bytes", () => {
        const var1 = new Variant({ dataType: DataType.ByteString, value: Buffer.from("ABC") });

        var1.dataType.should.eql(DataType.ByteString);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        encode_decode_round_trip_test(var1, (stream) => {
            stream.length.should.equal(5 + 3);
        });
    });

    it("should create a Scalar String  Variant", () => {
        const var1 = new Variant({ dataType: DataType.String, value: "Hello" });

        var1.dataType.should.eql(DataType.String);
        var1.arrayType.should.eql(VariantArrayType.Scalar);

        encode_decode_round_trip_test(var1, (stream) => {
            stream.length.should.equal(1 + 4 + 5);
        });
    });

    it("should create a empty Array String Variant", () => {
        const var1 = new Variant({
            dataType: DataType.String,
            arrayType: VariantArrayType.Array,
            value: null
        });

        var1.dataType.should.eql(DataType.String);
        var1.arrayType.should.eql(VariantArrayType.Array);

        encode_decode_round_trip_test(var1, (stream) => {
            stream.length.should.equal(5);
        });
    });

    it("should create a Array String Variant", () => {
        const var1 = new Variant({
            dataType: DataType.String,
            arrayType: VariantArrayType.Array,
            value: ["Hello", "World"]
        });

        var1.dataType.should.eql(DataType.String);
        var1.arrayType.should.eql(VariantArrayType.Array);
        var1.value.length.should.eql(2);
        var1.value[0].should.eql("Hello");
        var1.value[1].should.eql("World");

        encode_decode_round_trip_test(var1, (stream) => {
            stream.length.should.equal(1 + 4 + (4 + 5 + 4 + 5));
        });
    });

    it("should create a Array QualifiedName Variant", () => {
        const var1 = new Variant({
            dataType: DataType.QualifiedName,
            arrayType: VariantArrayType.Array,
            value: [
                { name: "Hello", namespaceIndex: 0 },
                { name: "World", namespaceIndex: 0 }
            ]
        });

        var1.dataType.should.eql(DataType.QualifiedName);
        var1.arrayType.should.eql(VariantArrayType.Array);

        var1.value[0].schema.name.should.equal("QualifiedName");

        encode_decode_round_trip_test(var1, (stream) => {
            stream.length.should.equal(27);
        });
    });

    it("should create a Array of GUID Variant", () => {
        const var1 = new Variant({
            dataType: DataType.Guid,
            arrayType: VariantArrayType.Array,
            value: [ec.emptyGuid, ec.randomGuid(), ec.randomGuid(), ec.emptyGuid, ec.randomGuid(), ec.randomGuid()]
        });

        var1.dataType.should.eql(DataType.Guid);
        var1.arrayType.should.eql(VariantArrayType.Array);

        should(typeof var1.value[0]).be.eql("string");

        encode_decode_round_trip_test(var1, (stream) => {
            stream.length.should.equal(101);
        });
    });

    it("should detect invalid SByte Variant", () => {
        const var1 = new Variant({
            dataType: DataType.SByte,
            value: 63
        });
        var1.isValid().should.eql(true);
        var1.value = "Bad!";
        var1.isValid().should.eql(false);
    });

    it("should detect invalid Array<Int32> Variant", () => {
        const var1 = new Variant({
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

    it("should create a Variant as a Matrix (2x3) of UInt32 - Matrix given as a flat array", () => {
        const var1 = new Variant({
            dataType: DataType.UInt32,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [0x000, 0x001, 0x002, 0x010, 0x011, 0x012]
        });

        var1.arrayType.should.eql(VariantArrayType.Matrix);
        var1.dimensions.should.eql([2, 3]);
        var1.value.length.should.eql(6);
        var1.dataType.should.eql(DataType.UInt32);

        encode_decode_round_trip_test(var1, (stream) => {
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

    it("should create a Variant as a Matrix (empty) of UInt32 (edge case)", () => {
        const var1 = new Variant({
            dataType: DataType.UInt32,
            arrayType: VariantArrayType.Matrix,
            dimensions: [],
            value: []
        });
        var1.arrayType.should.eql(VariantArrayType.Matrix);
        var1.dimensions.should.eql([]);
        var1.value.length.should.eql(0);
        var1.dataType.should.eql(DataType.UInt32);

        encode_decode_round_trip_test(var1, (stream) => {
            // 1  encoding byte          1
            // 1  UInt32 => ArrayLength  4
            // 0  UInt32                 0
            // 1  Uint32                 4
            // 0  Uint32 (dimension)     0
            //                           ----
            //                           9
            stream.length.should.equal(9);
        });

        var1.toString().should.eql("Variant(Matrix[  ]<UInt32>, l= 0, value=[])");
    });

    xit("not supported - should create a Variant as a Matrix (2x3) of UInt32 - Matrix given as a Array of Array", () => {
        const var1 = new Variant({
            dataType: DataType.UInt32,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [
                [0x000, 0x001, 0x002],
                [0x010, 0x011, 0x012]
            ]
        });

        var1.arrayType.should.eql(VariantArrayType.Matrix);
        var1.dimensions.should.eql([2, 3]);

        var1.value.length.should.eql(6);

        var1.dataType.should.eql(DataType.UInt32);

        encode_decode_round_trip_test(var1, (stream) => {
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

    it("should raise an exception when construction a Matrix with incorrect element size", () => {
        should(function construct_matrix_variant_with_invalid_value() {
            const var1 = new Variant({
                dataType: DataType.UInt32,
                arrayType: VariantArrayType.Matrix,
                dimensions: [2, 3],
                value: [0x000] // wrong size !
            });
        }).throwError();
    });
    it("should raise an exception when invalid dataType : undefined", () => {
        should(function construct_matrix_variant_with_invalid_value() {
            const var1 = new Variant({
                dataType: undefined,
                arrayType: VariantArrayType.Matrix,
                dimensions: [2, 3],
                value: [0x000] // wrong size !
            });
        }).throwError();
    });
    it('should raise an exception when invalid dataType : "invalid"', () => {
        should(function construct_matrix_variant_with_invalid_value() {
            const var1 = new Variant({
                dataType: "INVALID DATATYPE",
                value: 0
            });
        }).throwError();
    });

    it("should create a Array of ByteString Variant ", () => {
        const var1 = new Variant({
            dataType: DataType.ByteString,
            value: [Buffer.from("ABC"), null]
        });

        var1.dataType.should.eql(DataType.ByteString);
        var1.arrayType.should.eql(VariantArrayType.Array);

        encode_decode_round_trip_test(var1, (stream) => {
            stream.length.should.equal(5 + 4 + 3 + 4);
        });
    });
    it("should create a Array UInt64 Variant", () => {
        const var1 = new Variant({
            arrayType: VariantArrayType.Array,
            dataType: DataType.UInt64,
            value: [
                [1, 2],
                [3, 4]
            ]
        });

        var1.dataType.should.eql(DataType.UInt64);
        var1.arrayType.should.eql(VariantArrayType.Array);

        encode_decode_round_trip_test(var1, (stream) => {
            stream.length.should.equal(5 + 8 + 8);
        });
    });

    it("should create a Array of ByteString Variant", () => {
        const value = [Buffer.from("ABCD"), null];

        const var1 = new Variant({
            arrayType: VariantArrayType.Array,
            dataType: DataType.ByteString,
            value: value
        });

        var1.dataType.should.eql(DataType.ByteString);
        var1.arrayType.should.eql(VariantArrayType.Array);

        encode_decode_round_trip_test(var1, (stream) => {
            stream.length.should.equal(17);
        });
    });

    it("should create a Array of string", () => {
        const var1 = new Variant({
            arrayType: VariantArrayType.Array,
            dataType: DataType.String,
            value: ["string1", "string2", "string3"]
        });

        var1.dataType.should.eql(DataType.String);
        var1.arrayType.should.eql(VariantArrayType.Array);

        encode_decode_round_trip_test(var1, (stream) => {
            stream.length.should.equal(38);
        });
    });

    it("should create a Array of string with unicode characters", () => {
        const var1 = new Variant({
            arrayType: VariantArrayType.Array,
            dataType: DataType.String,
            value: [
                "Hello World",
                "مرحبا بالعالم",
                "မင်္ဂလာပါကမ္ဘာလောက",
                "Chào thế giới",
                "Привет мир",
                "你好，世界",
                "こんにちは世界",
                "ନମସ୍କାର ବିଶ୍ୱବାସି",
                "🙋🏼🌐 - 👋🌎 - 👋🌍"
            ]
        });

        var1.dataType.should.eql(DataType.String);
        var1.arrayType.should.eql(VariantArrayType.Array);

        encode_decode_round_trip_test(var1, (stream) => {
            stream.length.should.equal(287);
        });
    });

    function makeFlat(arr /*: Array<Array<string>> */) /*: Array<string>*/ {
        return arr.reduce((acc, val) => acc.concat(val), []);
    }
    it("should create a Matrix of Int16", () => {
        const value = [
            [11, 12, 13],
            [21, 22, 23],
            [31, 32, 33],
            [41, 42, 43]
        ];
        const var1 = new Variant({
            arrayType: VariantArrayType.Matrix,
            dataType: DataType.Int16,
            dimensions: [3, 4],
            value: makeFlat(value)
        });

        var1.dataType.should.eql(DataType.Int16);
        var1.arrayType.should.eql(VariantArrayType.Matrix);
        var1.dimensions.should.eql([3, 4]);

        encode_decode_round_trip_test(var1, (stream) => {
            stream.length.should.equal(41);
        });
    });
    it("should create a Matrix of strings", () => {
        const value = [
            ["string", "string", "string"],
            ["string", "string", "string"],
            ["string", "string", "string"],
            ["string", "string", "string"]
        ];
        const var1 = new Variant({
            arrayType: VariantArrayType.Matrix,
            dataType: DataType.String,
            dimensions: [3, 4],
            value: makeFlat(value)
        });

        var1.dataType.should.eql(DataType.String);
        var1.arrayType.should.eql(VariantArrayType.Matrix);
        var1.dimensions.should.eql([3, 4]);

        encode_decode_round_trip_test(var1, (stream) => {
            stream.length.should.equal(137);
        });
    });
    it("AAA Variant and status Code", () => {
        const variant = new Variant({
            dataType: DataType.StatusCode,
            arrayType: VariantArrayType.Array,
            value: [StatusCodes.Good, StatusCodes.BadConditionDisabled]
        });

        const binaryStream = new BinaryStream(1000);
        variant.encode(binaryStream);

        binaryStream.rewind();

        const v = new Variant();
        v.decode(binaryStream);

        console.log(v.toString());
        v.value[0].should.eql(StatusCodes.Good);
        v.value[1].should.eql(StatusCodes.BadConditionDisabled);
    });
});

const {
    Variant,
    DataType,
    VariantArrayType,
    isValidVariant,
    buildVariantArray,
    VARIANT_ARRAY_MASK,
    coerceVariantType,
    decodeVariant
} = require("..");

describe("Variant - Analyser", function () {
    // increase timeout to cope with istanbul
    this.timeout(Math.max(400000, this.timeout()));

    const manyValues = [];
    for (let i = 0; i < 1000; i++) {
        manyValues[i] = Math.random() * 1000 - 500;
    }

    const veryLargeFloatArray = new Float64Array(10 * 1024);
    for (let i = 0; i < veryLargeFloatArray.length; i++) {
        veryLargeFloatArray[i] = (Math.random() - 0.5) * 10000;
    }
    const various_variants = [
        new Variant({ dataType: DataType.NodeId, arrayType: VariantArrayType.Scalar, value: makeNodeId(1, 2) }),
        new Variant({
            dataType: DataType.LocalizedText,
            arrayType: VariantArrayType.Scalar,
            value: new LocalizedText({ text: "Hello", locale: "en" })
        }),
        new Variant({ dataType: DataType.Double, arrayType: VariantArrayType.Scalar, value: 3.14 }),
        new Variant({ dataType: DataType.Guid, arrayType: VariantArrayType.Scalar, value: ec.randomGuid() }),

        // various Variant Array
        new Variant({ dataType: DataType.Int32, arrayType: VariantArrayType.Array /*, unspecified value*/ }),
        new Variant({ dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: [] }),
        new Variant({ dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: new Int32Array([1]) }),
        new Variant({ dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: new Int32Array([1, 2]) }),
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
        new Variant({ dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: new Int32Array(manyValues) }),
        new Variant({ dataType: DataType.Double, arrayType: VariantArrayType.Array, value: veryLargeFloatArray }),

        // variant Matrix
        new Variant({
            dataType: DataType.Int32,
            arrayType: VariantArrayType.Matrix,
            value: [1, 2, 3, 4, 5, 6],
            dimensions: [2, 3]
        }),
        new Variant({
            dataType: DataType.Int32,
            arrayType: VariantArrayType.Matrix,
            value: [1, 2, 3, 4, 5, 6],
            dimensions: [3, 2]
        }),
        new Variant({
            dataType: DataType.StatusCode,
            arrayType: VariantArrayType.Array,
            value: [StatusCodes.Good, StatusCodes.BadConditionDisabled]
        })
    ];

    //xx debugLog(various_variants.map(function(a){return a.toString()}).join("\n"));

    it("should analyze variant", () => {
        redirectToFile("variant_analyze1.log", () => {
            various_variants.forEach(function (v) {
                analyze_object_binary_encoding(v);
            });
        });
    });
    it("ZZ1 should encode/decode variant", () => {
        const v = new Variant({
            dataType: DataType.Int32,
            arrayType: VariantArrayType.Matrix,
            value: [1, 2, 3, 4, 5, 6],
            dimensions: [2, 3]
        });

        encode_decode_round_trip_test(v, (stream) => {
            // stream.length.should.equal(1+4+4*4);
        });
    });

    it("should encode/decode variant", () => {
        for (const v of various_variants) {
            encode_decode_round_trip_test(v, (stream) => {
                // stream.length.should.equal(1+4+4*4);
            });
        }
    });

    it("should encode/decode a very large array of Float - 1", () => {
        const nbElements = 1500 * 1024;

        const t0 = get_clock_tick();
        const very_large = new Variant({
            dataType: DataType.Double,
            arrayType: VariantArrayType.Array,
            value: new Float64Array(nbElements)
        });

        for (let i = 0; i < nbElements; i++) {
            very_large.value[i] = Math.random();
        }

        const t1 = get_clock_tick();
        const size = very_large.binaryStoreSize();
        size.should.eql(nbElements * 8 + 5);

        const t2 = get_clock_tick();
        const stream = new BinaryStream(Buffer.allocUnsafe(size));
        const t3 = get_clock_tick();
        very_large.encode(stream);
        const t4 = get_clock_tick();

        debugLog(" t1 = create variant   ", t1 - t0);
        debugLog(" t2 = binaryStoreSize  ", t2 - t1);
        debugLog(" t3 = new BinaryStream ", t3 - t2);
        debugLog(" t3 = encode           ", t4 - t3);
    });

    it("should encode/decode a very large array of Float", () => {
        const nbElements = 1500 * 1024;
        const very_large = new Variant({
            dataType: DataType.Double,
            arrayType: VariantArrayType.Array,
            value: new Float64Array(nbElements)
        });

        for (let i = 0; i < nbElements; i++) {
            very_large.value[i] = Math.random();
        }
        encode_decode_round_trip_test(very_large, (stream) => {
            // stream.length.should.equal(1+4+4*4);
        });
    });

    it("should check the performance of encode/decode a very large array of Float", () => {
        const length = 500 * 1024;

        debugLog("    array size = ", length);

        const obj = new Variant({
            dataType: DataType.Double,
            arrayType: VariantArrayType.Array,
            value: new Float64Array(length)
        });

        for (let i = 0; i < length; i++) {
            obj.value[i] = i;
        }
        obj.value[100].should.eql(100);

        const size = obj.binaryStoreSize();
        const stream = new BinaryStream(Buffer.allocUnsafe(size));

        const bench = new Benchmarker();

        const obj_reloaded = new Variant();

        bench
            .add("Variant.encode", () => {
                stream.rewind();
                obj.encode(stream);
            })
            .add("Variant.decode", () => {
                stream.rewind();
                obj_reloaded.decode(stream);
            })
            .on("cycle", function (message) {
                //xx debugLog(message);
            })
            .on("complete", function () {
                debugLog(" Fastest is " + this.fastest.name);
                debugLog(" Speed Up : x", this.speedUp);
                //xx this.fastest.name.should.eql("Variant.encode");
            })
            .run({ max_time: 0.2 });

        // note : the following test could be *slow* with large value of length
        //        for (let i=0;i<length;i++) { obj.value[i].should.eql(i); }
        function validate_array() {
            for (let i = 0; i < length; i++) {
                if (obj.value[i] !== i) {
                    return false;
                }
            }
            return true;
        }

        validate_array().should.eql(true);
    });
});

const old_encode = function (variant, stream) {
    // NOTE: this code matches the old implement and should not be changed
    //       It is useful to compare new performance of the encode method
    //       with the old implementation.
    assert(variant.isValid());

    let encodingByte = variant.dataType.value;

    if (variant.arrayType === VariantArrayType.Array) {
        encodingByte |= VARIANT_ARRAY_MASK;
    }
    ec.encodeUInt8(encodingByte, stream);
    const encode = factories.findBuiltInType(DataType[variant.dataType]).encode;
    /* istanbul ignore next */
    if (!encode) {
        throw new Error("Cannot find encode function for dataType " + DataType[variant.dataType]);
    }
    if (variant.arrayType === VariantArrayType.Array) {
        const arr = variant.value || [];
        ec.encodeUInt32(arr.length, stream);
        arr.forEach(function (el) {
            encode(el, stream);
        });
    } else {
        encode(variant.value, stream);
    }
};

const { encodeVariant } = require("..");

describe("encodeVariant", () => {
    it("should throw if variant is missing", () => {
        should.throws(() => {
            encodeVariant(null);
        });
    });
});

describe("benchmarking variant encode", () => {
    function perform_benchmark(done) {
        const bench = new Benchmarker();

        function test_iteration(v, s, encode) {
            s.rewind();
            encode.call(this, v, stream);
        }

        const variant = new Variant({
            dataType: DataType.UInt32,
            arrayType: VariantArrayType.Array,
            value: []
        });

        variant.value = Array.from(new Array(10000), (_, i) => i);
        const stream = new BinaryStream(variant.binaryStoreSize());

        bench
            .add("Variant.encode", () => {
                assert(typeof encodeVariant === "function");
                test_iteration(variant, stream, encodeVariant);
            })
            .add("Variant.old_encode", () => {
                assert(typeof old_encode === "function");
                test_iteration(variant, stream, old_encode);
            })
            .on("cycle", function (message) {
                // debugLog(message);
            })
            .on("complete", function () {
                debugLog(" Fastest is " + this.fastest.name);
                debugLog(" Speed Up : x", this.speedUp);
                // this test fails only on AppVeyor ! why ?
                //xx this.fastest.name.should.eql("Variant.encode");
                done();
            })
            .run({ max_time: 0.1 });
    }

    it("should verify that current Variant.encode method is better than old implementation", function (done) {
        perform_benchmark(done);
    });
});

describe("benchmarking float Array encode/decode", function () {
    this.timeout(Math.max(200000, this.timeout()));

    function test_1(stream, arr) {
        stream.writeUInt32(arr.length);
        for (let i = 0; i < arr.length; i++) {
            stream.writeFloat(arr[i]);
        }
    }

    function test_2(stream, arr) {
        stream.writeUInt32(arr.length);
        const byteArr = new Uint8Array(arr.buffer);
        const n = byteArr.length;
        for (let i = 0; i < n; i++) {
            stream.writeUInt8(byteArr[i]);
        }
    }

    function test_3(stream, arr) {
        stream.writeUInt32(arr.length);
        const byteArr = new Uint32Array(arr.buffer);
        const n = byteArr.length;
        for (let i = 0; i < n; i++) {
            stream.writeUInt32(byteArr[i]);
        }
    }

    function test_4(stream, arr) {
        stream.writeUInt32(arr.length);
        const intArray = new Uint32Array(arr.buffer);
        const n = intArray.length;
        for (let i = 0; i < n; i++) {
            stream.writeUInt32(intArray[i], true);
        }
    }

    function test_5(stream, arr) {
        stream.writeUInt32(arr.length);
        const byteArr = new Uint8Array(arr.buffer);
        const n = byteArr.length;
        for (let i = 0; i < n; i++) {
            stream.buffer[stream.length++] = byteArr[i];
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
        const bench = new Benchmarker();

        const length = 1024;
        const sampleArray = new Float32Array(length);
        for (let i = 0; i < length; i++) {
            sampleArray[i] = 1.0 / (i + 1);
        }

        const stream = new BinaryStream(length * 4 + 30);
        const variant = new Variant({
            dataType: DataType.Float,
            arrayType: VariantArrayType.Array,
            value: sampleArray
        });
        assert(variant.value.buffer instanceof ArrayBuffer);

        stream.rewind();
        const r = [test_1, test_2, test_3, test_4, test_5, test_6].map(function (fct) {
            stream.rewind();
            fct(stream, variant.value);
            const reference_buf = stream.buffer.slice(0, stream.buffer.length);
            return reference_buf.toString("hex");
        });
        r[0].should.eql(r[1]);
        r[0].should.eql(r[2]);
        r[0].should.eql(r[3]);
        r[0].should.eql(r[4]);
        r[0].should.eql(r[5]);

        bench
            .add("test1", () => {
                test_iteration(variant, stream, test_1);
            })
            .add("test2", () => {
                test_iteration(variant, stream, test_2);
            })
            .add("test3", () => {
                test_iteration(variant, stream, test_3);
            })
            .add("test4", () => {
                test_iteration(variant, stream, test_4);
            })
            .add("test5", () => {
                test_iteration(variant, stream, test_5);
            })
            .add("test6", () => {
                test_iteration(variant, stream, test_6);
            })
            .on("cycle", function (message) {
                //xx debugLog(message);
            })
            .on("complete", function () {
                debugLog(" slowest is " + this.slowest.name);
                debugLog(" Fastest is " + this.fastest.name);
                debugLog(" Speed Up : x", this.speedUp);
                // xx this.fastest.name.should.eql("test4");
                done();
            })
            .run({ max_time: 0.1 });
    }

    it("should check which is the faster way to encode decode a float", function (done) {
        perform_benchmark(done);
    });
});

describe("Variant with Advanced Array", () => {
    it("should automatically detect that variant is an array when ArrayType is missing ", () => {
        const v = new Variant({
            dataType: "Float",
            //  EXPLICITLY MISSING arrayType : VariantArrayType.Array
            value: [1, 2]
        });

        v.arrayType.should.eql(VariantArrayType.Array);

        v.value.should.be.instanceOf(Float32Array);

        encode_decode_round_trip_test(v, (stream) => {
            stream.length.should.equal(1 + 4 + 2 * 4);
        });
    });

    it("should be possible to handle an Float array  with a Float32Array", () => {
        const v = new Variant({
            dataType: DataType.Float,
            arrayType: VariantArrayType.Array,
            value: [1, 2, 3, 4]
        });
        encode_decode_round_trip_test(v, (stream) => {
            stream.length.should.equal(1 + 4 + 4 * 4);
        });
    });

    it("should be possible to encode/decode an subarray of Float32Array", () => {
        const v = new Variant({
            dataType: DataType.Float,
            arrayType: VariantArrayType.Array,
            value: [0, 1, 2, 3, 4, 5]
        });

        const nr = new NumericRange("3:4");
        v.value = nr.extract_values(v.value).array;
        v.value[0].should.eql(3);
        v.value[1].should.eql(4);
        encode_decode_round_trip_test(v, (stream) => {
            stream.length.should.equal(1 + 4 + 4 + 4);
        });
    });

    it("should be possible to read a sub matrix of a array of byte strings", () => {
        const v = new Variant({
            dataType: DataType.ByteString,
            arrayType: VariantArrayType.Array,
            value: ["ABCDEFGHIJKL", "BCDEFGHIJKLA", "CDEFGHIJKLAB", "DEFGHIJKLABC", "EFGHIJKLABCD", "FGHIJKLABCDE"]
        });

        const nr = new NumericRange("3:4,1:3");

        nr.isValid().should.eql(true);

        const results = nr.extract_values(v.value);
        results.statusCode.should.eql(StatusCodes.Good);

        results.array.should.eql([Buffer.from("EFG"), Buffer.from("FGH")]);
    });

    it("AA should be possible to read a sub matrix of a matrix of double", () => {
        const v = new Variant({
            dataType: DataType.Double,
            arrayType: VariantArrayType.Matrix,
            dimensions: [5, 4],
            value: [
                0x000, 0x001, 0x002, 0x003, 0x100, 0x101, 0x102, 0x103, 0x200, 0x201, 0x202, 0x203, 0x300, 0x301, 0x302, 0x303,
                0x400, 0x401, 0x402, 0x403
            ]
        });

        const nr = new NumericRange("3:4,1:3");

        nr.isValid().should.eql(true);

        const results = nr.extract_values(v.value, v.dimensions); // << We must provide dimension here
        results.statusCode.should.eql(StatusCodes.Good);

        results.dimensions.should.eql([2, 3]);

        results.array.should.eql(new Float64Array([0x301, 0x302, 0x303, 0x401, 0x402, 0x403]));
    });
});

describe("Variant with enumeration", () => {
    const SomeEnum = DataType;

    before(() => {
        should.exist(SomeEnum.DiagnosticInfo);
    });

    it("should fail to create a variant from a enumeration item if dataType is not Int32", () => {
        should(() => {
            const v = new Variant({
                dataType: DataType.UInt32,
                value: SomeEnum.DiagnosticInfo
            });
            v.value.should.eql(0);
        }).throw();
    });

    it("should create a variant from a enumeration item", () => {
        should.exist(SomeEnum.DiagnosticInfo);
        const v = new Variant({
            dataType: DataType.Int32,
            value: SomeEnum.DiagnosticInfo
        });
        // debugLog(v.toString());
        v.value.should.eql(SomeEnum.DiagnosticInfo);
    });

    xit("should not be necessary to specify the dataType for  a variant containing  enumeration item", () => {
        const v = new Variant({
            value: SomeEnum.DiagnosticInfo
        });
        // debugLog(v.toString());
        v.value.should.eql(1);
        v.dataType.should.eql(DataType.Int32);
    });

    it("should create a variant with builtin type 'Duration'", () => {
        const v = new Variant({
            dataType: "Duration",
            value: 0.1
        });
        v.dataType.should.eql(DataType.Double);
        v.value.should.eql(0.1);
    });
    it("should create a variant with builtin type 'ByteString'", () => {
        const v = new Variant({
            dataType: "ByteString",
            value: Buffer.from("abcd")
        });
        v.dataType.should.eql(DataType.ByteString);
        v.value.toString("utf-8").should.eql("abcd");
    });
    it("should create a variant copy (with it's own array) ", () => {
        const options = {
            dataType: DataType.Float,
            arrayType: VariantArrayType.Array,
            value: [0, 1, 2, 3, 4, 5]
        };

        let v1, v2, v3;
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

    it("should create a Extension object variant as a copy of ", () => {
        const variant1 = new Variant({
            dataType: DataType.ExtensionObject,
            value: null
        });
        const variant2 = new Variant(variant1);
    });
    it("should create a Extension object Array  variant as a copy of ", () => {
        const variant1 = new Variant({
            dataType: DataType.ExtensionObject,
            arrayType: VariantArrayType.Array,
            value: [null, null]
        });

        const variant2 = new Variant(variant1);
    });
});

const { sameVariant } = require("..");

describe("testing sameVariant Performance", function () {
    this.timeout(Math.max(50 * 1000, this.timeout()));

    function largeArray(n) {
        const a = new Int32Array(n);
        for (let i = 0; i < n; i++) {
            a[i] = Math.random() * 10000;
        }
        return a;
    }

    const largeArray1 = largeArray(10000);

    function build_variants() {
        const a = [
            new Variant({ dataType: DataType.String, arrayType: VariantArrayType.Array, value: null }),
            new Variant({ dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: null }),
            new Variant({ dataType: DataType.String, value: "Hello" }),
            new Variant({ dataType: DataType.String, value: "HelloWorld" }),
            new Variant({ dataType: DataType.Double, value: 42.0 }),
            new Variant({ dataType: DataType.Float, value: 42.0 }),
            new Variant({ dataType: DataType.Int32, value: 42 }),
            new Variant({ dataType: DataType.UInt32, value: 42 }),
            new Variant({ dataType: DataType.Double, value: 43.0 }),
            new Variant({ dataType: DataType.Float, value: 43.0 }),
            new Variant({ dataType: DataType.Int32, value: 43 }),
            new Variant({ dataType: DataType.UInt32, value: 43 }),
            new Variant({ dataType: DataType.UInt64, value: [43, 100], arrayType: VariantArrayType.Scalar }),
            new Variant({ dataType: DataType.Int64, value: [43, 1000], arrayType: VariantArrayType.Scalar }),
            new Variant({ dataType: DataType.String, arrayType: VariantArrayType.Array, value: ["Hello", "World"] }),
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
            new Variant({
                dataType: DataType.Int32,
                arrayType: VariantArrayType.Array,
                value: largeArray1
            }),
            new Variant({
                dataType: DataType.UInt64,
                arrayType: VariantArrayType.Array,
                value: [
                    [44, 888],
                    [43, 100]
                ]
            }),
            new Variant({
                dataType: DataType.Int64,
                arrayType: VariantArrayType.Array,
                value: [
                    [44, 888],
                    [43, 100]
                ]
            }),
            new Variant({
                dataType: DataType.ExtensionObject,
                arrayType: VariantArrayType.Scalar,
                value: null
            }),
            null
        ];

        // create artificial null array variant
        a[0].value = null;
        a[1].value = null;

        return a;
    }

    const variousVariants = build_variants();
    const variousVariants_clone = build_variants();

    function _t(t) {
        return t ? t.toString() : "<null>";
    }

    function test_variant(index, sameVariant) {
        const v1 = variousVariants[index];

        for (let i = 0; i < variousVariants.length; i++) {
            if (i === index) {
                sameVariant(v1, variousVariants[i]).should.eql(true, _t(v1) + " === " + _t(variousVariants[i]));
            } else {
                sameVariant(v1, variousVariants[i]).should.eql(
                    false,
                    "i=" + i + " " + index + " " + _t(v1) + " !== " + _t(variousVariants[i])
                );
            }
        }
        sameVariant(v1, variousVariants_clone[index]).should.eql(true);
    }

    for (let i = 0; i < variousVariants.length; i++) {
        const v1 = variousVariants[i];
        it("#sameVariant with " + (v1 ? v1.toString() : "null"), test_variant.bind(null, i, sameVariant));
    }

    it("sameVariant should be very efficient ", () => {
        const bench = new Benchmarker();

        bench
            .add("fast sameVariant", () => {
                for (let i = 0; i < variousVariants.length; i++) {
                    for (let j = 0; j < variousVariants.length; j++) {
                        sameVariant(variousVariants[i], variousVariants_clone[j]);
                    }
                }
            })
            .add("slow sameVariant 1", () => {
                for (let i = 0; i < variousVariants.length; i++) {
                    for (let j = 0; j < variousVariants.length; j++) {
                        sameVariantSlow1(variousVariants[i], variousVariants_clone[j]);
                    }
                }
            })
            .add("slow sameVariant 2", () => {
                for (let i = 0; i < variousVariants.length; i++) {
                    for (let j = 0; j < variousVariants.length; j++) {
                        sameVariantSlow2(variousVariants[i], variousVariants_clone[j]);
                    }
                }
            })
            .on("cycle", function (message) {
                debugLog(message);
            })
            .on("complete", function () {
                debugLog(" Fastest is " + this.fastest.name);
                debugLog(" Speed Up : x", this.speedUp);
                this.fastest.name.should.eql("fast sameVariant");
                // with istanbul, speedUp may be not as high as we would expect ( x10 !)
                // this.speedUp.should.be.greaterThan(10);
            })
            .run({ max_time: 1 /*second */ });
    });
});

class SomeExtensionObject extends ExtensionObject {
    constructor(options) {
        super();
        this.a = options.a;
    }
}

describe("testing variant Clone & Copy Construct", () => {
    function copy_construct(v) {
        return new Variant(v);
    }

    function clone(v) {
        return v.clone();
    }

    function install_test(copy_construct_or_clone, copy_construct_or_clone_func) {
        it("should " + copy_construct_or_clone + " a simple variant", () => {
            const v = new Variant({
                dataType: DataType.UInt32,
                value: 36
            });

            const cloned = copy_construct_or_clone_func(v);

            cloned.dataType.should.eql(v.dataType);
            cloned.value.should.eql(v.value);
        });
        it("should " + copy_construct_or_clone + " a variant array", () => {
            const v = new Variant({
                dataType: DataType.UInt32,
                value: [36, 37]
            });

            const cloned = copy_construct_or_clone_func(v);

            cloned.dataType.should.eql(v.dataType);
            cloned.value.should.eql(v.value);
            cloned.value[0].should.eql(36);
            cloned.value[1].should.eql(37);

            v.value[0] = 136;
            v.value[1] = 137;

            cloned.value[0].should.eql(36);
            cloned.value[1].should.eql(37);
        });
        it("should " + copy_construct_or_clone + " a variant containing a extension object", () => {
            const extObj = new SomeExtensionObject({ a: 36 });
            const v = new Variant({
                dataType: DataType.ExtensionObject,
                value: extObj
            });

            const cloned = copy_construct_or_clone_func(v);

            cloned.dataType.should.eql(v.dataType);
            cloned.value.a.should.eql(v.value.a);

            extObj.a = 1000;

            cloned.value.should.not.equal(v.value);
            cloned.value.a.should.equal(36);

            v.value.a.should.eql(1000);
        });
        it("should " + copy_construct_or_clone + " a variant containing a extension object array", () => {
            const extObj1 = new SomeExtensionObject({ a: 36 });
            const extObj2 = new SomeExtensionObject({ a: 37 });
            const v = new Variant({
                dataType: DataType.ExtensionObject,
                arrayType: VariantArrayType.Array,
                value: [extObj1, extObj2]
            });

            // copy construct;,
            const cloned = copy_construct_or_clone_func(v);

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

describe("miscellaneous Variant tests", () => {
    it("toString on Variant Null", () => {
        const var1 = new Variant({
            dataType: DataType.Null
        });
        var1.toString().should.eql("Variant(Scalar<Null>, value: <null>)");
    });
    it("toString on Variant Date", () => {
        const var1 = new Variant({
            dataType: DataType.DateTime,
            value: new Date(Date.UTC(2019, 6, 14))
        });
        var1.toString().should.eql("Variant(Scalar<DateTime>, value: 2019-07-14T00:00:00.000Z)");
    });
    it("toString on Variant boolean", () => {
        const var1 = new Variant({
            dataType: DataType.Boolean,
            value: true
        });
        var1.toString().should.eql("Variant(Scalar<Boolean>, value: true)");
    });
    it("toString on Variant ByteString", () => {
        const var1 = new Variant({
            dataType: DataType.ByteString,
            value: Buffer.from("Hello")
        });
        var1.toString().should.eql("Variant(Scalar<ByteString>, value: 0x48656c6c6f)");
        const var2 = new Variant({
            dataType: DataType.ByteString,
            value: undefined
        });
        var2.toString().should.eql("Variant(Scalar<ByteString>, value: <null>)");
    });

    it("decodeVariant", () => {
        const stream = new BinaryStream(1000);
        const var1 = new Variant();
        var1.encode(stream);
        stream.rewind();
        const var2 = decodeVariant(stream);
        var2.toString().should.eql("Variant(Scalar<Null>, value: <null>)");
    });

    it("coerce", () => {
        Variant.coerce({ dataType: "Double", value: 3.14 }).toString().should.eql("Variant(Scalar<Double>, value: 3.14)");
    });
});

describe("testing variant JSON conversion", () => {
    it("should produce the expected output when converting Variant to JSON", () => {
        const b1 = new Variant({
            dataType: DataType.Boolean,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [true, true, true, true, true, true]
        });
        const jsonStr = JSON.stringify(b1, null, "");
        jsonStr.should.eql(
            `{"dataType":"Boolean","arrayType":"Matrix","value":[true,true,true,true,true,true],"dimensions":[2,3]}`
        );
    });

    it("should construct a Variant from a JSON string generated by a Variant", () => {
        const b1 = new Variant({
            dataType: DataType.Boolean,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [true, true, true, true, true, true]
        });
        const jsonStr = JSON.stringify(b1, null, "");

        // debugLog(JSON.parse(jsonStr));

        const b2 = new Variant(JSON.parse(jsonStr));
        const jsonStr2 = JSON.stringify(b2, null, "");

        jsonStr2.should.eql(jsonStr);
    });

    it("should convert a Variant with ExtensionObject Array to JSON", () => {
        class SomeExtensionObject extends ExtensionObject {
            constructor(options /*: { name: string } */) {
                super();
                this.name = options.name;
            }
            toJSON() {
                return { name: this.name };
            }
        }

        const variant = new Variant({
            dataType: DataType.ExtensionObject,
            arrayType: VariantArrayType.Array,
            value: [
                new SomeExtensionObject({
                    name: "1"
                }),
                new SomeExtensionObject({
                    name: "2"
                })
            ]
        });

        debugLog(variant.toJSON());
        debugLog(variant.toString());
    });
    it("should convert a Variant with ExtensionObject to JSON", () => {
        class SomeExtensionObject extends ExtensionObject {
            constructor(options /*: { name: string } */) {
                super();
                this.name = options.name;
            }
            toJSON() {
                return { name: this.name };
            }
        }

        const variant = new Variant({
            dataType: DataType.ExtensionObject,
            arrayType: VariantArrayType.Scalar,
            value: new SomeExtensionObject({
                name: "1"
            })
        });

        debugLog(variant.toJSON());
        debugLog(variant.toString());
    });

    it("dimensions shall be set to null if not specified ", () => {
        const variant = new Variant({
            dataType: DataType.StatusCode,
            value: StatusCodes.BadConditionDisabled
        });
        should(variant.dimensions).eql(null);
    });
});

describe("testing isValidVariant", () => {
    it("isValidVariant with scalar", () => {
        isValidVariant(VariantArrayType.Scalar, DataType.Double, 3.15).should.eql(true);
        isValidVariant(VariantArrayType.Scalar, DataType.Byte, 655525).should.eql(false);
    });
    it("isValidVariant with Array", () => {
        isValidVariant(VariantArrayType.Array, DataType.Double, [-2.24, 3.15]).should.eql(true);
        isValidVariant(VariantArrayType.Array, DataType.Byte, [655525, 12]).should.eql(false);

        isValidVariant(VariantArrayType.Array, DataType.Float, buildVariantArray(DataType.Float, 3, 0)).should.eql(true);
        isValidVariant(VariantArrayType.Array, DataType.Double, buildVariantArray(DataType.Double, 3, 0)).should.eql(true);

        isValidVariant(VariantArrayType.Array, DataType.Byte, buildVariantArray(DataType.Byte, 3, 0)).should.eql(true);
        isValidVariant(VariantArrayType.Array, DataType.SByte, buildVariantArray(DataType.SByte, 3, 0)).should.eql(true);
        isValidVariant(VariantArrayType.Array, DataType.UInt16, buildVariantArray(DataType.UInt16, 3, 0)).should.eql(true);
        isValidVariant(VariantArrayType.Array, DataType.Int16, buildVariantArray(DataType.Int16, 3, 0)).should.eql(true);
        isValidVariant(VariantArrayType.Array, DataType.UInt32, buildVariantArray(DataType.UInt32, 3, 0)).should.eql(true);
        isValidVariant(VariantArrayType.Array, DataType.Int32, buildVariantArray(DataType.Int32, 3, 0)).should.eql(true);

        isValidVariant(VariantArrayType.Array, DataType.Int32, null).should.eql(true);
    });

    it("isValidVariant with Matrix", () => {
        isValidVariant(VariantArrayType.Matrix, DataType.Double, [-2.24, 3.15], [1, 2]).should.eql(true);
        isValidVariant(VariantArrayType.Matrix, DataType.Byte, [655525, 12], [1, 2]).should.eql(false);
    });

    it("variantToString 1", () => {
        const v = new Variant({ dataType: DataType.NodeId, value: resolveNodeId("i=24") });
        v.toString().should.eql("Variant(Scalar<NodeId>, value: BaseDataType (ns=0;i=24))");
    });
    it("variantToString 2", () => {
        const v = new Variant({ dataType: DataType.ByteString, value: null });
        v.toString().should.eql("Variant(Scalar<ByteString>, value: <null>)");
    });
    it("variantToString 3", () => {
        const v = new Variant({ dataType: DataType.DateTime, value: null });
        v.toString().should.eql("Variant(Scalar<DateTime>, value: <null>)");
    });
    it("variantToString 4", () => {
        const v = new Variant({ dataType: DataType.DateTime, arrayType: VariantArrayType.Array, value: null });
        v.toString().should.eql("Variant(Array<DateTime>, null)");
    });
    it("variantToString 5", () => {
        const v = new Variant({ dataType: "DateTime", arrayType: "Array", value: null });
        v.toString().should.eql("Variant(Array<DateTime>, null)");
    });
});

describe("Preserving  null in Arrays or Matrices", () => {
    it("it should preserve empty array ... String", () => {
        const v = new Variant({ dataType: DataType.String, value: [], arrayType: VariantArrayType.Array });
        should(v.value).eql([]);
        const v_reloaded = encode_decode_round_trip_test(v);
        should(v_reloaded.value).eql([]);
    });
    it("it should preserve null array ... String", () => {
        const v = new Variant({ dataType: DataType.String, value: null, arrayType: VariantArrayType.Array });
        should(v.value).eql(null);
        const v_reloaded = encode_decode_round_trip_test(v);
        should(v_reloaded.value).eql(null);
    });
    it("it should preserve empty array ... UInt32 ", () => {
        const v = new Variant({ dataType: DataType.UInt16, value: [], arrayType: VariantArrayType.Array });
        should(v.value).instanceOf(Uint16Array);
        const v_reloaded = encode_decode_round_trip_test(v);
        should(v_reloaded.value).instanceOf(Uint16Array);
    });
    it("it should preserve null array ... UInt32", () => {
        const v = new Variant({ dataType: DataType.UInt16, value: null, arrayType: VariantArrayType.Array });
        should(v.value).eql(null);
        const v_reloaded = encode_decode_round_trip_test(v);
        should(v_reloaded.value).eql(null);
    });
});
