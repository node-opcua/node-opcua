require("requirish")._(module);
var DataValue = require("lib/datamodel/datavalue").DataValue;
var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var should = require("should");

var encode_decode_round_trip_test = require("test/helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;

describe("DataValue", function () {

    it("should create a empty DataValue and encode it as a 1-Byte length block", function () {

        var dataValue = new DataValue();

        encode_decode_round_trip_test(dataValue, function (buffer, id) {
            buffer.length.should.equal(1);
        });
    });

    it("should create a DataValue with string variant and encode/decode it nicely ", function () {

        var dataValue = new DataValue({
            value: new Variant({dataType: DataType.String, value: "Hello"})
        });
        encode_decode_round_trip_test(dataValue, function (buffer, id) {
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
        var str = dataValue.toString();
        encode_decode_round_trip_test(dataValue, function (buffer, id) {
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
        encode_decode_round_trip_test(dataValue, function (buffer, id) {
        });
    });
});
