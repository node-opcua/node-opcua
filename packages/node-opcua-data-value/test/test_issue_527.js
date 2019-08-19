"use strict";
/* global describe,it*/
Error.stackTraceLimit = 1000;

const { DataValue } = require("..");
const { Variant } = require("node-opcua-variant");
const { DataType } = require("node-opcua-variant");
const { StatusCode, StatusCodes } =require("node-opcua-status-code");

require("should");
function debugLog() {
    // console.log.apply(null,arguments);
}
const encode_decode_round_trip_test = require("node-opcua-packet-analyzer/dist/test_helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;

describe("DataValue with Limit bits", function () {

    it("should handle a DataValue with Overflow | InfoTypeDataValue ", function () {

        const dataValue = new DataValue({
            statusCode: StatusCode.makeStatusCode(StatusCodes.Good, "Overflow | InfoTypeDataValue")
        });
        encode_decode_round_trip_test(dataValue, function (buffer/*, id*/) {
            buffer.length.should.equal(5);
        });

        debugLog(dataValue.toString());

    });

    it("should handle a DataValue with statusCode Good + LimitLow ", function () {

        const dataValue = new DataValue({
            statusCode: StatusCode.makeStatusCode(StatusCodes.Good, "LimitLow")
        });
        encode_decode_round_trip_test(dataValue, function (buffer/*, id*/) {
            buffer.length.should.equal(5);
        });

        debugLog(dataValue.toString());
        debugLog(" value in hexa = 0x",dataValue.statusCode.value.toString(16));

    });

    it("should handle a DataValue with statusCode Good + LimitHigh ", function () {

        const dataValue = new DataValue({
            statusCode: StatusCode.makeStatusCode(StatusCodes.Good, "LimitHigh")
        });
        encode_decode_round_trip_test(dataValue, function (buffer/*, id*/) {
            buffer.length.should.equal(5);
            debugLog(buffer.toString("hex"));
        });

        debugLog(dataValue.toString()+ "\n");
        debugLog(dataValue);
        debugLog(" value in hexa = 0x",dataValue.statusCode.value.toString(16));


    });

    it("should handle a DataValue with statusCode Good + LimitConstant ", function () {

        const dataValue = new DataValue({
            statusCode: StatusCode.makeStatusCode(StatusCodes.Good, "LimitConstant")
        });
        encode_decode_round_trip_test(dataValue, function (buffer/*, id*/) {
            buffer.length.should.equal(5);
        });

        debugLog(dataValue.toString());
        debugLog(" value in hexa = 0x",dataValue.statusCode.value.toString(16));

    });

    it("should handle a DataValue with statusCode Good + extra bits = 1024 ", function () {

        const dataValue = new DataValue({
            statusCode: StatusCode.makeStatusCode(StatusCodes.Good, 1024)
        });
        encode_decode_round_trip_test(dataValue, function (buffer/*, id*/) {
            buffer.length.should.equal(5);
            debugLog(buffer.toString("hex"));
        });

        debugLog(dataValue.toString());

        debugLog(" value in hexa = 0x",dataValue.statusCode.value.toString(16));
    });
    xit("should handle a DataValue that has a undefined statusCode ", function () {

        const dataValue = new DataValue({
            statusCode: StatusCode.makeStatusCode(StatusCodes.Good, 1024)
        });

        dataValue.statusCode = undefined;

        encode_decode_round_trip_test(dataValue, function (buffer/*, id*/) {
            buffer.length.should.equal(1);
            debugLog(buffer.toString("hex"));
        });

        debugLog(dataValue.toString());

        debugLog(" value in hexa = 0x",dataValue.statusCode.value.toString(16));
    });

});
