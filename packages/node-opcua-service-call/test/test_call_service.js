"use strict";
require("should");
var call_service = require("..");
var encode_decode_round_trip_test = require("node-opcua-packet-analyzer/test_helpers/encode_decode_round_trip_test").encode_decode_round_trip_test

var coerceNodeId = require("node-opcua-nodeid").coerceNodeId;
var DataType = require("node-opcua-variant").DataType;
var StatusCodes = require("node-opcua-status-code").StatusCode;


describe("testing CallMethodRequest", function () {

    it("should encode CallMethodRequest (scalar UInt32)", function () {

        var callMethodRequest = new call_service.CallMethodRequest({
            objectId: coerceNodeId("ns=0;i=1"),  // Object
            methodId: coerceNodeId("ns=0;i=2"),  // Method
            inputArguments: [{dataType: DataType.UInt32, value: 123}]
        });

        encode_decode_round_trip_test(callMethodRequest);
    });
    it("should encode CallMethodRequest (array UInt32)", function () {

        var callMethodRequest = new call_service.CallMethodRequest({
            objectId: coerceNodeId("ns=0;i=1"),  // Object
            methodId: coerceNodeId("ns=0;i=2"),  // Method
            inputArguments: [{dataType: DataType.UInt32, value: [123]}]
        });

        encode_decode_round_trip_test(callMethodRequest);
    });

    it("Q2 should encode CallMethodResult", function () {

        var callMethodResult = new call_service.CallMethodResult({
            statusCode: StatusCodes.Good,
            inputArgumentResults: [
                StatusCodes.Good,
                StatusCodes.Good
            ],
            inputArgumentDiagnosticInfos: [],
            outputArguments: [{dataType: DataType.UInt32, value: 10}]
        });

        encode_decode_round_trip_test(callMethodResult);
    });

});
