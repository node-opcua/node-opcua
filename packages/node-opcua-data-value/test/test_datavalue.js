"use strict";
Error.stackTraceLimit = 1000;
const util = require("util");
const should = require("should");
const { Variant, DataType, VariantArrayType } = require("node-opcua-variant");
const { NumericRange } = require("node-opcua-numeric-range");
const { StatusCodes } = require("node-opcua-status-code");
const { ExtensionObject } = require("node-opcua-extension-object");
const { encode_decode_round_trip_test } = require("node-opcua-packet-analyzer/dist/test_helpers");

const { DataValue, extractRange } = require("..");

require("should");
const doDebug = process.env.DEBUG;

describe("DataValue", () => {
    it("should create a empty DataValue and encode it as a 1-Byte length block", () => {
        const dataValue = new DataValue();

        encode_decode_round_trip_test(dataValue, function (buffer /*, id*/) {
            buffer.length.should.equal(1);
        });
    });

    it("should create a DataValue with string variant and encode/decode it nicely ", () => {
        const dataValue = new DataValue({
            value: new Variant({ dataType: DataType.String, value: "Hello" })
        });
        encode_decode_round_trip_test(dataValue, function (buffer /*, id*/) {
            buffer.length.should.equal(1 + 1 + 4 + 5);
        });
    });

    it("should create a DataValue with string variant and some date and encode/decode it nicely", () => {
        const dataValue = new DataValue({
            value: new Variant({ dataType: DataType.String, value: "Hello" }),
            serverTimestamp: new Date(Date.UTC(1601, 0, 1, 0, 0, 1)),
            serverPicoseconds: 50000,
            sourceTimestamp: new Date(Date.UTC(1601, 0, 1, 0, 0, 2)),
            sourcePicoseconds: 25000 // 25 nano
        });
        //xx var str = dataValue.toString();
        encode_decode_round_trip_test(dataValue, function (/*buffer, id*/) {
            /** */
        });
    });

    it("should create a DataValue with string variant and all dates and encode/decode it nicely", () => {
        const dataValue = new DataValue({
            value: new Variant({ dataType: DataType.String, value: "Hello" }),
            statusCode: StatusCodes.BadCertificateHostNameInvalid,
            serverTimestamp: new Date(Date.UTC(2018, 1, 23, 12, 34, 56, 789)),
            serverPicoseconds: 987654320,
            sourceTimestamp: new Date(Date.UTC(2018, 1, 23, 18, 54, 12, 345)),
            sourcePicoseconds: 12345670
        });
        encode_decode_round_trip_test(dataValue, function (/*buffer, id*/) {
            /** */
        });
    });

    it("DataValue#toString", () => {
        let dataValue = new DataValue({
            value: new Variant({ dataType: DataType.String, value: "Hello" }),
            statusCode: StatusCodes.BadCertificateHostNameInvalid,
            serverTimestamp: new Date(Date.UTC(1789, 6, 14)),
            serverPicoseconds: 1000,
            sourceTimestamp: new Date(Date.UTC(2089, 6, 14)),
            sourcePicoseconds: 2000
        });
        let str = dataValue.toString();
        str.split(/\n/).should.eql([
            "{ /* DataValue */",
            "   value: Variant(Scalar<String>, value: Hello)",
            "   statusCode:      BadCertificateHostNameInvalid (0x80160000)",
            "   serverTimestamp: 1789-07-14T00:00:00.000Z $ 000.001.000",
            "   sourceTimestamp: 2089-07-14T00:00:00.000Z $ 000.002.000",
            "}"
        ]);

        dataValue = new DataValue({
            value: new Variant({ dataType: DataType.String, value: "Hello" }),
            statusCode: StatusCodes.BadCertificateHostNameInvalid,
            serverTimestamp: null,
            serverPicoseconds: null,
            sourceTimestamp: new Date(Date.UTC(2089, 6, 14)),
            sourcePicoseconds: 2000
        });
        str = dataValue.toString();
        str.split(/\n/).should.eql([
            "{ /* DataValue */",
            "   value: Variant(Scalar<String>, value: Hello)",
            "   statusCode:      BadCertificateHostNameInvalid (0x80160000)",
            "   serverTimestamp: null",
            "   sourceTimestamp: 2089-07-14T00:00:00.000Z $ 000.002.000",
            "}"
        ]);
    });

    it("DataValue - extractRange on a Float Array", () => {
        const dataValue = new DataValue({
            value: new Variant({
                dataType: DataType.Double,
                arrayType: VariantArrayType.Array,
                value: new Float64Array([1, 2, 3, 4, 5, 6, 7])
            })
        });
        const dataValue1 = extractRange(dataValue, new NumericRange("2:3"));
        dataValue1.statusCode.should.eql(StatusCodes.Good);
        dataValue1.value.value.length.should.eql(2);
        dataValue1.value.value[0].should.eql(3.0);
        dataValue1.value.value[1].should.eql(4.0);
        dataValue1.value.dataType.should.eql(DataType.Double);
        dataValue1.value.arrayType.should.eql(VariantArrayType.Array);
    });
    it("DataValue - extractRange on a String", () => {
        const dataValue = new DataValue({
            value: new Variant({
                dataType: DataType.String,
                arrayType: VariantArrayType.Scalar,
                value: "1234567890"
            })
        });
        const dataValue1 = extractRange(dataValue, new NumericRange("2:3"));
        dataValue1.statusCode.should.eql(StatusCodes.Good);
        dataValue1.value.value.length.should.eql(2);
        dataValue1.value.value.should.eql("34");
        dataValue1.value.dataType.should.eql(DataType.String);
        dataValue1.value.arrayType.should.eql(VariantArrayType.Scalar);
    });
    it("DataValue - extractRange on a String with StatusCode != Good - issue #635", () => {
        const dataValue = new DataValue({
            statusCode: StatusCodes.BadAlreadyExists,
            value: new Variant({
                dataType: DataType.String,
                arrayType: VariantArrayType.Scalar,
                value: "1234567890"
            })
        });
        const dataValue1 = extractRange(dataValue, new NumericRange("2:3"));
        dataValue1.value.value.length.should.eql(2);
        dataValue1.value.value.should.eql("34");
        dataValue1.value.dataType.should.eql(DataType.String);
        dataValue1.value.arrayType.should.eql(VariantArrayType.Scalar);

        dataValue1.statusCode.should.eql(StatusCodes.BadAlreadyExists);
    });
    it("DataValue - extractRange on a String with StatusCode != Good and invalid range - issue #635", () => {
        const dataValue = new DataValue({
            statusCode: StatusCodes.BadAlreadyExists,
            value: new Variant({
                dataType: DataType.String,
                arrayType: VariantArrayType.Scalar,
                value: "1234567890"
            })
        });
        const dataValue1 = extractRange(dataValue, new NumericRange("20:30"));
        dataValue1.value.value.length.should.eql(0);
        dataValue1.value.value.should.eql("");
        dataValue1.value.dataType.should.eql(DataType.String);
        dataValue1.value.arrayType.should.eql(VariantArrayType.Scalar);

        dataValue1.statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
    });

    it("DataValue - extractRange on a ByteString", () => {
        const dataValue = new DataValue({
            value: new Variant({
                dataType: DataType.ByteString,
                arrayType: VariantArrayType.Scalar,
                value: Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
            })
        });
        const dataValue1 = extractRange(dataValue, new NumericRange("2:3"));
        dataValue1.statusCode.should.eql(StatusCodes.Good);
        dataValue1.value.value.length.should.eql(2);
        dataValue1.value.value[0].should.eql(3.0);
        dataValue1.value.value[1].should.eql(4.0);
        dataValue1.value.dataType.should.eql(DataType.ByteString);
        dataValue1.value.arrayType.should.eql(VariantArrayType.Scalar);
    });

    it("DataValue - extractRange on a ByteString (null value)", () => {
        const dataValue = new DataValue({
            value: new Variant({
                dataType: DataType.ByteString,
                arrayType: VariantArrayType.Scalar,
                value: null
            })
        });
        const dataValue1 = extractRange(dataValue, new NumericRange("2:3"));
        dataValue1.statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
        dataValue1.value.dataType.should.eql(DataType.ByteString);
        dataValue1.value.arrayType.should.eql(VariantArrayType.Scalar);
        should.equal(null, dataValue1.value.value);
    });

    it("DataValue - extractRange on a Array of ByteString", () => {
        const dataValue = new DataValue({
            value: new Variant({
                dataType: DataType.ByteString,
                arrayType: VariantArrayType.Array,
                value: [Buffer.from("ABC"), Buffer.from("DEF"), Buffer.from("GHI"), Buffer.from("JKL"), null]
            })
        });
        const dataValue1 = extractRange(dataValue, new NumericRange("2:3"));
        dataValue1.statusCode.should.eql(StatusCodes.Good);
        dataValue1.value.value.length.should.eql(2);
        dataValue1.value.value[0].toString().should.eql("GHI");
        dataValue1.value.value[1].toString().should.eql("JKL");
        dataValue1.value.dataType.should.eql(DataType.ByteString);
        dataValue1.value.arrayType.should.eql(VariantArrayType.Array);
    });
    it("DataValue - extractRange on a Matrix of ByteString", () => {
        const dataValue = new DataValue({
            value: new Variant({
                dataType: DataType.ByteString,
                arrayType: VariantArrayType.Matrix,
                dimensions: [3, 3],
                value: [
                    //[
                    Buffer.from("11"),
                    Buffer.from("12"),
                    Buffer.from("13"), //],
                    //[
                    Buffer.from("21"),
                    Buffer.from("22"),
                    Buffer.from("23"), //],
                    //[
                    Buffer.from("31"),
                    Buffer.from("32"),
                    Buffer.from("33")
                    //]
                ]
            })
        });
        const dataValue1 = extractRange(dataValue, new NumericRange("2,1:2"));
        dataValue1.statusCode.should.eql(StatusCodes.Good);
        dataValue1.value.value.length.should.eql(2);
        dataValue1.value.value[0].toString().should.eql("32");
        dataValue1.value.value[1].toString().should.eql("33");
        dataValue1.value.dataType.should.eql(DataType.ByteString);
        dataValue1.value.arrayType.should.eql(VariantArrayType.Matrix);
        dataValue1.value.dimensions.should.eql([1, 2]);
    });
    it("DataValue - extractRange on invalid range - edge case", () => {
        const dataValue = new DataValue({
            value: new Variant({
                dataType: DataType.ByteString,
                arrayType: VariantArrayType.Scalar,
                value: null
            })
        });
        const invalidRange = new NumericRange("-2:0xFF");
        invalidRange.isValid().should.eql(false);
        const dataValue1 = extractRange(dataValue, invalidRange);
        dataValue1.statusCode.should.eql(StatusCodes.BadIndexRangeInvalid);
        should.equal(null, dataValue1.value.value);
    });
    describe("Cloning a DataValue", () => {
        function SomeExtensionObject(options) {
            this.a = options.a;
        }
        util.inherits(SomeExtensionObject, ExtensionObject);

        function copy_construct(v) {
            return new DataValue(v);
        }

        function clone(v) {
            return v.clone();
        }

        function install_test(copy_construct_or_clone, copy_construct_or_clone_func) {
            it("should " + copy_construct_or_clone + " a DataValue with a simple Variant", () => {
                const dv = new DataValue({
                    value: {
                        dataType: DataType.UInt32,
                        value: 36
                    }
                });
                const cloned = copy_construct_or_clone_func(dv);

                cloned.value.dataType.should.eql(dv.value.dataType);
                cloned.value.value.should.eql(dv.value.value);
            });
            it("should " + copy_construct_or_clone + " a DataValue with a variant array", () => {
                const dv = new DataValue({
                    value: {
                        dataType: DataType.UInt32,
                        value: [36, 37]
                    }
                });

                const cloned = copy_construct_or_clone_func(dv);

                cloned.value.dataType.should.eql(dv.value.dataType);
                cloned.value.value.should.eql(dv.value.value);
                cloned.value.value[0].should.eql(36);
                cloned.value.value[1].should.eql(37);

                dv.value.value[0] = 136;
                dv.value.value[1] = 137;

                cloned.value.value[0].should.eql(36);
                cloned.value.value[1].should.eql(37);
            });
            it("should " + copy_construct_or_clone + " a DataValue with a variant array of ByteString", () => {
                const dv = new DataValue({
                    value: new Variant({
                        dataType: DataType.ByteString,
                        arrayType: VariantArrayType.Array,
                        value: [Buffer.from("ABC"), Buffer.from("DEF"), Buffer.from("GHI"), Buffer.from("JKL"), null]
                    })
                });

                const cloned = copy_construct_or_clone_func(dv);

                cloned.value.dataType.should.eql(dv.value.dataType);
                cloned.value.value.should.eql(dv.value.value);
                cloned.value.value[0].toString().should.eql(dv.value.value[0].toString());
                cloned.value.value[1].toString().should.eql(dv.value.value[1].toString());
                cloned.value.value[2].toString().should.eql(dv.value.value[2].toString());
                cloned.value.value[3].toString().should.eql(dv.value.value[3].toString());

                dv.value.value[0] = Buffer.from("ZZZ");
                dv.value.value[1] = Buffer.from("YYY");

                // clone object should not have been affected !
                cloned.value.value[0].toString().should.eql("ABC");
                cloned.value.value[1].toString().should.eql("DEF");
            });

            it("should " + copy_construct_or_clone + " a DataValue with a variant containing a extension object", () => {
                const extObj = new SomeExtensionObject({ a: 36 });
                const dv = new DataValue({
                    value: {
                        dataType: DataType.ExtensionObject,
                        value: extObj
                    }
                });

                const cloned = copy_construct_or_clone_func(dv);

                cloned.value.dataType.should.eql(dv.value.dataType);
                cloned.value.value.a.should.eql(dv.value.value.a);

                extObj.a = 1000;

                cloned.value.value.should.not.equal(dv.value.value);
                cloned.value.value.a.should.equal(36);

                dv.value.value.a.should.eql(1000);
            });
            it("should " + copy_construct_or_clone + " a DataValue with a variant containing a extension object array", () => {
                const extObj1 = new SomeExtensionObject({ a: 36 });
                const extObj2 = new SomeExtensionObject({ a: 37 });
                const dv = new DataValue({
                    value: {
                        dataType: DataType.ExtensionObject,
                        arrayType: VariantArrayType.Array,
                        value: [extObj1, extObj2]
                    }
                });

                // copy construct;,
                const cloned = copy_construct_or_clone_func(dv);

                cloned.value.dataType.should.eql(dv.value.dataType);
                cloned.value.value[0].a.should.eql(36);
                cloned.value.value[1].a.should.eql(37);

                extObj1.a = 1000;
                extObj2.a = 1001;

                cloned.value.value[0].a.should.eql(36);
                cloned.value.value[1].a.should.eql(37);

                dv.value.value[0].a.should.eql(1000);
                dv.value.value[1].a.should.eql(1001);
            });
        }

        install_test("copy construct", copy_construct);
        install_test("clone", clone);
    });

    it("toJSON issue#1074", () => {
        const dataValue = new DataValue({
            statusCode: StatusCodes.BadAggregateListMismatch,
            serverTimestamp: new Date(Date.UTC(1789, 6, 14)),
            value: {
                dataType: DataType.Int16,
                arrayType: VariantArrayType.Array,
                value: [12, 13, 14]
            }
        });
        console.log(dataValue.toJSON());
        console.log(JSON.stringify(dataValue.toJSON()));
    
        console.log(JSON.stringify(dataValue, (k, v) => ArrayBuffer.isView(v) ? Array.from(v) : v));
        
    });

    it("should convert a DataValue to a JSON Object", () => {
        const dataValue = new DataValue({
            statusCode: StatusCodes.BadAggregateListMismatch,
            serverTimestamp: new Date(Date.UTC(1789, 6, 14)),
            value: {
                dataType: DataType.UInt16,
                arrayType: VariantArrayType.Array,
                value: [12, 13, 14]
            }
        });

        // it should be possible to convert a DataValue to a JSON object
        console.log(dataValue.toJSON());

        const json = dataValue.toJSON();
        json.should.eql({
            value: {
                dataType: "UInt16",
                arrayType: "Array",
                value: new Uint16Array([12, 13, 14])
            },
            statusCode: { value: 2161377280 },
            sourcePicoseconds: 0,
            serverTimestamp: "1789-07-14T00:00:00.000Z",
            serverPicoseconds: 0
        });
        // it should be possible to reconstruct a dataValue from the json object
        const dataValue1 = new DataValue(json);
        const json1 = dataValue1.toJSON();
        json1.should.eql({
            value: {
                dataType: "UInt16",
                arrayType: "Array",
                value: new Uint16Array([12, 13, 14])
            },
            statusCode: { value: 2161377280 },
            sourcePicoseconds: 0,
            serverTimestamp: "1789-07-14T00:00:00.000Z",
            serverPicoseconds: 0
        });
        // console.log(dataValue1.toString());
    });
    it("should convert a DataValue with ExtensionObject to JSON", () => {
        class SomeExtensionObject extends ExtensionObject {
            constructor(options /*: { name: string } */) {
                super();
                this.name = options.a;
            }
            toJSON() {
                return { name: this.name };
            }
        }

        const dataValue = new DataValue({
            statusCode: StatusCodes.BadAggregateListMismatch,
            serverTimestamp: new Date(17898, 6, 14),
            value: {
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
            }
        });

        if (doDebug) {
            console.log(dataValue.toJSON());
            console.log(dataValue.toString());
        }
    });
});
