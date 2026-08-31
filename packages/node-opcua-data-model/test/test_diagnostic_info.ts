import { BinaryStream } from "node-opcua-binary-stream";

import { encode_decode_round_trip_test } from "node-opcua-packet-analyzer/dist/test_helpers";
import { StatusCodes } from "node-opcua-status-code";
import should from "should";

import {
    DiagnosticInfo,
    DiagnosticInfo_ServiceLevelMask,
    decodeDiagnosticInfo,
    encodeDiagnosticInfo,
    filterDiagnosticInfoLevel
} from "../dist/index.js";

describe("DiagnosticInfo", () => {
    //xx it("should have encodingDefaultBinary = 25",function(){
    //xx
    //xx     var diag = new DiagnosticInfo();
    //xx     diag.encodingDefaultBinary.value.should.equal(25);
    //xx
    //xx });

    it("should encode default DiagnosticInfo in a single byte", () => {
        const diag = new DiagnosticInfo();

        diag.symbolicId.should.eql(-1);
        diag.locale.should.eql(-1);
        diag.localizedText.should.eql(-1);
        should(diag.additionalInfo).eql(null);
        diag.innerStatusCode.should.eql(StatusCodes.Good);
        should(diag.innerDiagnosticInfo).eql(null);

        encode_decode_round_trip_test(diag, (buffer) => {
            buffer.length.should.equal(1);
        });
    });
    it("should encode default DiagnosticInfo with only symbolicId in 5-bytes", () => {
        const diag = new DiagnosticInfo({
            symbolicId: 120
        });
        encode_decode_round_trip_test(diag, (buffer) => {
            buffer.length.should.equal(5);
        });
    });

    it("should encode DiagnosticInfo with symbolicId and locale in 9-bytes", () => {
        const diag = new DiagnosticInfo({
            symbolicId: 120,
            locale: 128
        });
        encode_decode_round_trip_test(diag, (buffer) => {
            buffer.length.should.equal(9);
        });
    });

    it("should encode DiagnosticInfo with InnerStatusCode in 5-bytes", () => {
        const diag = new DiagnosticInfo({
            symbolicId: 120,
            locale: 128,
            innerStatusCode: StatusCodes.BadCertificateRevocationUnknown
        });

        encode_decode_round_trip_test(diag, (buffer) => {
            buffer.length.should.equal(13);
        });
    });

    it("should encode DiagnosticInfo with a default innerDiagnosticInfo in 2-bytes", () => {
        const diag = new DiagnosticInfo({
            innerDiagnosticInfo: new DiagnosticInfo({})
        });

        encode_decode_round_trip_test(diag, (buffer) => {
            buffer.length.should.equal(2);
        });
    });

    it("should encode DiagnosticInfo with an innerDiagnosticInfo  containing a 5 car string in 11-bytes", () => {
        const diag = new DiagnosticInfo({
            innerDiagnosticInfo: new DiagnosticInfo({ additionalInfo: "Hello" })
        });

        encode_decode_round_trip_test(diag, (buffer) => {
            buffer.length.should.equal(2 + 4 + 5);
        });
    });

    it("should encode DiagnosticInfo with SymbolicId", () => {
        const diag = new DiagnosticInfo({
            symbolicId: 1234
        });

        encode_decode_round_trip_test(diag, (buffer) => {
            buffer.length.should.equal(5);
        });
    });

    it("should encode DiagnosticInfo with LocalizedText", () => {
        const diag = new DiagnosticInfo({
            localizedText: 1234
        });

        encode_decode_round_trip_test(diag, (buffer) => {
            buffer.length.should.equal(1 + 4);
        });
    });
    it("should encode DiagnosticInfo with NamespaceURI", () => {
        const diag = new DiagnosticInfo({
            namespaceURI: 1234
        });

        encode_decode_round_trip_test(diag, (buffer) => {
            buffer.length.should.equal(1 + 4);
        });
    });
    it("should encode DiagnosticInfo with NamespaceURI and LocalizedText and SymbolicId", () => {
        const diag = new DiagnosticInfo({
            localizedText: 2345,
            symbolicId: 3456,
            namespaceURI: 1234
        });

        encode_decode_round_trip_test(diag, (buffer) => {
            buffer.length.should.equal(1 + 4 + 4 + 4);
        });
    });

    it("should not strip away diagnostic information if requested", () => {
        let diag = new DiagnosticInfo({
            localizedText: 2345,
            symbolicId: 3456,
            additionalInfo: "test",
            innerStatusCode: StatusCodes.Bad,
            innerDiagnosticInfo: new DiagnosticInfo({ additionalInfo: "test 2" })
        });
        const serviceLevelMask =
            DiagnosticInfo_ServiceLevelMask.SymbolicId |
            DiagnosticInfo_ServiceLevelMask.LocalizedText |
            DiagnosticInfo_ServiceLevelMask.AdditionalInfo |
            DiagnosticInfo_ServiceLevelMask.InnerStatusCode |
            DiagnosticInfo_ServiceLevelMask.InnerDiagnostics;

        diag = DiagnosticInfo.filterForResponse(diag, serviceLevelMask, DiagnosticInfo_ServiceLevelMask);
        diag.localizedText.should.equal(2345);
        diag.symbolicId.should.equal(3456);
        should(diag.additionalInfo).equal("test");
        diag.innerStatusCode.should.equal(StatusCodes.Bad);

        should(diag.innerDiagnosticInfo).not.equal(null);
        should(diag.innerDiagnosticInfo.additionalInfo).equal("test 2");
    });

    it("should not return any diagnostic info if not specifically requested", () => {
        let diag = new DiagnosticInfo({
            localizedText: 2345,
            symbolicId: 3456,
            additionalInfo: "test",
            innerStatusCode: StatusCodes.Bad,
            innerDiagnosticInfo: new DiagnosticInfo({ additionalInfo: "test 2" })
        });

        diag = DiagnosticInfo.filterForResponse(diag, DiagnosticInfo_ServiceLevelMask.None, DiagnosticInfo_ServiceLevelMask);
        diag.localizedText.should.equal(-1);
        diag.symbolicId.should.equal(-1);
        should(diag.additionalInfo).equal(null);
        diag.innerStatusCode.should.equal(StatusCodes.Good); // 'StatusCodes.Good' is the default value for 'innerStatusCode'

        diag.innerDiagnosticInfo.localizedText.should.equal(-1);
        diag.innerDiagnosticInfo.symbolicId.should.equal(-1);
        should(diag.innerDiagnosticInfo.additionalInfo).equal(null);
        diag.innerDiagnosticInfo.innerStatusCode.should.equal(StatusCodes.Good); // 'StatusCodes.Good' is the default value for 'innerStatusCode'
        should(diag.innerDiagnosticInfo.innerDiagnosticInfo).equal(null);
    });

    it("should strip away unrequested details", () => {
        let diag = new DiagnosticInfo({
            localizedText: 2345,
            symbolicId: 3456,
            additionalInfo: "test",
            innerStatusCode: StatusCodes.Bad,
            innerDiagnosticInfo: new DiagnosticInfo({
                additionalInfo: "test 2",
                innerStatusCode: StatusCodes.Bad,
                symbolicId: 34567
            })
        });
        const serviceLevelMask =
            DiagnosticInfo_ServiceLevelMask.LocalizedText |
            DiagnosticInfo_ServiceLevelMask.AdditionalInfo |
            DiagnosticInfo_ServiceLevelMask.SymbolicId;

        diag = DiagnosticInfo.filterForResponse(diag, serviceLevelMask, DiagnosticInfo_ServiceLevelMask);
        diag.localizedText.should.equal(2345);
        diag.symbolicId.should.equal(3456);
        should(diag.additionalInfo).equal("test");
        diag.innerStatusCode.should.equal(StatusCodes.Good); // 'StatusCodes.Good' is the default value for 'innerStatusCode'

        diag.innerDiagnosticInfo.localizedText.should.equal(-1);
        diag.innerDiagnosticInfo.symbolicId.should.equal(34567);
        should(diag.innerDiagnosticInfo.additionalInfo).equal("test 2");
        diag.innerDiagnosticInfo.innerStatusCode.should.equal(StatusCodes.Good); // 'StatusCodes.Good' is the default value for 'innerStatusCode'
        should(diag.innerDiagnosticInfo.innerDiagnosticInfo).equal(null);
    });

    it("should filter the diagnostic info based on the mask supplied", () => {
        const serviceLevelMask =
            DiagnosticInfo_ServiceLevelMask.LocalizedText |
            DiagnosticInfo_ServiceLevelMask.AdditionalInfo |
            DiagnosticInfo_ServiceLevelMask.SymbolicId;
        const diagnostic = new DiagnosticInfo({
            localizedText: 2345,
            symbolicId: 3456,
            additionalInfo: "test",
            innerStatusCode: StatusCodes.Bad,
            innerDiagnosticInfo: new DiagnosticInfo({
                additionalInfo: "test 2",
                innerStatusCode: StatusCodes.Bad,
                symbolicId: 34567
            })
        });
        const filtered = filterDiagnosticInfoLevel(serviceLevelMask, diagnostic, DiagnosticInfo_ServiceLevelMask);

        should(filtered?.localizedText).equal(diagnostic.localizedText);
        should(filtered?.symbolicId).equal(diagnostic.symbolicId);
        should(filtered?.additionalInfo).equal(diagnostic.additionalInfo);
        should(filtered?.innerStatusCode).not.equal(diagnostic.innerStatusCode);
        should(filtered?.innerStatusCode).equal(StatusCodes.Good); // 'StatusCodes.Good' is the default value for 'innerStatusCode'

        should(filtered?.innerDiagnosticInfo.localizedText).equal(-1);
        should(filtered?.innerDiagnosticInfo.symbolicId).equal(34567);
        should(filtered!.innerDiagnosticInfo.additionalInfo).equal(diagnostic.innerDiagnosticInfo.additionalInfo);
        should(filtered?.innerDiagnosticInfo.innerStatusCode).not.equal(diagnostic.innerDiagnosticInfo.innerStatusCode);
        should(filtered?.innerDiagnosticInfo.innerStatusCode).equal(StatusCodes.Good); // 'StatusCodes.Good' is the default value for 'innerStatusCode'
        should(filtered!.innerDiagnosticInfo.innerDiagnosticInfo).equal(null);
        should(filtered!.innerDiagnosticInfo.innerDiagnosticInfo).equal(diagnostic.innerDiagnosticInfo.innerDiagnosticInfo);
    });

    it("encodeDiagnosticInfo/decodeDiagnosticInfo1", () => {
        const stream = new BinaryStream();
        const diag = new DiagnosticInfo({
            localizedText: 2345,
            symbolicId: 3456,
            namespaceURI: 1234
        });

        encodeDiagnosticInfo(diag, stream);

        const reloaded = new DiagnosticInfo();

        stream.rewind();
        decodeDiagnosticInfo(stream, reloaded);
        reloaded.localizedText.should.eql(diag.localizedText);
        reloaded.symbolicId.should.eql(diag.symbolicId);
        reloaded.namespaceURI.should.eql(diag.namespaceURI);
    });

    it("encodeDiagnosticInfo/decodeDiagnosticInfo2", () => {
        const stream = new BinaryStream();

        encodeDiagnosticInfo(null, stream);
        stream.rewind();
        const reloaded = new DiagnosticInfo();
        decodeDiagnosticInfo(stream, reloaded);
    });

    it("DiagnosticInfo#toString", () => {
        const diag = new DiagnosticInfo({
            localizedText: 2345,
            symbolicId: 3456,
            namespaceURI: 1234
        });
        const str = diag.toString();
        str.should.match(/namespaceUri/gm);
        str.should.match(/localizedText/gm);
        str.should.match(/symbolicId/gm);
    });
    it("DiagnosticInfo#toString", () => {
        const diag = new DiagnosticInfo({
            localizedText: 2345,
            symbolicId: 3456,
            namespaceURI: 1234,
            additionalInfo: "Hello",
            innerDiagnosticInfo: new DiagnosticInfo({ additionalInfo: "World" })
        });
        const str = diag.toString();
        str.should.match(/namespaceUri/gm);
        str.should.match(/localizedText/gm);
        str.should.match(/symbolicId/gm);
        str.should.match(/Hello/gm);
    });
});
