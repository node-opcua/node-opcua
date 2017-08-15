"use strict";
var should = require("should");

var makeBuffer = require("node-opcua-buffer-utils").makeBuffer;
var packet_analyzer = require("node-opcua-packet-analyzer").packet_analyzer;
var BinaryStream = require("node-opcua-binary-stream").BinaryStream;
var redirectToFile = require("node-opcua-debug").redirectToFile;

var ec = require("node-opcua-basic-types");
var StatusCodes = require("node-opcua-status-code").StatusCodes;
var ServiceFault = require("..").ServiceFault;

describe("ServiceFault", function () {

    it("should decode a real ServiceFault", function (done) {
        var ws_message = makeBuffer(
            "01 00 8d 01 e0 8c 9d ba 65 27 cf 01 05 00 00 00 00 00 0f 80 14 00 00 00 00 91 01 00 00 3e 3e 3e " +//   ....`..:e'O..................>>>
            "20 38 30 30 46 30 30 30 30 0d 0a 2d 2d 2d 20 20 20 20 c3 a0 20 4f 70 63 2e 55 61 2e 53 65 72 76 " +//   .800F0000..---....C..Opc.Ua.Serv
            "65 72 2e 53 74 61 6e 64 61 72 64 53 65 72 76 65 72 2e 52 65 61 64 28 52 65 71 75 65 73 74 48 65 " +//   er.StandardServer.Read(RequestHe
            "61 64 65 72 20 72 65 71 75 65 73 74 48 65 61 64 65 72 2c 20 44 6f 75 62 6c 65 20 6d 61 78 41 67 " +//   ader.requestHeader,.Double.maxAg
            "65 2c 20 54 69 6d 65 73 74 61 6d 70 73 54 6f 52 65 74 75 72 6e 20 74 69 6d 65 73 74 61 6d 70 73 " +//   e,.TimestampsToReturn.timestamps
            "54 6f 52 65 74 75 72 6e 2c 20 52 65 61 64 56 61 6c 75 65 49 64 43 6f 6c 6c 65 63 74 69 6f 6e 20 " +//   ToReturn,.ReadValueIdCollection.
            "6e 6f 64 65 73 54 6f 52 65 61 64 2c 20 44 61 74 61 56 61 6c 75 65 43 6f 6c 6c 65 63 74 69 6f 6e " +//   nodesToRead,.DataValueCollection
            "26 20 72 65 73 75 6c 74 73 2c 20 44 69 61 67 6e 6f 73 74 69 63 49 6e 66 6f 43 6f 6c 6c 65 63 74 " +//   &.results,.DiagnosticInfoCollect
            "69 6f 6e 26 20 64 69 61 67 6e 6f 73 74 69 63 49 6e 66 6f 73 29 0d 0a 2d 2d 2d 20 20 20 20 c3 a0 " +//   ion&.diagnosticInfos)..---....C.
            "20 4f 70 63 2e 55 61 2e 53 65 73 73 69 6f 6e 45 6e 64 70 6f 69 6e 74 2e 52 65 61 64 28 49 53 65 " +//   .Opc.Ua.SessionEndpoint.Read(ISe
            "72 76 69 63 65 52 65 71 75 65 73 74 20 69 6e 63 6f 6d 69 6e 67 29 0d 0a 2d 2d 2d 20 20 20 20 c3 " +//   rviceRequest.incoming)..---....C
            "a0 20 4f 70 63 2e 55 61 2e 45 6e 64 70 6f 69 6e 74 42 61 73 65 2e 50 72 6f 63 65 73 73 52 65 71 " +//   ..Opc.Ua.EndpointBase.ProcessReq
            "75 65 73 74 41 73 79 6e 63 52 65 73 75 6c 74 2e 4f 6e 50 72 6f 63 65 73 73 52 65 71 75 65 73 74 " +//   uestAsyncResult.OnProcessRequest
            "28 4f 62 6a 65 63 74 20 73 74 61 74 65 29 01 00 00 00 08 00 00 00 38 30 30 46 30 30 30 30 00 00 " +//   (Object.state)........800F0000..
            "00"
        );
        redirectToFile("ws_ServiceFault.log", function () {

            packet_analyzer(ws_message);

            var stream = new BinaryStream(ws_message);
            var id = ec.decodeExpandedNodeId(stream);
            var sf = new ServiceFault();
            sf.decode(stream);

        }, done);
    });

    it("should create a ServiceFault with a specific serviceResult", function () {
        var sf = new ServiceFault({
            responseHeader: {serviceResult: StatusCodes.BadNoSubscription}
        });
        sf.responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
    });
});
