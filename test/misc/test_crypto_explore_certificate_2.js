require("requirish")._(module);
var should = require("should");
var path = require("path");
var fs = require("fs");
var util = require("util");

import crypto_utils from "lib/misc/crypto_utils";
    
var assert = require("better-assert");
var hexDump = require("lib/misc/utils").hexDump;


import crypto_explore_certificate from "lib/misc/crypto_explore_certificate";

const { exploreCertificate } = crypto_explore_certificate;


var makebuffer_from_trace = require("test/helpers/makebuffer_from_trace").makebuffer_from_trace;


var ctt_certif = makebuffer_from_trace(
    function () {/*
     00000000: 30 82 03 b0 30 82 03 19 a0 03 02 01 02 02 10 7c 1f 42 bc 2d d9 b2 4d 9d b7 8b 11 b2 d5 cc 57 30    0..00..........|.B<-Y2M.7..2ULW0
     00000020: 0d 06 09 2a 86 48 86 f7 0d 01 01 05 05 00 30 6f 31 0b 30 09 06 03 55 04 06 13 02 55 53 31 10 30    ...*.H.w......0o1.0...U....US1.0
     00000040: 0e 06 03 55 04 08 13 07 41 72 69 7a 6f 6e 61 31 13 30 11 06 03 55 04 07 13 0a 53 63 6f 74 74 73    ...U....Arizona1.0...U....Scotts
     00000060: 64 61 6c 65 31 17 30 15 06 03 55 04 0a 14 0e 4f 50 43 5f 46 6f 75 6e 64 61 74 69 6f 6e 31 20 30    dale1.0...U....OPC_Foundation1.0
     00000080: 1e 06 03 55 04 03 14 17 55 41 5f 43 6f 6d 70 6c 69 61 6e 63 65 5f 54 65 73 74 5f 54 6f 6f 6c 30    ...U....UA_Compliance_Test_Tool0
     000000a0: 1e 17 0d 31 34 30 33 31 34 31 33 35 30 34 31 5a 17 0d 31 39 30 32 31 36 31 33 35 30 34 31 5a 30    ...140314135041Z..190216135041Z0
     000000c0: 6f 31 0b 30 09 06 03 55 04 06 13 02 55 53 31 10 30 0e 06 03 55 04 08 13 07 41 72 69 7a 6f 6e 61    o1.0...U....US1.0...U....Arizona
     000000e0: 31 13 30 11 06 03 55 04 07 13 0a 53 63 6f 74 74 73 64 61 6c 65 31 17 30 15 06 03 55 04 0a 14 0e    1.0...U....Scottsdale1.0...U....
     00000100: 4f 50 43 5f 46 6f 75 6e 64 61 74 69 6f 6e 31 20 30 1e 06 03 55 04 03 14 17 55 41 5f 43 6f 6d 70    OPC_Foundation1.0...U....UA_Comp
     00000120: 6c 69 61 6e 63 65 5f 54 65 73 74 5f 54 6f 6f 6c 30 81 9f 30 0d 06 09 2a 86 48 86 f7 0d 01 01 01    liance_Test_Tool0..0...*.H.w....
     00000140: 05 00 03 81 8d 00 30 81 89 02 81 81 00 bc a9 a0 b4 3a 1f d1 64 b9 c7 e0 f8 5e 00 f9 86 f1 54 53    ......0......<).4:.Qd9G`x^.y.qTS
     00000160: 84 ba 5a 80 a5 8e 58 61 bf 2e 95 e9 4f 18 c9 09 2f 3e f4 9d 43 4e 03 dc 79 8a 12 c6 60 51 c7 ac    .:Z.%.Xa?..iO.I./>t.CN.\y..F`QG,
     00000180: 67 00 3a d6 44 aa 7e 7c 6a 14 cf ea 94 55 54 8b 4a ae 0a 26 b1 98 c0 d4 12 f3 8a 76 01 de 1e 9c    g.:VD*~|j.Oj.UT.J..&1.@T.s.v.^..
     000001a0: 3e 39 3d 31 17 a3 2f 38 53 93 24 b0 d0 54 be af 31 1f 63 06 71 43 68 8b 60 de bf e6 2b 48 71 29    >9=1.#/8S.$0PT>/1.c.qCh.`^?f+Hq)
     000001c0: 41 b9 18 59 2f b9 25 d1 2c 88 04 8f b3 02 03 01 00 01 a3 82 01 4b 30 82 01 47 30 1d 06 03 55 1d    A9.Y/9%Q,...3.....#..K0..G0...U.
     000001e0: 0e 04 16 04 14 23 05 6d 2f 97 d1 4f 07 20 a3 07 55 4c a3 22 57 61 a4 8f 65 30 81 a8 06 03 55 1d    .....#.m/.QO..#.UL#"Wa$.e0.(..U.
     00000200: 23 04 81 a0 30 81 9d 80 14 23 05 6d 2f 97 d1 4f 07 20 a3 07 55 4c a3 22 57 61 a4 8f 65 a1 73 a4    #...0....#.m/.QO..#.UL#"Wa$.e!s$
     00000220: 71 30 6f 31 0b 30 09 06 03 55 04 06 13 02 55 53 31 10 30 0e 06 03 55 04 08 13 07 41 72 69 7a 6f    q0o1.0...U....US1.0...U....Arizo
     00000240: 6e 61 31 13 30 11 06 03 55 04 07 13 0a 53 63 6f 74 74 73 64 61 6c 65 31 17 30 15 06 03 55 04 0a    na1.0...U....Scottsdale1.0...U..
     00000260: 14 0e 4f 50 43 5f 46 6f 75 6e 64 61 74 69 6f 6e 31 20 30 1e 06 03 55 04 03 14 17 55 41 5f 43 6f    ..OPC_Foundation1.0...U....UA_Co
     00000280: 6d 70 6c 69 61 6e 63 65 5f 54 65 73 74 5f 54 6f 6f 6c 82 10 7c 1f 42 bc 2d d9 b2 4d 9d b7 8b 11    mpliance_Test_Tool..|.B<-Y2M.7..
     000002a0: b2 d5 cc 57 30 0c 06 03 55 1d 13 01 01 ff 04 02 30 00 30 0e 06 03 55 1d 0f 01 01 ff 04 04 03 02    2ULW0...U.......0.0...U.........
     000002c0: 02 f4 30 20 06 03 55 1d 25 01 01 ff 04 16 30 14 06 08 2b 06 01 05 05 07 03 01 06 08 2b 06 01 05    .t0...U.%.....0...+.........+...
     000002e0: 05 07 03 02 30 3b 06 03 55 1d 11 04 34 30 32 86 25 75 72 6e 3a 6c 6f 63 61 6c 68 6f 73 74 3a 55    ....0;..U...402.%urn:localhost:U
     00000300: 41 5f 43 6f 6d 70 6c 69 61 6e 63 65 5f 54 65 73 74 5f 54 6f 6f 6c 82 09 6c 6f 63 61 6c 68 6f 73    A_Compliance_Test_Tool..localhos
     00000320: 74 30 0d 06 09 2a 86 48 86 f7 0d 01 01 05 05 00 03 81 81 00 52 78 a4 83 12 a2 e7 9a 43 0d d8 44    t0...*.H.w..........Rx$.."g.C.XD
     00000340: 99 ad 5d 98 87 ed 36 e6 db 51 fc 59 74 42 fd 9d 9e f4 6e 8a 71 5d 18 c2 de 8f 56 d9 b6 4e 39 e9    .-]..m6f[Q|YtB}..tn.q].B^.VY6N9i
     00000360: a7 3c c9 93 b3 0e 8b 28 c4 ae f5 2f 51 ee 0f 46 5c 2f 56 2a 9f 7c fd 97 e4 33 c2 6d e9 ee e4 be    '<I.3..(D.u/Qn.F\/V*.|}.d3Bmind>
     00000380: b7 58 a9 97 f8 1e 27 bc e6 36 f3 17 1e f5 3f a4 69 f0 60 7c b3 14 2f 65 4e 85 d0 98 93 11 d3 4d    7X).x.'<f6s..u?$ip`|3./eN.P...SM
     000003a0: 41 4e 06 0e c8 1b 54 6e 11 94 97 2f be ab cc f9 9d 94 48 4f                                        AN..H.Tn.../>+Ly..HO                                                                                    .....
     */
    });

describe("exploring CTT Client certificate", function () {
    it("should extract application uri from certificate", function () {

        var certificate_info = exploreCertificate(ctt_certif);
        //xx console.log(certificate_info.tbsCertificate);
        console.log(" Version                   : ", certificate_info.tbsCertificate.version);
        console.log(" issuer.commonName         : ", certificate_info.tbsCertificate.issuer.commonName);
        console.log(" uniformResourceIdentifier : ", certificate_info.tbsCertificate.extensions.subjectAltName.uniformResourceIdentifier);
        console.log(" dNSName                   : ", certificate_info.tbsCertificate.extensions.subjectAltName.dNSName);

        certificate_info.tbsCertificate.version.should.eql(3);
        certificate_info.tbsCertificate.issuer.commonName.should.eql("UA_Compliance_Test_Tool");
        certificate_info.tbsCertificate.extensions.subjectAltName.uniformResourceIdentifier.should.eql(["urn:localhost:UA_Compliance_Test_Tool"]);
        certificate_info.tbsCertificate.extensions.subjectAltName.dNSName.should.eql(["localhost"]);

    });
});

