

var should = require("should");

var encode_decode_round_trip_test = require("node-opcua-packet-analyzer/test_helpers/encode_decode_round_trip_test").encode_decode_round_trip_test

var DiagnosticInfo = require("..").DiagnosticInfo;

var StatusCodes = require("node-opcua-status-code").StatusCodes;

describe("DiagnosticInfo", function () {

    //xx it("should have encodingDefaultBinary = 25",function(){
    //xx
    //xx     var diag = new DiagnosticInfo();
    //xx     diag.encodingDefaultBinary.value.should.equal(25);
    //xx
    //xx });

    it("should encode default DiagnosticInfo in a single byte", function () {

        var diag = new DiagnosticInfo();


        diag.symbolicId.should.eql(-1);
        diag.locale.should.eql(-1);
        diag.localizedText.should.eql(-1);
        should(diag.additionalInfo).eql(null);
        diag.innerStatusCode.should.eql(StatusCodes.Good);
        should(diag.innerDiagnosticInfo).eql(null);

        encode_decode_round_trip_test(diag, function (buffer, id) {
            buffer.length.should.equal(1);
        });

    });
    it("should encode default DiagnosticInfo with only symbolicId in 5-bytes", function () {

        var diag = new DiagnosticInfo({
            symbolicId: 120
        });

        encode_decode_round_trip_test(diag, function (buffer, id) {
            buffer.length.should.equal(5);
        });

    });

    it("should encode DiagnosticInfo with symbolicId and locale in 9-bytes", function () {

        var diag = new DiagnosticInfo({
            symbolicId: 120,
            locale: 128
        });

        encode_decode_round_trip_test(diag, function (buffer, id) {
            buffer.length.should.equal(9);
        });

    });

    it("should encode DiagnosticInfo with InnerStatusCode in 5-bytes", function () {

        var diag = new DiagnosticInfo({
            symbolicId: 120,
            locale: 128,
            innerStatusCode: StatusCodes.BadCertificateRevocationUnknown
        });

        encode_decode_round_trip_test(diag, function (buffer, id) {
            buffer.length.should.equal(13);
        });

    });

    it("should encode DiagnosticInfo with a default innerDiagnosticInfo in 2-bytes", function () {

        var diag = new DiagnosticInfo({
            innerDiagnosticInfo: new DiagnosticInfo({})
        });

        encode_decode_round_trip_test(diag, function (buffer, id) {
            buffer.length.should.equal(2);
        });
    });

    it("should encode default DiagnosticInfo with an innerDiagnosticInfo  containing a 5 car string in 11-bytes", function () {

        var diag = new DiagnosticInfo({
            innerDiagnosticInfo: new DiagnosticInfo({additionalInfo: "Hello"})
        });

        encode_decode_round_trip_test(diag, function (buffer, id) {
            buffer.length.should.equal(2 + 4 + 5);
        });
    });

    it("should encode DiagnosticInfo with SymbolicId", function () {

        var diag = new DiagnosticInfo({
            symbolicId: 1234
        });

        encode_decode_round_trip_test(diag, function (buffer, id) {
            buffer.length.should.equal(5);
        });

    });

    it("should encode DiagnosticInfo with LocalizedText", function () {

        var diag = new DiagnosticInfo({
            localizedText: 1234
        });

        encode_decode_round_trip_test(diag, function (buffer, id) {
            buffer.length.should.equal(1 + 4);
        });

    });
    it("should encode DiagnosticInfo with NamespaceUri", function () {

        var diag = new DiagnosticInfo({
            namespaceUri: 1234
        });

        encode_decode_round_trip_test(diag, function (buffer, id) {
            buffer.length.should.equal(1 + 4);
        });

    });
    it("should encode DiagnosticInfo with NamespaceUri and LocalizedText and SymbolicId", function () {

        var diag = new DiagnosticInfo({
            localizedText: 2345,
            symbolicId: 3456,
            namespaceUri: 1234
        });

        encode_decode_round_trip_test(diag, function (buffer, id) {
            buffer.length.should.equal(1 + 4 + 4 + 4);
        });

    });

});
