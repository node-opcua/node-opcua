var bs = require("./../lib/browse_service");
var encode_decode_round_trip_test = require("./utils/encode_decode_round_trip_test").encode_decode_round_trip_test;
var redirectToFile = require("../lib/utils").redirectToFile;
var verify_multi_chunk_message= require("./utils/verify_message_chunk").verify_multi_chunk_message;
var verify_single_chunk_message= require("./utils/verify_message_chunk").verify_single_chunk_message;
var makebuffer = require("../lib/utils").makebuffer;


var fixture_ws_browseRequest_message= makebuffer(
"4d 53 47 46 85 00 00 00 08 00 00 00 01 00 00 00 07 00 00 00 07 00 00 00 01 00 0f 02 05 00 00 20 " +
"00 00 00 48 09 ee e7 c3 5d bb ce df d0 7a 7d c0 6e e8 54 ba bf fa 46 7e 3f b2 06 98 6e 71 a2 87 " +
"bd 2c 5d 61 fd 83 6d 17 21 cf 01 05 00 00 00 ff 03 00 00 ff ff ff ff 00 00 00 00 00 00 00 00 00 " +
"00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 01 00 00 00 00 55 02 00 00 00 00 00 01 00 00 00 " +
"00 3f 00 00 00");

var fixture_ws_browseResponse_message= makebuffer(
"4d 53 47 46 2e 01 00 00 48 00 00 00 01 00 00 00 07 00 00 00 05 00 00 00 01 00 12 02 1f eb e2 ae "+ //  MSGF....H....................kb.
"0e 25 cf 01 05 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 01 00 00 00 00 00 00 00 ff ff ff ff "+ //   .%O.............................
"06 00 00 00 00 23 00 00 54 00 00 04 00 00 00 52 6f 6f 74 02 04 00 00 00 52 6f 6f 74 01 00 00 00 "+ //   .....#..T......Root.....Root....
"00 3d 00 23 01 01 00 cd 08 00 00 06 00 00 00 53 65 72 76 65 72 02 06 00 00 00 53 65 72 76 65 72 "+ //   .=.#...M.......Server.....Server
"01 00 00 00 01 00 d4 07 00 23 01 01 02 ad 27 02 00 04 00 00 00 44 61 74 61 02 04 00 00 00 44 61 "+ //   ......T..#...-'......Data.....Da
"74 61 01 00 00 00 00 3d 00 23 01 01 07 01 04 07 00 0d 00 00 00 4d 65 6d 6f 72 79 42 75 66 66 65 "+ //   ta.....=.#...........MemoryBuffe
"72 73 02 0d 00 00 00 4d 65 6d 6f 72 79 42 75 66 66 65 72 73 01 00 00 00 00 3d 00 23 01 01 04 d8 "+ //   rs.....MemoryBuffers.....=.#...X
"04 04 00 07 00 00 00 42 6f 69 6c 65 72 73 02 07 00 00 00 42 6f 69 6c 65 72 73 01 00 00 00 00 3d "+ //   .......Boilers.....Boilers.....=
"00 28 01 00 3d 00 00 0a 00 00 00 46 6f 6c 64 65 72 54 79 70 65 02 0a 00 00 00 46 6f 6c 64 65 72 "+ //   .(..=......FolderType.....Folder
"54 79 70 65 08 00 00 00 00 00 00 00 00 00"                                                         //    Type..........
);

describe("Browse Service", function(){

    it("should create a BrowseRequest",function(){
       var browseRequest = new bs.BrowseRequest({});
        encode_decode_round_trip_test(browseRequest);
    });

    it("should decode a real BrowseRequest",function(done){
        redirectToFile("ws_BrowseRequest.log", function () {
            verify_multi_chunk_message([fixture_ws_browseRequest_message]);
        }, done);
    });

    it("should decode a real BrowseResponse",function(done){
        redirectToFile("ws_BrowseResponse.log", function () {
            verify_multi_chunk_message([fixture_ws_browseResponse_message]);
        }, done);
    });
});