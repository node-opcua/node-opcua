var encode_decode_round_trip_test = require("../helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;
var verify_multi_chunk_message= require("../helpers/verify_message_chunk").verify_multi_chunk_message;
var verify_single_chunk_message= require("../helpers/verify_message_chunk").verify_single_chunk_message;

var makebuffer = require("../../lib/misc/utils").makebuffer;

var packet_analyzer = require("../../lib/misc/packet_analyzer").packet_analyzer;
var MessageBuilder = require("../../lib/misc/message_builder").MessageBuilder;
var s = require("../../lib/services/secure_channel_service");
var messageHeaderToString = require("../../lib/misc/packet_analyzer").messageHeaderToString;

var redirectToFile = require("../../lib/misc/utils").redirectToFile;

var FindServersResponse = require("../../lib/services/register_server_service").FindServersResponse;

var should  =require("should");

describe("OPCUA Object creation",function() {

    var s = require("../../lib/datamodel/structures");
    it("should create a complex type with embedded type",function(){

        var applicationDescription = new s.ApplicationDescription({
            applicationUri: "application:uri",
            productUri: "uri:product",
            applicationName: { text: "MyApplication"},
            applicationType: s.ApplicationType.CLIENT,
            gatewayServerUri: undefined,
            discoveryProfileUri: undefined,
            discoveryUrls: []
        });
        applicationDescription.applicationUri.should.equal( "application:uri");
        applicationDescription.productUri.should.equal( "uri:product");
        applicationDescription.applicationName.text.should.equal( "MyApplication");
        applicationDescription.applicationType.should.equal( s.ApplicationType.CLIENT);
        applicationDescription.discoveryUrls.length.should.equal(0);


        var request = new s.CreateSessionRequest({
            clientDescription: applicationDescription,
            serverUri:  "serverUri",
            endpointUrl: "endpointUrl",
            sessionName: "sessionName",
            clientNonce: new Buffer("_clientNonce"),
            clientCertificate: undefined,
            requestedSessionTimeout: 300000,
            maxResponseMessageSize: 800000
        });

        request.clientDescription.applicationUri.should.equal( "application:uri");
        request.clientDescription.productUri.should.equal( "uri:product");
        request.clientDescription.applicationName.text.should.equal( "MyApplication");
        request.clientDescription.applicationType.should.equal( s.ApplicationType.CLIENT);
        request.clientDescription.discoveryUrls.length.should.equal(0);


    });

});


describe("OPCUA Structure encoding and decoding", function () {
    it("should encode and decode a EndPointDescription", function (done) {

        var obj = require("./../fixtures/fixture_GetEndPointResponse").makeEndPoint();
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a GetEndPointResponse 1/4", function (done) {

        var obj = require("./../fixtures/fixture_GetEndPointResponse").fixture1;
        encode_decode_round_trip_test(obj);
        done();
    });
    it("should encode and decode a GetEndPointResponse 2/4", function (done) {

        var obj = require("./../fixtures/fixture_GetEndPointResponse").fixture2;
        encode_decode_round_trip_test(obj);
        done();
    });
    it("should encode and decode a GetEndPointResponse 3/4", function (done) {

        var obj = require("./../fixtures/fixture_GetEndPointResponse").fixture3;
        encode_decode_round_trip_test(obj);
        done();
    });
    it("should encode and decode a GetEndPointResponse 4/4", function (done) {

        var obj = require("./../fixtures/fixture_GetEndPointResponse").fixture4;
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a AsymmetricAlgorithmSecurityHeader ", function (done) {

        var obj = require("./../fixtures/fixture_AsymmetricAlgorithmSecurityHeader").fixture1;
        encode_decode_round_trip_test(obj);
        done();
    });
    it("should encode and decode a OpenSecureChannelRequest", function (done) {

        var obj = require("../fixtures/fixture_OpenSecureChannelRequest").fixture1;

        encode_decode_round_trip_test(obj);
        done();
    });


});


describe("testing DataValue encoding decoding",function(){

    var DataValue = require("./../../lib/datamodel/datavalue").DataValue;
    var DataType = require("./../../lib/datamodel/variant").DataType;
    var StatusCodes = require("./../../lib/datamodel/opcua_status_code").StatusCodes;

    var Variant = require("../../lib/datamodel/variant").Variant;

    it("should encode and decode a empty DataValue 1/3",function(done){
        var dataValue1 = new DataValue({
        });
        encode_decode_round_trip_test(dataValue1,function(buf) {
            buf.length.should.eql(1);
        });
        done();
    });


    it("should encode and decode a DataValue with only value field 2/3",function(done){
        var dataValue1 = new DataValue({
            value: {dataType: DataType.Double, value: 37.5 }
        });
        encode_decode_round_trip_test(dataValue1);
        done();
    });

    it("should encode and decode a DataValue with all fields 3/3",function(done){
        var dataValue1 = new DataValue({
            sourceTimestamp: new Date(),
            sourcePicoseconds: 100,
            serverTimestamp: new Date(),
            serverPicoseconds: 110,
            statusCode: StatusCodes.Bad_ApplicationSignatureInvalid,
            value: {dataType: DataType.Double, value: 37.5 }
        });

        dataValue1.value.should.be.instanceOf(Variant);
        encode_decode_round_trip_test(dataValue1);
        done();
    });


});



describe("checking decoding real message bodies captured with WireShark ", function () {

    it("should decode a real OpenSecureChannelRequest message", function (done) {


        // a real OpenSecureChannelRequest captured with wireshark
        var ws_OpenSecureChannelRequest = makebuffer(
            "4f 50 4e 46 85 00 00 00 00 00 00 00 2f 00 00 00 " + // OPNF ...
                "68 74 74 70 3a 2f 2f 6f 70 63 66 6f 75 6e 64 61 " +
                "74 69 6f 6e 2e 6f 72 67 2f 55 41 2f 53 65 63 75 " +
                "72 69 74 79 50 6f 6c 69 63 79 23 4e 6f 6e 65 ff " +
                "ff ff ff ff ff ff ff 33 00 00 00 01 00 00 00 01 " +
                "00 be 01 00 00 92 c2 53 d3 0c f7 ce 01 00 00 00 " +
                "00 00 00 00 00 ff ff ff ff 00 00 00 00 00 00 00 " +
                "00 00 00 00 00 00 00 00 01 00 00 00 01 00 00 00 " +
                "00 e0 93 04 00"
        );

        redirectToFile("OpenSecureChannelResponse.log", function () {
            verify_single_chunk_message(ws_OpenSecureChannelRequest);
        }, done);

    });

it("should decode a real OpenSecureChannelResponse message", function (done) {

        // a real OpenSecureChannelResponse captured with wireshark
        var ws_OpenSecureChannelResponse = makebuffer(
            "4f 50 4e 46 87 00 00 00 01 00 " +                      // OPNF ...
                "00 00 2f 00 00 00 68 74 74 70 3a 2f 2f 6f 70 63 " +
                "66 6f 75 6e 64 61 74 69 6f 6e 2e 6f 72 67 2f 55 " +
                "41 2f 53 65 63 75 72 69 74 79 50 6f 6c 69 63 79 " +
                "23 4e 6f 6e 65 ff ff ff ff ff ff ff ff 00 00 00 " +
                "00 01 00 00 00 01 00 c1 01 a2 e9 53 d3 0c f7 ce " +
                "01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 " +
                "00 00 00 00 00 01 00 00 00 02 00 00 00 a2 e9 53 " +
                "d3 0c f7 ce 01 60 ea 00 00 ff ff ff ff"
        );

        redirectToFile("OpenSecureChannelResponse.log", function () {
            verify_single_chunk_message(ws_OpenSecureChannelResponse);
        }, done);

    });

    it("should decode a real FindServersRequest message", function (done) {

        // a real OpenSecureChannelResponse captured with wireshark
        var ws_message = makebuffer(
            "4d 53 47 46 60 00 00 00 01 00 " +
                "00 00 02 00 00 00 34 00 00 00 02 00 00 00 01 00 " +
                "a6 01 00 00 62 2c 63 d3 0c f7 ce 01 01 00 00 00 " +
                "00 00 00 00 ff ff ff ff 10 27 00 00 00 00 00 1b " +
                "00 00 00 6f 70 63 2e 74 63 70 3a 2f 2f 31 39 32 " +
                "2e 31 36 38 2e 32 2e 36 30 3a 34 38 34 30 00 00 " +
                "00 00 00 00 00 00"
        );

        redirectToFile("FindServersRequest.log", function () {
            verify_single_chunk_message(ws_message);
        }, done);

    });

    it("should decode a real FindServersResponse message", function (done) {

        // a real OpenSecureChannelResponse captured with wireshark
        var ws_message = makebuffer(
            "4d 53 47 46 b9 00 00 00 01 00 " +
                "00 00 02 00 00 00 01 00 00 00 02 00 00 00 01 00 " +
                "a9 01 e2 2b 63 d3 0c f7 ce 01 01 00 00 00 00 00 " +
                "00 00 00 00 00 00 00 00 00 00 01 00 00 00 1c 00 " +
                "00 00 75 75 75 75 75 75 75 75 75 75 75 75 75 75 " +
                "75 75 75 75 75 75 75 75 75 75 75 75 75 75 1f 00 " +
                "00 00 68 74 74 70 3a 2f 2f 77 77 77 2e 75 75 75 " +
                "75 75 75 75 75 75 75 75 75 75 75 75 75 75 2e 75 " +
                "75 02 0a 00 00 00 53 49 50 4c 55 47 34 4f 50 43 " +
                "00 00 00 00 ff ff ff ff ff ff ff ff 01 00 00 00 " +
                "1b 00 00 00 6f 70 63 2e 74 63 70 3a 2f 2f 31 39 " +
                "32 2e 31 36 38 2e 32 2e 36 30 3a 34 38 34 30"
        );

        redirectToFile("FindServersResponse.log", function () {
            verify_single_chunk_message(ws_message);
        }, done);

    });


});

describe("checking decoding real messageChunks captured with WireShark ", function () {

    var packets = require("./../fixtures/fixture_full_tcp_packets");

    it("should decode a real OpenSecureChannelRequest message", function (done) {

        redirectToFile("ws_OpenSecureChannelRequest.log", function () {
            verify_multi_chunk_message([packets.packet_cs_2]);
        }, done);
    });
    it("should decode a real OpenSecureChannelResponse message", function (done) {

        redirectToFile("ws_OpenSecureChannelResponse.log", function () {
            verify_multi_chunk_message([packets.packet_sc_2]);
        }, done);
    });
    it("should decode a real GetEndPointRequest message", function (done) {

        redirectToFile("ws_GetEndPointRequest.log", function () {
            verify_multi_chunk_message([packets.packet_cs_3]);
        }, done);
    });
    it("should decode a real GetEndPointResponse message", function (done) {

        redirectToFile("ws_GetEndPointResponse.log", function () {
            verify_multi_chunk_message([packets.packet_sc_3_a, packets.packet_sc_3_b]);
        }, done);
    });
    it("should decode a real CloseSecureChannel message", function (done) {

        redirectToFile("ws_CloseSecureChannel.log", function () {
            verify_multi_chunk_message([packets.packet_sc_5]);
        }, done);
    });

    it("should handle tcp packet that have data from two messages", function (done) {

        // construct a tcp packet that have 2 messages
        var buffer = new Buffer(packets.packet_sc_3_a.length+packets.packet_sc_3_b.length+packets.packet_sc_5.length);
        packets.packet_sc_3_a.copy(buffer,0);
        packets.packet_sc_3_b.copy(buffer,packets.packet_sc_3_a.length);
        packets.packet_sc_5.copy(buffer,packets.packet_sc_3_a.length + packets.packet_sc_3_b.length);

        redirectToFile("ws_overlaping_message.log", function () {
            verify_multi_chunk_message([buffer]);
        }, done);
    });

    it("should decode a real createSessionRequest message",function(done){
        redirectToFile("ws_CreateSessionRequest.log", function () {
            verify_multi_chunk_message([packets.packet_cs_6]);
        }, done);
    });

    it("should decode a real ActivateSessionRequest message",function(done){
        redirectToFile("ws_ActivateSessionRequest.log", function () {
            verify_multi_chunk_message([packets.packet_cs_7]);
        }, done);
    });
    it("should decode a real ActivateSessionResponse message",function(done){
        redirectToFile("ws_ActivateSessionResponse.log", function () {
            verify_multi_chunk_message([packets.packet_sc_7]);
        }, done);
    });

    it("should decode a real CreateSessionResponse message sent in two chunks", function (done) {

        var packet1 = require("./../fixtures/fixture_CreateSessionResponse.js").packet_CreateSessionResponse_1;
        var packet2 = require("./../fixtures/fixture_CreateSessionResponse.js").packet_CreateSessionResponse_2;

        redirectToFile("ws_CreateSessionResponse.log", function () {
            verify_multi_chunk_message([packet1,packet2]);
        }, done);
    });

    it("should decode this real CreateSessionResponse message sent in one chunk", function (done) {

        var packet1 = require("./../fixtures/fixture_CreateSessionResponse.js").packet_CreateSessionResponse_3;

        redirectToFile("ws_CreateSessionResponse2.log", function () {
            verify_multi_chunk_message([packet1]);
        }, done);
    });
});

