
var should = require("should");
var rs = require("node-opcua-service-read");
var redirectToFile = require("node-opcua-debug").redirectToFile;
var makeBuffer = require("node-opcua-buffer-utils").makeBuffer;

var encode_decode_round_trip_test = require("node-opcua-packet-analyzer/test_helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;
var verify_multi_chunk_message = require("../test_helpers/verify_message_chunk").verify_multi_chunk_message;

/* a real readRequest (with two nodeIds) captured with ws*/
var fixture_ws_readRequest_message = makeBuffer(
    "4d 53 47 46 92 00 00 00 08 00 " +
    "00 00 01 00 00 00 04 00 00 00 04 00 00 00 01 00 77 02 05 00 00 20 00 00 00 48 09 ee e7 c3 5d bb " +
    "ce df d0 7a 7d c0 6e e8 54 ba bf fa 46 7e 3f b2 06 98 6e 71 a2 87 bd 2c 5d 60 01 82 6d 17 21 cf " +
    "01 03 00 00 00 ff 03 00 00 ff ff ff ff 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 02 00 00 00 " +
    "02 00 00 00 01 00 cf 08 0d 00 00 00 ff ff ff ff 00 00 ff ff ff ff 01 00 ce 08 0d 00 00 00 ff ff " +
    "ff ff 00 00 ff ff ff ff");

var fixture_ws_readRequest_message2 = makeBuffer(
    "4d 53 47 46 be 01 00 00 08 00 00 00 01 00 00 00 0d 00 00 00 0d 00 00 00 01 00 77 02 05 00 00 20 " +
    "00 00 00 48 09 ee e7 c3 5d bb ce df d0 7a 7d c0 6e e8 54 ba bf fa 46 7e 3f b2 06 98 6e 71 a2 87 " +
    "bd 2c 5d 8f 36 85 6d 17 21 cf 01 0b 00 00 00 ff 03 00 00 ff ff ff ff 00 00 00 00 00 00 00 00 00 " +
    "00 00 00 00 00 00 03 00 00 00 15 00 00 00 00 3d 01 00 00 00 ff ff ff ff 00 00 ff ff ff ff 00 3d " +
    "02 00 00 00 ff ff ff ff 00 00 ff ff ff ff 00 3d 03 00 00 00 ff ff ff ff 00 00 ff ff ff ff 00 3d " +
    "04 00 00 00 ff ff ff ff 00 00 ff ff ff ff 00 3d 05 00 00 00 ff ff ff ff 00 00 ff ff ff ff 00 3d " +
    "06 00 00 00 ff ff ff ff 00 00 ff ff ff ff 00 3d 07 00 00 00 ff ff ff ff 00 00 ff ff ff ff 00 3d " +
    "08 00 00 00 ff ff ff ff 00 00 ff ff ff ff 00 3d 09 00 00 00 ff ff ff ff 00 00 ff ff ff ff 00 3d " +
    "0a 00 00 00 ff ff ff ff 00 00 ff ff ff ff 00 3d 0b 00 00 00 ff ff ff ff 00 00 ff ff ff ff 00 3d " +
    "0c 00 00 00 ff ff ff ff 00 00 ff ff ff ff 00 3d 0e 00 00 00 ff ff ff ff 00 00 ff ff ff ff 00 3d " +
    "0f 00 00 00 ff ff ff ff 00 00 ff ff ff ff 00 3d 10 00 00 00 ff ff ff ff 00 00 ff ff ff ff 00 3d " +
    "11 00 00 00 ff ff ff ff 00 00 ff ff ff ff 00 3d 12 00 00 00 ff ff ff ff 00 00 ff ff ff ff 00 3d " +
    "13 00 00 00 ff ff ff ff 00 00 ff ff ff ff 00 3d 14 00 00 00 ff ff ff ff 00 00 ff ff ff ff 00 3d " +
    "15 00 00 00 ff ff ff ff 00 00 ff ff ff ff 00 3d 16 00 00 00 ff ff ff ff 00 00 ff ff ff ff");

var fixture_ws_readResponse_message = makeBuffer(
    "4d 53 47 46 f0 01 00 00 08 00 " +
    "00 00 01 00 00 00 04 00 00 00 04 00 00 00 01 00 7a 02 17 ff 83 6d 17 21 cf 01 03 00 00 00 00 00 " +
    "00 00 00 00 00 00 00 00 00 00 02 00 00 00 0d 8c 09 00 00 00 1c 00 00 00 68 74 74 70 3a 2f 2f 6f " +
    "70 63 66 6f 75 6e 64 61 74 69 6f 6e 2e 6f 72 67 2f 55 41 2f 24 00 00 00 75 72 6e 3a 4c 4f 55 52 " +
    "53 4c 41 42 53 65 72 76 65 72 31 3a 55 41 20 53 61 6d 70 6c 65 20 53 65 72 76 65 72 18 00 00 00 " +
    "68 74 74 70 3a 2f 2f 74 65 73 74 2e 6f 72 67 2f 55 41 2f 44 61 74 61 2f 21 00 00 00 68 74 74 70 " +
    "3a 2f 2f 74 65 73 74 2e 6f 72 67 2f 55 41 2f 44 61 74 61 2f 2f 49 6e 73 74 61 6e 63 65 23 00 00 " +
    "00 68 74 74 70 3a 2f 2f 6f 70 63 66 6f 75 6e 64 61 74 69 6f 6e 2e 6f 72 67 2f 55 41 2f 42 6f 69 " +
    "6c 65 72 2f 2c 00 00 00 68 74 74 70 3a 2f 2f 6f 70 63 66 6f 75 6e 64 61 74 69 6f 6e 2e 6f 72 67 " +
    "2f 55 41 2f 42 6f 69 6c 65 72 2f 2f 49 6e 73 74 61 6e 63 65 27 00 00 00 68 74 74 70 3a 2f 2f 6f " +
    "70 63 66 6f 75 6e 64 61 74 69 6f 6e 2e 6f 72 67 2f 55 41 2f 44 69 61 67 6e 6f 73 74 69 63 73 22 " +
    "00 00 00 68 74 74 70 3a 2f 2f 73 61 6d 70 6c 65 73 2e 6f 72 67 2f 55 41 2f 6d 65 6d 6f 72 79 62 " +
    "75 66 66 65 72 2b 00 00 00 68 74 74 70 3a 2f 2f 73 61 6d 70 6c 65 73 2e 6f 72 67 2f 55 41 2f 6d " +
    "65 6d 6f 72 79 62 75 66 66 65 72 2f 49 6e 73 74 61 6e 63 65 67 f6 fb 1e 14 21 cf 01 17 ff 83 6d " +
    "17 21 cf 01 0d 8c 01 00 00 00 24 00 00 00 75 72 6e 3a 4c 4f 55 52 53 4c 41 42 53 65 72 76 65 72 " +
    "31 3a 55 41 20 53 61 6d 70 6c 65 20 53 65 72 76 65 72 67 f6 fb 1e 14 21 cf 01 17 ff 83 6d 17 21 " +
    "cf 01 00 00 00 00");

var fixture_ws_readResponse_message2 = makeBuffer(
    "4d 53 47 46 5f 01 00 00 08 00 00 00 01 00 00 00 1a 00 00 00 1a 00 00 00 01 00 7a 02 5d 0c f4 6f " +
    "17 21 cf 01 18 00 00 00 00 00 00 00 00 01 00 00 00 08 00 00 00 38 30 33 35 30 30 30 30 00 00 00 " +
    "15 00 00 00 01 11 01 04 fd 03 01 06 08 00 00 00 01 14 04 00 12 00 00 00 46 6c 6f 77 43 6f 6e 74 " +
    "72 6f 6c 6c 65 72 54 79 70 65 01 15 02 12 00 00 00 46 6c 6f 77 43 6f 6e 74 72 6f 6c 6c 65 72 54 " +
    "79 70 65 01 15 03 00 00 00 00 34 00 00 00 41 20 63 6f 6e 74 72 6f 6c 6c 65 72 20 66 6f 72 20 74 " +
    "68 65 20 66 6c 6f 77 20 6f 66 20 61 20 66 6c 75 69 64 20 74 68 72 6f 75 67 68 20 61 20 70 69 70 " +
    "65 2e 01 07 00 00 00 00 01 07 00 00 00 00 01 01 00 02 00 00 35 80 02 00 00 35 80 02 00 00 35 80 " +
    "02 00 00 35 80 02 00 00 35 80 02 00 00 35 80 02 00 00 35 80 02 00 00 35 80 02 00 00 35 80 02 00 " +
    "00 35 80 02 00 00 35 80 02 00 00 35 80 02 00 00 35 80 15 00 00 00 00 00 00 00 00 00 00 00 04 00 " +
    "00 00 00 04 00 00 00 00 04 00 00 00 00 04 00 00 00 00 04 00 00 00 00 04 00 00 00 00 04 00 00 00 " +
    "00 04 00 00 00 00 04 00 00 00 00 04 00 00 00 00 04 00 00 00 00 04 00 00 00 00 04 00 00 00 00");


describe("Read Service", function () {

    it("should decode a real ReadRequest 1/2", function (done) {
        redirectToFile("ws_ReadRequest.log", function () {
            verify_multi_chunk_message([fixture_ws_readRequest_message]);
        }, done);
    });
    it("should decode a real ReadRequest 2/2", function (done) {
        redirectToFile("ws_ReadRequest2.log", function () {
            verify_multi_chunk_message([fixture_ws_readRequest_message2]);
        }, done);
    });

    it("should decode a real ReadResponse 1/2", function (done) {
        redirectToFile("ws_ReadResponse.log", function () {
            verify_multi_chunk_message([fixture_ws_readResponse_message]);
        }, done);
    });

    it("should decode a real ReadResponse 2/2", function (done) {
        redirectToFile("ws_ReadResponse2.log", function () {
            verify_multi_chunk_message([fixture_ws_readResponse_message2]);
        }, done);
    });


    it("should encode and decode a ReadRequest ", function () {

        var readRequest = new rs.ReadRequest({
            timestampsToReturn: rs.TimestampsToReturn.Both,
            nodesToRead: [
                {
                    nodeId: "i=2255",
                    attributeId: 13  //<<<<<<< INVALID ID => Should Throws !!!
                }
            ]
        });
        encode_decode_round_trip_test(readRequest);
    });
});
