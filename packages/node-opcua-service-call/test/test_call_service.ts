import "should";

import { coerceNodeId } from "node-opcua-nodeid";
import { encode_decode_round_trip_test } from "node-opcua-packet-analyzer/dist/test_helpers";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";

import * as call_service from "../dist/index.js";

describe("testing CallMethodRequest", () => {
    it("should encode CallMethodRequest (scalar UInt32)", () => {
        const callMethodRequest = new call_service.CallMethodRequest({
            objectId: coerceNodeId("ns=0;i=1"), // Object
            methodId: coerceNodeId("ns=0;i=2"), // Method
            inputArguments: [{ dataType: DataType.UInt32, value: 123 }]
        });

        encode_decode_round_trip_test(callMethodRequest);
    });
    it("should encode CallMethodRequest (array UInt32)", () => {
        const callMethodRequest = new call_service.CallMethodRequest({
            objectId: coerceNodeId("ns=0;i=1"), // Object
            methodId: coerceNodeId("ns=0;i=2"), // Method
            inputArguments: [{ dataType: DataType.UInt32, value: [123] }]
        });

        encode_decode_round_trip_test(callMethodRequest);
    });

    it("Q2 should encode CallMethodResult", () => {
        const callMethodResult = new call_service.CallMethodResult({
            statusCode: StatusCodes.Good,
            inputArgumentResults: [StatusCodes.Good, StatusCodes.Good],
            inputArgumentDiagnosticInfos: [],
            outputArguments: [{ dataType: DataType.UInt32, value: 10 }]
        });

        encode_decode_round_trip_test(callMethodResult);
    });
});
