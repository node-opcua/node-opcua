"use strict";

var verify_multi_chunk_message = require("../test_helpers/verify_message_chunk").verify_multi_chunk_message;

var redirectToFile = require("node-opcua-debug").redirectToFile;
var makeBuffer = require("node-opcua-buffer-utils").makeBuffer;


var fixture_ws_browseRequest_message = makeBuffer(
    "4d 53 47 46 85 00 00 00 08 00 00 00 01 00 00 00 07 00 00 00 07 00 00 00 01 00 0f 02 05 00 00 20 " +
    "00 00 00 48 09 ee e7 c3 5d bb ce df d0 7a 7d c0 6e e8 54 ba bf fa 46 7e 3f b2 06 98 6e 71 a2 87 " +
    "bd 2c 5d 61 fd 83 6d 17 21 cf 01 05 00 00 00 ff 03 00 00 ff ff ff ff 00 00 00 00 00 00 00 00 00 " +
    "00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 01 00 00 00 00 55 02 00 00 00 00 00 01 00 00 00 " +
    "00 3f 00 00 00");

var fixture_ws_browseResponse_message = makeBuffer(
    "4d 53 47 46 2e 01 00 00 48 00 00 00 01 00 00 00 07 00 00 00 05 00 00 00 01 00 12 02 1f eb e2 ae " + //  MSGF....H....................kb.
    "0e 25 cf 01 05 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 01 00 00 00 00 00 00 00 ff ff ff ff " + //   .%O.............................
    "06 00 00 00 00 23 00 00 54 00 00 04 00 00 00 52 6f 6f 74 02 04 00 00 00 52 6f 6f 74 01 00 00 00 " + //   .....#..T......Root.....Root....
    "00 3d 00 23 01 01 00 cd 08 00 00 06 00 00 00 53 65 72 76 65 72 02 06 00 00 00 53 65 72 76 65 72 " + //   .=.#...M.......Server.....Server
    "01 00 00 00 01 00 d4 07 00 23 01 01 02 ad 27 02 00 04 00 00 00 44 61 74 61 02 04 00 00 00 44 61 " + //   ......T..#...-'......Data.....Da
    "74 61 01 00 00 00 00 3d 00 23 01 01 07 01 04 07 00 0d 00 00 00 4d 65 6d 6f 72 79 42 75 66 66 65 " + //   ta.....=.#...........MemoryBuffe
    "72 73 02 0d 00 00 00 4d 65 6d 6f 72 79 42 75 66 66 65 72 73 01 00 00 00 00 3d 00 23 01 01 04 d8 " + //   rs.....MemoryBuffers.....=.#...X
    "04 04 00 07 00 00 00 42 6f 69 6c 65 72 73 02 07 00 00 00 42 6f 69 6c 65 72 73 01 00 00 00 00 3d " + //   .......Boilers.....Boilers.....=
    "00 28 01 00 3d 00 00 0a 00 00 00 46 6f 6c 64 65 72 54 79 70 65 02 0a 00 00 00 46 6f 6c 64 65 72 " + //   .(..=......FolderType.....Folder
    "54 79 70 65 08 00 00 00 00 00 00 00 00 00"                                                         //    Type..........
);

var fixture_ws_browseResponse_with_error_and_diagnostic_info_message = makeBuffer(
    "4d 53 47 46 af 03 00 00 5a 00 00 00 01 00 00 00 08 00 00 00 06 00 00 00 01 00 12 02 f5 f6 50 2b " + //   MSGF/...Z...................uvP+
    "86 25 cf 01 06 00 00 00 00 00 00 00 00 02 00 00 00 1f 00 00 00 55 6e 65 78 70 65 63 74 65 64 20 " + //   .%O..................Unexpected.
    "65 72 72 6f 72 20 62 72 6f 77 73 69 6e 67 20 6e 6f 64 65 2e 10 00 00 00 42 61 64 56 69 65 77 49 " + //   error.browsing.node.....BadViewI
    "64 55 6e 6b 6e 6f 77 6e 00 00 00 01 00 00 00 00 00 6b 80 ff ff ff ff 00 00 00 00 01 00 00 00 64 " + //   dUnknown.........k.............d
    "00 00 00 00 00 00 6b 80 14 01 00 00 00 1e 03 00 00 3e 3e 3e 20 42 61 64 56 69 65 77 49 64 55 6e " + //   ......k..........>>>.BadViewIdUn
    "6b 6e 6f 77 6e 0d 0a 2d 2d 2d 20 20 20 20 c3 a0 20 4f 70 63 2e 55 61 2e 53 61 6d 70 6c 65 2e 53 " + //   known..---....C..Opc.Ua.Sample.S
    "61 6d 70 6c 65 4e 6f 64 65 4d 61 6e 61 67 65 72 2e 42 72 6f 77 73 65 28 4f 70 65 72 61 74 69 6f " + //   ampleNodeManager.Browse(Operatio
    "6e 43 6f 6e 74 65 78 74 20 63 6f 6e 74 65 78 74 2c 20 43 6f 6e 74 69 6e 75 61 74 69 6f 6e 50 6f " + //   nContext.context,.ContinuationPo
    "69 6e 74 26 20 63 6f 6e 74 69 6e 75 61 74 69 6f 6e 50 6f 69 6e 74 2c 20 49 4c 69 73 74 60 31 20 " + //   int&.continuationPoint,.IList`1.
    "72 65 66 65 72 65 6e 63 65 73 29 0d 0a 2d 2d 2d 20 20 20 20 c3 a0 20 4f 70 63 2e 55 61 2e 53 65 " + //   references)..---....C..Opc.Ua.Se
    "72 76 65 72 2e 4d 61 73 74 65 72 4e 6f 64 65 4d 61 6e 61 67 65 72 2e 46 65 74 63 68 52 65 66 65 " + //   rver.MasterNodeManager.FetchRefe
    "72 65 6e 63 65 73 28 4f 70 65 72 61 74 69 6f 6e 43 6f 6e 74 65 78 74 20 63 6f 6e 74 65 78 74 2c " + //   rences(OperationContext.context,
    "20 42 6f 6f 6c 65 61 6e 20 61 73 73 69 67 6e 43 6f 6e 74 69 6e 75 61 74 69 6f 6e 50 6f 69 6e 74 " + //   .Boolean.assignContinuationPoint
    "2c 20 43 6f 6e 74 69 6e 75 61 74 69 6f 6e 50 6f 69 6e 74 26 20 63 70 2c 20 52 65 66 65 72 65 6e " + //   ,.ContinuationPoint&.cp,.Referen
    "63 65 44 65 73 63 72 69 70 74 69 6f 6e 43 6f 6c 6c 65 63 74 69 6f 6e 26 20 72 65 66 65 72 65 6e " + //   ceDescriptionCollection&.referen
    "63 65 73 29 0d 0a 2d 2d 2d 20 20 20 20 c3 a0 20 4f 70 63 2e 55 61 2e 53 65 72 76 65 72 2e 4d 61 " + //   ces)..---....C..Opc.Ua.Server.Ma
    "73 74 65 72 4e 6f 64 65 4d 61 6e 61 67 65 72 2e 42 72 6f 77 73 65 28 4f 70 65 72 61 74 69 6f 6e " + //   sterNodeManager.Browse(Operation
    "43 6f 6e 74 65 78 74 20 63 6f 6e 74 65 78 74 2c 20 56 69 65 77 44 65 73 63 72 69 70 74 69 6f 6e " + //   Context.context,.ViewDescription
    "20 76 69 65 77 2c 20 55 49 6e 74 33 32 20 6d 61 78 52 65 66 65 72 65 6e 63 65 73 50 65 72 4e 6f " + //   .view,.UInt32.maxReferencesPerNo
    "64 65 2c 20 42 6f 6f 6c 65 61 6e 20 61 73 73 69 67 6e 43 6f 6e 74 69 6e 75 61 74 69 6f 6e 50 6f " + //   de,.Boolean.assignContinuationPo
    "69 6e 74 2c 20 42 72 6f 77 73 65 44 65 73 63 72 69 70 74 69 6f 6e 20 6e 6f 64 65 54 6f 42 72 6f " + //   int,.BrowseDescription.nodeToBro
    "77 73 65 2c 20 42 72 6f 77 73 65 52 65 73 75 6c 74 20 72 65 73 75 6c 74 29 0d 0a 2d 2d 2d 20 20 " + //    wse,.BrowseResult.result)..---..
    "20 20 c3 a0 20 4f 70 63 2e 55 61 2e 53 65 72 76 65 72 2e 4d 61 73 74 65 72 4e 6f 64 65 4d 61 6e " + //   ..C..Opc.Ua.Server.MasterNodeMan
    "61 67 65 72 2e 42 72 6f 77 73 65 28 4f 70 65 72 61 74 69 6f 6e 43 6f 6e 74 65 78 74 20 63 6f 6e " + //   ager.Browse(OperationContext.con
    "74 65 78 74 2c 20 56 69 65 77 44 65 73 63 72 69 70 74 69 6f 6e 20 76 69 65 77 2c 20 55 49 6e 74 " + //   text,.ViewDescription.view,.UInt
    "33 32 20 6d 61 78 52 65 66 65 72 65 6e 63 65 73 50 65 72 4e 6f 64 65 2c 20 42 72 6f 77 73 65 44 " + //   32.maxReferencesPerNode,.BrowseD
    "65 73 63 72 69 70 74 69 6f 6e 43 6f 6c 6c 65 63 74 69 6f 6e 20 6e 6f 64 65 73 54 6f 42 72 6f 77 " + //   escriptionCollection.nodesToBrow
    "73 65 2c 20 42 72 6f 77 73 65 52 65 73 75 6c 74 43 6f 6c 6c 65 63 74 69 6f 6e 26 20 72 65 73 75 " + //   se,.BrowseResultCollection&.resu
    "6c 74 73 2c 20 44 69 61 67 6e 6f 73 74 69 63 49 6e 66 6f 43 6f 6c 6c 65 63 74 69 6f 6e 26 20 64 " + //   lts,.DiagnosticInfoCollection&.d
    "69 61 67 6e 6f 73 74 69 63 49 6e 66 6f 73 29"  //                                                       iagnosticInfos)
);


it("should decode a real BrowseRequest", function (done) {
    redirectToFile("ws_BrowseRequest.log", function () {
        verify_multi_chunk_message([fixture_ws_browseRequest_message]);
    }, done);
});

it("should decode a real BrowseResponse", function (done) {
    redirectToFile("ws_BrowseResponse.log", function () {
        verify_multi_chunk_message([fixture_ws_browseResponse_message]);
    }, done);
});
it("should decode a real BrowseResponse with StatusCode error and some diagnostic info", function (done) {
    redirectToFile("ws_BrowseResponse2.log", function () {
        verify_multi_chunk_message([fixture_ws_browseResponse_with_error_and_diagnostic_info_message]);
    }, done);
});

