
var should = require("should");
var makebuffer_from_trace = require("node-opcua-debug").makebuffer_from_trace;
var inlineText = require("node-opcua-debug").inlineText;
var hexDump = require("node-opcua-utils").hexDump;
var crypto_utils = require("node-opcua-crypto").crypto_utils;

var buffer = makebuffer_from_trace(
    function () {
        /*
         00000000: 4f 50 4e 46 59 06 00 00 00 00 00 00 38 00 00 00 68 74 74 70 3a 2f 2f 6f 70 63 66 6f 75 6e 64 61    OPNFY.......8...http://opcfounda
         00000020: 74 69 6f 6e 2e 6f 72 67 2f 55 41 2f 53 65 63 75 72 69 74 79 50 6f 6c 69 63 79 23 42 61 73 69 63    tion.org/UA/SecurityPolicy#Basic
         00000040: 31 32 38 52 73 61 31 35 75 04 00 00 30 82 04 71 30 82 03 59 a0 03 02 01 02 02 04 53 a3 ca d0 30    128Rsa15u...0..q0..Y.......S#JP0
         00000060: 0d 06 09 2a 86 48 86 f7 0d 01 01 05 05 00 30 43 31 0a 30 08 06 03 55 04 08 13 01 41 31 0a 30 08    ...*.H.w......0C1.0...U....A1.0.
         00000080: 06 03 55 04 07 13 01 41 31 0a 30 08 06 03 55 04 0a 13 01 41 31 0a 30 08 06 03 55 04 0b 13 01 41    ..U....A1.0...U....A1.0...U....A
         000000a0: 31 11 30 0f 06 03 55 04 03 13 08 55 61 45 78 70 65 72 74 30 1e 17 0d 31 34 30 36 32 30 30 35 34    1.0...U....UaExpert0...140620054
         000000c0: 36 35 36 5a 17 0d 31 39 30 36 31 39 30 35 34 36 35 36 5a 30 43 31 0a 30 08 06 03 55 04 08 13 01    656Z..190619054656Z0C1.0...U....
         000000e0: 41 31 0a 30 08 06 03 55 04 07 13 01 41 31 0a 30 08 06 03 55 04 0a 13 01 41 31 0a 30 08 06 03 55    A1.0...U....A1.0...U....A1.0...U
         00000100: 04 0b 13 01 41 31 11 30 0f 06 03 55 04 03 13 08 55 61 45 78 70 65 72 74 30 82 01 22 30 0d 06 09    ....A1.0...U....UaExpert0.."0...
         00000120: 2a 86 48 86 f7 0d 01 01 01 05 00 03 82 01 0f 00 30 82 01 0a 02 82 01 01 00 a1 8c a0 41 83 63 43    *.H.w...........0........!..A.cC
         00000140: b5 5a 14 d6 21 cf 79 f6 3a cb 71 b6 bb 71 70 04 bb a4 46 fc b7 0a 93 e6 f4 ae d1 bd 9b 3c d2 7c    5Z.V!Oyv:Kq6;qp.;$F|7..ft.Q=.<R|
         00000160: 27 02 60 0f 24 4d 2b 10 4f 19 e5 aa bc b9 42 33 d2 51 bc 28 d2 e4 01 24 f4 99 2d c6 d0 8a fe be    '.`.$M+.O.e*<9B3RQ<(Rd.$t.-FP.~>
         00000180: 99 23 6a b7 01 42 6c 5b 86 d4 cc f4 74 fa f1 ec 9c 87 7b 33 ea c4 b6 80 51 52 8d a6 67 b0 e9 51    .#j7.Bl[.TLttzql..{3jD6.QR.&g0iQ
         000001a0: e6 de 94 97 16 5b 90 99 1f fc 79 ef cb 01 e6 00 f2 be e1 00 45 12 5f 14 3e 04 fc 4b 0b 0c 11 87    f^...[...|yoK.f.r>a.E._.>.|K....
         000001c0: 9e 5b cc f0 d7 77 33 8b 5e ce f0 4f 33 5e 6a 68 93 55 e0 4d ce d2 99 6a 01 fa 19 c7 55 dd a6 d2    .[LpWw3.^NpO3^jh.U`MNR.j.z.GU]&R
         000001e0: 05 ee 5a c3 f5 d3 73 2e 28 79 9a c0 a7 c3 e7 fb cf 55 bc 3e dd 6b 53 2e 52 b5 3e cf 08 4d 15 31    .nZCuSs.(y.@'Cg{OU<>]kS.R5>O.M.1
         00000200: 53 ec fc e9 16 4a 07 ce 62 12 6f db d9 2a d4 be 79 3e bc 30 36 f0 fa 10 17 25 ae 80 f4 3c a4 90    Sl|i.J.Nb.o[Y*T>y><06pz..%..t<$.
         00000220: cb b8 13 c3 eb 37 82 17 3c fc 2b c0 ec 09 70 53 e2 0a 6b 12 e7 2b 1a 78 e7 02 03 01 00 01 a3 82    K8.Ck7..<|+@l.pSb.k.g+.xg.....#.
         00000240: 01 6b 30 82 01 67 30 0c 06 03 55 1d 13 01 01 ff 04 02 30 00 30 50 06 09 60 86 48 01 86 f8 42 01    .k0..g0...U.......0.0P..`.H..xB.
         00000260: 0d 04 43 16 41 22 47 65 6e 65 72 61 74 65 64 20 77 69 74 68 20 55 6e 69 66 69 65 64 20 41 75 74    ..C.A"Generated.with.Unified.Aut
         00000280: 6f 6d 61 74 69 6f 6e 20 55 41 20 42 61 73 65 20 4c 69 62 72 61 72 79 20 75 73 69 6e 67 20 4f 70    omation.UA.Base.Library.using.Op
         000002a0: 65 6e 53 53 4c 22 30 1d 06 03 55 1d 0e 04 16 04 14 22 ef e8 cb 76 10 7f 26 81 3e 8c 59 cf 26 f2    enSSL"0...U......"ohKv..&.>.YO&r
         000002c0: a7 fb 97 ed 1a 30 6e 06 03 55 1d 23 04 67 30 65 80 14 22 ef e8 cb 76 10 7f 26 81 3e 8c 59 cf 26    '{.m.0n..U.#.g0e.."ohKv..&.>.YO&
         000002e0: f2 a7 fb 97 ed 1a a1 47 a4 45 30 43 31 0a 30 08 06 03 55 04 08 13 01 41 31 0a 30 08 06 03 55 04    r'{.m.!G$E0C1.0...U....A1.0...U.
         00000300: 07 13 01 41 31 0a 30 08 06 03 55 04 0a 13 01 41 31 0a 30 08 06 03 55 04 0b 13 01 41 31 11 30 0f    ...A1.0...U....A1.0...U....A1.0.
         00000320: 06 03 55 04 03 13 08 55 61 45 78 70 65 72 74 82 04 53 a3 ca d0 30 0e 06 03 55 1d 0f 01 01 ff 04    ..U....UaExpert..S#JP0...U......
         00000340: 04 03 02 02 f4 30 20 06 03 55 1d 25 01 01 ff 04 16 30 14 06 08 2b 06 01 05 05 07 03 01 06 08 2b    ....t0...U.%.....0...+.........+
         00000360: 06 01 05 05 07 03 02 30 44 06 03 55 1d 11 04 3d 30 3b 86 2b 75 72 6e 3a 50 43 45 54 49 45 4e 4e    .......0D..U...=0;.+urn:PCETIENN
         00000380: 45 2d 50 43 3a 55 6e 69 66 69 65 64 41 75 74 6f 6d 61 74 69 6f 6e 3a 55 61 45 78 70 65 72 74 82    E-PC:UnifiedAutomation:UaExpert.
         000003a0: 0c 50 43 45 54 49 45 4e 4e 45 2d 50 43 30 0d 06 09 2a 86 48 86 f7 0d 01 01 05 05 00 03 82 01 01    .PCETIENNE-PC0...*.H.w..........
         000003c0: 00 1e 76 5c 60 05 f4 8a 34 8a 14 e7 de b5 73 7f c6 d9 a8 3a e5 7f 36 32 f5 84 66 e7 e9 56 a5 d5    ..v\`.t.4..g^5s.FY(:e.62u.fgiV%U
         000003e0: c4 81 46 15 7b 69 46 56 e6 4e 34 c5 6e 3f 01 1f 5d 6b 49 0c cc 20 1b 32 7d b1 3f eb 31 a2 8d 0d    D.F.{iFVfN4En?..]kI.L..2}1?k1"..
         00000400: 48 16 1e 65 d7 8e 37 43 c0 32 07 fb f6 fb d8 b3 cb 31 aa 6e c6 c2 07 6f b6 68 33 bf b3 17 65 3f    H..eW.7C@2.{v{X3K1*nFB.o6h3?3.e?
         00000420: 54 9f 80 63 e8 ce 3c ae 9b e2 6e 22 01 f1 8c e2 2a 55 1c 61 12 17 5c 64 49 ab fd c9 1d 01 32 37    T..chN<..bn".q.b*U.a..\dI+}I..27
         00000440: d8 c8 05 40 03 cd 8c 75 9e 80 0d 2a a5 e5 f3 be 8c e5 96 2b b5 2a 01 fa f7 c8 20 fc 9f cc 69 50    XH.@.M.u...*%es>.e.+5*.zwH.|.LiP
         00000460: 91 ac 93 01 5b be ec 64 5d e5 25 05 50 7b 1f 94 6e 6b f3 06 f5 bb 71 3a d8 0e 80 d5 65 e5 ee 08    .,..[>ld]e%.P{..nks.u;q:X..Ueen.
         00000480: 63 ab 51 04 b8 63 18 2e b6 3e 9c a5 29 39 4e b2 43 6c 96 31 45 10 3d 89 4f 29 d2 8c 28 c8 40 bf    c+Q.8c..6>.%)9N2Cl.1E.=.O)R.(H@?
         000004a0: 7a 34 52 89 08 8a f6 69 90 3a 7e 03 4a 49 e8 b4 4f c7 a4 89 7e 96 88 56 50 4b 2c 0e a8 91 e7 4d    z4R...vi.:~.JIh4OG$.~..VPK,.(.gM
         000004c0: b8 14 00 00 00 88 1c f6 98 5d 76 50 57 f8 aa de 4c e1 8d 62 00 5c c4 a1 d5 22 be 29 e3 6e 4a 71    8......v.]vPWx*^La.b.\D!U">)cnJq
         000004e0: 19 04 76 bd 6f 18 91 12 66 08 61 f9 5e e6 59 a7 8e f4 1f a3 6f a7 9f c0 8a 3d 8c 69 0f 12 5f e0    ..v=o...f.ay^fY'.t.#o'.@.=.i.._`
         00000500: 1b 6e e3 c4 c3 18 bb 77 62 ff dc 42 0b dc 59 ea 5a 53 9d e8 23 19 4e 69 b4 14 f5 10 56 2e 36 61    .ncDC.;wb.\B.\YjZS.h#.Ni4.u.V.6a
         00000520: d8 79 06 ad b8 ec 95 dd ee ac e5 06 24 db b1 b2 cd 66 72 1d 1b 63 70 a7 98 ec e8 77 3b bf a3 f7    Xy.-8l.]n,e.$[12Mfr..cp'.lhw;?#w
         00000540: 31 1c 41 91 09 fa 81 46 18 84 bc 37 c6 37 17 c5 bb 08 28 6d fe 38 ca 52 bb 2b 8f 16 06 65 f2 be    1.A..z.F..<7F7.E;.(m~8JR;+...er>
         00000560: 89 4e 8f b6 40 1e b0 29 9a 4c c6 f0 64 0a e2 d6 54 e2 73 8e bb 8f 9a 3f eb 02 bf 8c 1c 89 87 40    .N.6@.0).LFpd.bVTbs.;..?k.?....@
         00000580: f6 f1 5f e1 2d e9 c0 d8 c3 6e e4 a5 6e 2a ce b3 8f dd 1d ed b0 51 9f 2d 6f ef 23 c6 2e 67 23 c4    vq_a-i@XCnd%n*N3.].m0Q.-oo#F.g#D
         000005a0: 2d 3f f3 95 ef 18 8a ac b3 0e 99 d6 84 c4 ec af 42 63 af 3a 01 8c 3c 0c 8e a2 10 ca bf d2 59 b0    -?s.o..,3..V.Dl/Bc/:..<..".J?RY0
         000005c0: 00 bf 23 e1 9a 04 2b 0a 9c dc 12 62 21 30 cb ea a7 b4 81 ec f4 90 7d 76 39 b8 97 37 b8 cc 70 16    .?#a..+..\.b!0Kj'4.lt.}v98.78Lp.
         000005e0: fb 6c e1 9d 11 ae 9a 88 41 ba 70 b1 7b c8 8d b5 04 4b 88 d1 05 d5 b8 ac 9b 10 54 45 c8 80 65 8d    {la.....A:p1{H.5.K.Q.U8,..TEH.e.
         00000600: 5f 1e 1e 58 bd 7b 33 7f fd 98 fd 20 9d 71 30 3a 3c 84 1e 87 b8 1b 2d 51 2b 55 62 41 e4 b9 a5 29    _..X={3.}.}..q0:<...8.-Q+UbAd9%)
         00000620: 24 2a 91 b6 06 05 01 df 80 dd b1 04 2e 05 aa 17 ef 6a 53 46 05 78 0c c7 5c 9c 7f cf e4 37 80 de    $*.6..._.]1...*.ojSF.x.G\..Od7.^
         00000640: bf 31 de 11 13 70 f4 93 fe 0c a2 4f ef 58 b9 c8 a8 3a 5e 76 20 0c 87 f0 ef                         ?1^..pt.~."OoX9H(:^v...po
         */
    });

var privateKey = inlineText(
    function () {
        /*
         -----BEGIN RSA PRIVATE KEY-----
         MIICXQIBAAKBgQDVTV+bramiaPZc24RhmoFdL3ztiXS7QEoW3qvCfDqx4tAJKSZW
         trLfWnl92RhUUFXBhNhSuTccMzioWew+8lsQAL3lOUACMRvlxbRefH1PWcx6wi95
         sFLe74PLgIcI5h9/a5Rj8N6bnAcj/8GpsMW2Vwna4lN8xkEgDK3GWW5tcQIDAQAB
         AoGAAjJo0K6qN50DJJOyOlsgB/isPboTtLYFzVR/ymIDLL/cSqvc1DnPf9NruusY
         gA3PxE18+OUldynj5IAAmelfHLdDSXIsoRaSb5LQe5O4sjLu8wIrZ66dy7JpAav0
         QiPSw/Er2zvLuVzew+WvB/CAxNr/nVfr8Lr1uBwYC38aLS0CQQD2J0gmw4Vx5wZV
         e7Ma3AFyV7QbB7hPeauNiru8d7E3mg3M1prBiJHJgzjeW0y/dveEU/RTEsX7TM4v
         6fOuD2FvAkEA3dWuV9y4NtqNzX9xRvp13esgfgnZpI39Eg/JPRH2Ll4XAEmUOHRR
         p/1eomAO/e8JPwAbEr+ExLc7jpQxDJXvHwJBAJA3kZlMgpmqblaVI+l/rsVMRzRz
         AHRn57AE8VtJkSXvd1hk/8SV/DxhSmdUfJHM5NW9zm8Bl8dVR5Rg8KkxT7cCQQDE
         X6dBMiuEq35B/uIpIgh7Feyihle7GtJ/TagoPqE+NJ6J65ihTR8H5fwDI6PB2PvH
         YHGW7CE8/rNjKP4ulP+jAkAUhrdwf6Wr4KeyOqysE5V7AnHgBHgyUvi95bjJEtVm
         g9s5xs14gqCBGGf2CTN+xnJehplg562CQG6f70heivC7
         -----END RSA PRIVATE KEY-----
         */
    });


describe("testing message decryption", function () {

    it("should decrypt an OPN packet and verify that the signature is correct", function () {


        // extract the client certificate from the unencrypted part
        var senderCertificate = buffer.slice(0x4C, 0x475 + 0x4C);

        // where the encrypted  part starts
        var start = buffer.length - ( 128 * 3 );
        var encrypted_part = buffer.slice(start);

        // decrypt the encrypted part
        var decrypted_part = crypto_utils.privateDecrypt_long(encrypted_part, privateKey, 128);

        // recompose the buffer
        decrypted_part.copy(buffer, start);
        buffer = buffer.slice(0, start + decrypted_part.length);
        buffer.length.should.equal(start + 3 * (128 - 11));

        // verify signature
        var publicKey = crypto_utils.toPem(senderCertificate, "CERTIFICATE");
        var options = {
            algorithm: "RSA-SHA1",
            signatureLength: 256,
            publicKey: publicKey
        };
        var boolSignatureIsOK = crypto_utils.verifyChunkSignature(buffer, options);

        boolSignatureIsOK.should.eql(true);
    });

});


