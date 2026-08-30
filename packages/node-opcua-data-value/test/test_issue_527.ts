Error.stackTraceLimit = 1000;

import "should";

import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { encode_decode_round_trip_test } from "node-opcua-packet-analyzer/dist/test_helpers/encode_decode_round_trip_test";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { DataValue } from "..";

const debugLog = make_debugLog("TEST");
const _doDebug = checkDebugFlag("TEST");

describe("DataValue with Limit bits", () => {
    it("should handle a DataValue with Overflow | InfoTypeDataValue ", () => {
        const dataValue = new DataValue({
            statusCode: StatusCode.makeStatusCode(StatusCodes.Good, "Overflow | InfoTypeDataValue")
        });
        encode_decode_round_trip_test(dataValue, (buffer /*, id*/) => {
            buffer.length.should.equal(5);
        });

        debugLog(dataValue.toString());
    });

    it("should handle a DataValue with statusCode Good + LimitLow ", () => {
        const dataValue = new DataValue({
            statusCode: StatusCode.makeStatusCode(StatusCodes.Good, "LimitLow")
        });
        encode_decode_round_trip_test(dataValue, (buffer /*, id*/) => {
            buffer.length.should.equal(5);
        });

        debugLog(dataValue.toString());
        debugLog(" value in hex = 0x", dataValue.statusCode.value.toString(16));
    });

    it("should handle a DataValue with statusCode Good + LimitHigh ", () => {
        const dataValue = new DataValue({
            statusCode: StatusCode.makeStatusCode(StatusCodes.Good, "LimitHigh")
        });
        encode_decode_round_trip_test(dataValue, (buffer /*, id*/) => {
            buffer.length.should.equal(5);
            debugLog(buffer.toString("hex"));
        });

        debugLog(`${dataValue.toString()}\n`);
        debugLog(dataValue);
        debugLog(" value in hex = 0x", dataValue.statusCode.value.toString(16));
    });

    it("should handle a DataValue with statusCode Good + LimitConstant ", () => {
        const dataValue = new DataValue({
            statusCode: StatusCode.makeStatusCode(StatusCodes.Good, "LimitConstant")
        });
        encode_decode_round_trip_test(dataValue, (buffer /*, id*/) => {
            buffer.length.should.equal(5);
        });

        debugLog(dataValue.toString());
        debugLog(" value in hex = 0x", dataValue.statusCode.value.toString(16));
    });

    it("should handle a DataValue with statusCode Good + extra bits = 1024 ", () => {
        const dataValue = new DataValue({
            statusCode: StatusCode.makeStatusCode(StatusCodes.Good, 1024)
        });
        encode_decode_round_trip_test(dataValue, (buffer /*, id*/) => {
            buffer.length.should.equal(5);
            debugLog(buffer.toString("hex"));
        });

        debugLog(dataValue.toString());

        debugLog(" value in hex = 0x", dataValue.statusCode.value.toString(16));
    });
    it("should handle a DataValue that has a undefined statusCode", () => {
        const dataValue = new DataValue({
            statusCode: StatusCode.makeStatusCode(StatusCodes.Good, 1024)
        });

        (dataValue as { statusCode?: StatusCode }).statusCode = undefined;

        encode_decode_round_trip_test(dataValue, (buffer /*, id*/) => {
            buffer.length.should.equal(1);
            debugLog(buffer.toString("hex"));
        });

        debugLog(dataValue.toString());
    });
});
