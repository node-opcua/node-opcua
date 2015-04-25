"use strict";
/* global describe,it*/
require("requirish")._(module);
var DataValue = require("lib/datamodel/datavalue").DataValue;
var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

require("should");

var encode_decode_round_trip_test = require("test/helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;

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

    it("DataValue#toString",function() {

        var dataValue = new DataValue({
            value: new Variant({dataType: DataType.String, value: "Hello"}),
            statusCode: StatusCodes.BadCertificateHostNameInvalid,
            serverTimestamp: new Date(Date.UTC(1789,6,14)),
            serverPicoseconds: 1000,
            sourceTimestamp: new Date(Date.UTC(2089,6,14)),
            sourcePicoseconds: 2000
        });
        var str = dataValue.toString();
        str.split(/\n/).should.eql([
            "DATAVALUE ",
            "",
            "   value = Variant(Scalar, value: Hello)",
            "   statusCode       = BadCertificateHostNameInvalid (0x80160000)",
            "   serverTimestamp  = 1789-07-14T00:00:00.000Z $ 1000",
            "   sourceTimestamp  = 2089-07-14T00:00:00.000Z $ 2000"
        ]);

        var dataValue = new DataValue({
            value: new Variant({dataType: DataType.String, value: "Hello"}),
            statusCode: StatusCodes.BadCertificateHostNameInvalid,
            serverTimestamp: null,
            serverPicoseconds: null,
            sourceTimestamp: new Date(Date.UTC(2089,6,14)),
            sourcePicoseconds: 2000
        });
        var str = dataValue.toString();
        str.split(/\n/).should.eql([
            "DATAVALUE ",
            "",
            "   value = Variant(Scalar, value: Hello)",
            "   statusCode       = BadCertificateHostNameInvalid (0x80160000)",
            "   serverTimestamp  = null",
            "   sourceTimestamp  = 2089-07-14T00:00:00.000Z $ 2000"
        ]);
    });
});
