"use strict";
var should = require("should");
var assert = require("node-opcua-assert");

var DirectTransport = require("../test_helpers/fake_socket").DirectTransport;

var utils = require("node-opcua-utils");
var debug = require("node-opcua-debug");
var debugLog = debug.make_debugLog(__filename);

var color = require("colors");
var BinaryStream = require("node-opcua-binary-stream").BinaryStream;
var readMessageHeader = require("node-opcua-chunkmanager").readMessageHeader;

var decodeMessage = require("../src/tools").decodeMessage;
var packTcpMessage = require("../src/tools").packTcpMessage;
var ServerTCP_transport = require("../src/server_tcp_transport").ServerTCP_transport;

var HelloMessage = require("../_generated_/_auto_generated_HelloMessage").HelloMessage;
var AcknowledgeMessage = require("../_generated_/_auto_generated_AcknowledgeMessage").AcknowledgeMessage;
var TCPErrorMessage = require("../_generated_/_auto_generated_TCPErrorMessage").TCPErrorMessage;


describe("testing ServerTCP_transport", function () {

    var helloMessage = require("../test-fixtures/fixture_full_tcp_packets").packet_cs_1;
    var openChannelRequest = require("../test-fixtures/fixture_full_tcp_packets").packet_cs_2;


    var fake_socket;
    beforeEach(function (done) {
        fake_socket = new DirectTransport(done);
    });

    afterEach(function (done) {
        fake_socket.shutdown(done);
    });

    it("should close the communication if the client initiates the communication with a message which is not HEL", function (done) {

        var transport = new ServerTCP_transport();

        transport.init(fake_socket.server, function (err) {
            assert(err);
            err.message.should.match(/Expecting \'HEL\' message/);
        });

        var not_an_helloMessage = require("../test-fixtures/fixture_full_tcp_packets").packet_cs_3;

        fake_socket.client.on("data", function (data) {
            var stream = new BinaryStream(data);
            var messageHeader = readMessageHeader(stream);
            messageHeader.msgType.should.equal("ERR");
            stream.rewind();
            var response = decodeMessage(stream, TCPErrorMessage);
            response._schema.name.should.equal("TCPErrorMessage");
            done();
        });

        fake_socket.client.write(not_an_helloMessage);

    });

    it("should bind a socket and process the HEL message by returning ACK", function (done) {

        var transport = new ServerTCP_transport();
        transport.init(fake_socket.server, function (err) {
            assert(!err);
        });

        // simulate client send HEL

        var helloMessage = require("../test-fixtures/fixture_full_tcp_packets").packet_cs_1;

        fake_socket.client.on("data", function (data) {
            var stream = new BinaryStream(data);
            var messageHeader = readMessageHeader(stream);
            messageHeader.msgType.should.equal("ACK");
            stream.rewind();
            var response = decodeMessage(stream, AcknowledgeMessage);
            response._schema.name.should.equal("AcknowledgeMessage");
            done();
        });

        fake_socket.client.write(helloMessage);

    });

    it("should bind a socket and process the HEL message by returning ERR if protocol version is not OK", function (done) {

        var transport = new ServerTCP_transport();
        transport.protocolVersion.should.eql(0);
        transport.protocolVersion = 10;
        transport.init(fake_socket.server, function (err) {
            assert(err);
            err.message.should.match(/BadProtocolVersionUnsupported/);
        });

        // simulate client send HEL
        // note: client.protocolVersion=5 is lower than server protocolVersion(=10)
        // => server should raise an error
        var helloMessage = new HelloMessage({
            protocolVersion:   5,
            receiveBufferSize: 1000,
            sendBufferSize: 1000,
            maxMessageSize: 10,
            maxChunkCount: 10,
            endpointUrl: "some string"
        });

        fake_socket.client.on("data", function (data) {
            var stream = new BinaryStream(data);
            var messageHeader = readMessageHeader(stream);
            messageHeader.msgType.should.equal("ERR");
            stream.rewind();
            var response = decodeMessage(stream, AcknowledgeMessage);
            response._schema.name.should.equal("TCPErrorMessage");

            response.statusCode.name.should.eql("BadProtocolVersionUnsupported");
            done();
        });

        fake_socket.client.write(packTcpMessage("HEL", helloMessage));

    });

    function perform_sever_receiving_a_HEL_MESSAGE_followed_by_OpenChannelRequest_scenario(done) {

        var transport = new ServerTCP_transport();

        transport.init(fake_socket.server, function (err) {
            assert(!err);
        });


        transport.on("message", function (messageChunk) {

            utils.compare_buffers(messageChunk, openChannelRequest);

            // it should provide bytesRead and bytesWritten
            transport.bytesRead.should.be.greaterThan(0);
            transport.bytesWritten.should.be.greaterThan(20);

            done();
        });

        var counter = 1;
        fake_socket.client.on("data", function (data) {
            counter++;

        });

        transport.bytesRead.should.equal(0);
        transport.bytesWritten.should.equal(0);

    }

    it("should bind a socket, process the HEL message and forward subsequent messageChunk", function (done) {


        perform_sever_receiving_a_HEL_MESSAGE_followed_by_OpenChannelRequest_scenario(done);

        fake_socket.client.write(helloMessage);
        fake_socket.client.write(openChannelRequest);

    });

    it("should handle HEL message broken in two chunks (bug#36)", function (done) {

        perform_sever_receiving_a_HEL_MESSAGE_followed_by_OpenChannelRequest_scenario(done);

        var helloMessage_part1 = helloMessage.slice(0, 10);
        var helloMessage_part2 = helloMessage.slice(10);

        fake_socket.client.write(helloMessage_part1);
        fake_socket.client.write(helloMessage_part2);
        fake_socket.client.write(openChannelRequest);


    });

    it("should handle broken HEL message in three chunks (bug#36)", function (done) {

        perform_sever_receiving_a_HEL_MESSAGE_followed_by_OpenChannelRequest_scenario(done);

        var helloMessage_part1 = helloMessage.slice(0, 10);
        var helloMessage_part2 = helloMessage.slice(10, 25);
        var helloMessage_part3 = helloMessage.slice(25);

        fake_socket.client.write(helloMessage_part1);
        fake_socket.client.write(helloMessage_part2);
        fake_socket.client.write(helloMessage_part3);

        fake_socket.client.write(openChannelRequest);

    });

    it("should handle broken HEL message in many small chunks (bug#36)", function (done) {

        perform_sever_receiving_a_HEL_MESSAGE_followed_by_OpenChannelRequest_scenario(done);
        for (var i = 0; i < helloMessage.length; i++) {
            var single_byte_chunk = helloMessage.slice(i, i + 1);
            fake_socket.client.write(single_byte_chunk);
        }
        fake_socket.client.write(openChannelRequest);

    });
});
