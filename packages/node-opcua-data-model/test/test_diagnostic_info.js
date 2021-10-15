"use strict";

const should = require("should");

const { encode_decode_round_trip_test } = require("node-opcua-packet-analyzer/dist/test_helpers");
const { BinaryStream } = require("node-opcua-binary-stream");
const { StatusCodes } = require("node-opcua-status-code");

const { DiagnosticInfo, encodeDiagnosticInfo, decodeDiagnosticInfo } = require("..");

describe("DiagnosticInfo", function () {
    //xx it("should have encodingDefaultBinary = 25",function(){
    //xx
    //xx     var diag = new DiagnosticInfo();
    //xx     diag.encodingDefaultBinary.value.should.equal(25);
    //xx
    //xx });

    it("should encode default DiagnosticInfo in a single byte", function () {
        const diag = new DiagnosticInfo();

        diag.symbolicId.should.eql(-1);
        diag.locale.should.eql(-1);
        diag.localizedText.should.eql(-1);
        should(diag.additionalInfo).eql(null);
        diag.innerStatusCode.should.eql(StatusCodes.Good);
        should(diag.innerDiagnosticInfo).eql(null);

        encode_decode_round_trip_test(diag, function (buffer) {
            buffer.length.should.equal(1);
        });
    });
    it("should encode default DiagnosticInfo with only symbolicId in 5-bytes", function () {
        const diag = new DiagnosticInfo({
            symbolicId: 120
        });
        encode_decode_round_trip_test(diag, function (buffer) {
            buffer.length.should.equal(5);
        });
    });

    it("should encode DiagnosticInfo with symbolicId and locale in 9-bytes", function () {
        const diag = new DiagnosticInfo({
            symbolicId: 120,
            locale: 128
        });
        encode_decode_round_trip_test(diag, function (buffer) {
            buffer.length.should.equal(9);
        });
    });

    it("should encode DiagnosticInfo with InnerStatusCode in 5-bytes", function () {
        const diag = new DiagnosticInfo({
            symbolicId: 120,
            locale: 128,
            innerStatusCode: StatusCodes.BadCertificateRevocationUnknown
        });

        encode_decode_round_trip_test(diag, function (buffer) {
            buffer.length.should.equal(13);
        });
    });

    it("should encode DiagnosticInfo with a default innerDiagnosticInfo in 2-bytes", function () {
        const diag = new DiagnosticInfo({
            innerDiagnosticInfo: new DiagnosticInfo({})
        });

        encode_decode_round_trip_test(diag, function (buffer) {
            buffer.length.should.equal(2);
        });
    });

    it("should encode DiagnosticInfo with an innerDiagnosticInfo  containing a 5 car string in 11-bytes", function () {
        const diag = new DiagnosticInfo({
            innerDiagnosticInfo: new DiagnosticInfo({ additionalInfo: "Hello" })
        });

        encode_decode_round_trip_test(diag, function (buffer) {
            buffer.length.should.equal(2 + 4 + 5);
        });
    });

    it("should encode DiagnosticInfo with SymbolicId", function () {
        const diag = new DiagnosticInfo({
            symbolicId: 1234
        });

        encode_decode_round_trip_test(diag, function (buffer) {
            buffer.length.should.equal(5);
        });
    });

    it("should encode DiagnosticInfo with LocalizedText", function () {
        const diag = new DiagnosticInfo({
            localizedText: 1234
        });

        encode_decode_round_trip_test(diag, function (buffer) {
            buffer.length.should.equal(1 + 4);
        });
    });
    it("should encode DiagnosticInfo with NamespaceURI", function () {
        const diag = new DiagnosticInfo({
            namespaceURI: 1234
        });

        encode_decode_round_trip_test(diag, function (buffer) {
            buffer.length.should.equal(1 + 4);
        });
    });
    it("should encode DiagnosticInfo with NamespaceURI and LocalizedText and SymbolicId", function () {
        const diag = new DiagnosticInfo({
            localizedText: 2345,
            symbolicId: 3456,
            namespaceURI: 1234
        });

        encode_decode_round_trip_test(diag, function (buffer) {
            buffer.length.should.equal(1 + 4 + 4 + 4);
        });
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
});
