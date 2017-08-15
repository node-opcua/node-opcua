"use strict";
/* global describe,it*/

var DataValue = require("../src/datavalue").DataValue;
var Variant = require("node-opcua-variant").Variant;
var DataType = require("node-opcua-variant").DataType;
var StatusCodes = require("node-opcua-status-code").StatusCodes;

require("should");

var encode_decode_round_trip_test = require("node-opcua-generator/test_helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;

describe("DataValue", function () {

    it("should create a empty DataValue and encode it as a 1-Byte length block", function () {

        var dataValue = new DataValue();

        encode_decode_round_trip_test(dataValue, function (buffer/*, id*/) {
            buffer.length.should.equal(1);
        });
    });

    it("should create a DataValue with string variant and encode/decode it nicely ", function () {

        var dataValue = new DataValue({
            value: new Variant({dataType: DataType.String, value: "Hello"})
        });
        encode_decode_round_trip_test(dataValue, function (buffer/*, id*/) {
            buffer.length.should.equal(1 + 1 + 4 + 5);
        });
    });


    it("should create a DataValue with string variant and some date and encode/decode it nicely", function () {

        var dataValue = new DataValue({
            value: new Variant({dataType: DataType.String, value: "Hello"}),
            serverTimestamp: new Date(),
            serverPicoseconds: 1000,
            sourceTimestamp: new Date(),
            sourcePicoseconds: 199,
        });
        //xx var str = dataValue.toString();
        encode_decode_round_trip_test(dataValue, function (/*buffer, id*/) {
        });
    });

    it("should create a DataValue with string variant and all dates and encode/decode it nicely", function () {

        var dataValue = new DataValue({
            value: new Variant({dataType: DataType.String, value: "Hello"}),
            statusCode: StatusCodes.BadCertificateHostNameInvalid,
            serverTimestamp: new Date(),
            serverPicoseconds: 1000,
            sourceTimestamp: new Date(),
            sourcePicoseconds: 2000
        });
        encode_decode_round_trip_test(dataValue, function (/*buffer, id*/) {
        });
    });

    it("DataValue#toString", function () {

        var dataValue = new DataValue({
            value: new Variant({dataType: DataType.String, value: "Hello"}),
            statusCode: StatusCodes.BadCertificateHostNameInvalid,
            serverTimestamp: new Date(Date.UTC(1789, 6, 14)),
            serverPicoseconds: 1000,
            sourceTimestamp: new Date(Date.UTC(2089, 6, 14)),
            sourcePicoseconds: 2000
        });
        var str = dataValue.toString();
        str.split(/\n/).should.eql([
            "DataValue:",
            "   value:           Variant(Scalar<String>, value: Hello)",
            "   statusCode:      BadCertificateHostNameInvalid (0x80160000)",
            "   serverTimestamp: 1789-07-14T00:00:00.000Z $ 1000",
            "   sourceTimestamp: 2089-07-14T00:00:00.000Z $ 2000"
        ]);

        dataValue = new DataValue({
            value: new Variant({dataType: DataType.String, value: "Hello"}),
            statusCode: StatusCodes.BadCertificateHostNameInvalid,
            serverTimestamp: null,
            serverPicoseconds: null,
            sourceTimestamp: new Date(Date.UTC(2089, 6, 14)),
            sourcePicoseconds: 2000
        });
        str = dataValue.toString();
        str.split(/\n/).should.eql([
            "DataValue:",
            "   value:           Variant(Scalar<String>, value: Hello)",
            "   statusCode:      BadCertificateHostNameInvalid (0x80160000)",
            "   serverTimestamp: null",
            "   sourceTimestamp: 2089-07-14T00:00:00.000Z $ 2000"
        ]);
    });


    var extractRange = require("../src/datavalue").extractRange;
    var VariantArrayType = require("node-opcua-variant").VariantArrayType;
    var NumericRange = require("node-opcua-numeric-range").NumericRange;

    it("DataValue - extractRange on a Float Array", function () {

        var dataValue = new DataValue({
            value: new Variant({
                dataType: DataType.Double,
                arrayType: VariantArrayType.Array,
                value: new Float64Array([1, 2, 3, 4, 5, 6, 7])
            })
        });
        var dataValue1 = extractRange(dataValue, new NumericRange("2:3"));
        dataValue1.value.value.length.should.eql(2);
        dataValue1.value.value[0].should.eql(3.0);
        dataValue1.value.value[1].should.eql(4.0);
        dataValue1.value.dataType.should.eql(DataType.Double);
        dataValue1.value.arrayType.should.eql(VariantArrayType.Array);

    });
    it("DataValue - extractRange on a String", function () {

        var dataValue = new DataValue({
            value: new Variant({
                dataType: DataType.String,
                arrayType: VariantArrayType.Scalar,
                value: "1234567890"
            })
        });
        var dataValue1 = extractRange(dataValue, new NumericRange("2:3"));
        dataValue1.value.value.length.should.eql(2);
        dataValue1.value.value.should.eql("34");
        dataValue1.value.dataType.should.eql(DataType.String);
        dataValue1.value.arrayType.should.eql(VariantArrayType.Scalar);

    });
    it("DataValue - extractRange on a ByteString", function () {

        var dataValue = new DataValue({
            value: new Variant({
                dataType: DataType.ByteString,
                arrayType: VariantArrayType.Scalar,
                value: new Buffer([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
            })
        });
        var dataValue1 = extractRange(dataValue, new NumericRange("2:3"));
        dataValue1.value.value.length.should.eql(2);
        dataValue1.value.value[0].should.eql(3.0);
        dataValue1.value.value[1].should.eql(4.0);
        dataValue1.value.dataType.should.eql(DataType.ByteString);
        dataValue1.value.arrayType.should.eql(VariantArrayType.Scalar);

    });
});

