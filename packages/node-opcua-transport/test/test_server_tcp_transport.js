"use strict";
const should = require("should");
const assert = require("node-opcua-assert").assert;

const DirectTransport = require("../test_helpers/fake_socket").DirectTransport;

const utils = require("node-opcua-utils");
const debug = require("node-opcua-debug");
const debugLog = debug.make_debugLog(__filename);

const color = require("colors");
const BinaryStream = require("node-opcua-binary-stream").BinaryStream;
const readMessageHeader = require("node-opcua-chunkmanager").readMessageHeader;

const decodeMessage = require("../src/tools").decodeMessage;
const packTcpMessage = require("../src/tools").packTcpMessage;
const ServerTCP_transport = require("../src/server_tcp_transport").ServerTCP_transport;

const HelloMessage = require("../_generated_/_auto_generated_HelloMessage").HelloMessage;
const AcknowledgeMessage = require("../_generated_/_auto_generated_AcknowledgeMessage").AcknowledgeMessage;
const TCPErrorMessage = require("../_generated_/_auto_generated_TCPErrorMessage").TCPErrorMessage;


describe("testing ServerTCP_transport", function () {

    const helloMessage = require("../test-fixtures/fixture_full_tcp_packets").packet_cs_1;
    const openChannelRequest = require("../test-fixtures/fixture_full_tcp_packets").packet_cs_2;


    let fake_socket;
    beforeEach(function (done) {
        fake_socket = new DirectTransport(done);
    });

    afterEach(function (done) {
        fake_socket.shutdown(done);
    });

    it("should close the communication if the client initiates the communication with a message which is not HEL", function (done) {

        const transport = new ServerTCP_transport();

        transport.init(fake_socket.server, function (err) {
            assert(err);
            err.message.should.match(/Expecting \'HEL\' message/);
        });

        const not_an_helloMessage = require("../test-fixtures/fixture_full_tcp_packets").packet_cs_3;

        fake_socket.client.on("data", function (data) {
            const stream = new BinaryStream(data);
            const messageHeader = readMessageHeader(stream);
            messageHeader.msgType.should.equal("ERR");
            stream.rewind();
            const response = decodeMessage(stream, TCPErrorMessage);
            response._schema.name.should.equal("TCPErrorMessage");
            done();
        });

        fake_socket.client.write(not_an_helloMessage);

    });

    it("should bind a socket and process the HEL message by returning ACK", function (done) {

        const transport = new ServerTCP_transport();
        transport.init(fake_socket.server, function (err) {
            assert(!err);
        });

        // simulate client send HEL

        const helloMessage = require("../test-fixtures/fixture_full_tcp_packets").packet_cs_1;

        fake_socket.client.on("data", function (data) {
            const stream = new BinaryStream(data);
            const messageHeader = readMessageHeader(stream);
            messageHeader.msgType.should.equal("ACK");
            stream.rewind();
            const response = decodeMessage(stream, AcknowledgeMessage);
            response._schema.name.should.equal("AcknowledgeMessage");
            done();
        });

        fake_socket.client.write(helloMessage);

    });

    it("should bind a socket and process the HEL message by returning ERR if protocol version is not OK", function (done) {

        const transport = new ServerTCP_transport();
        transport.protocolVersion.should.eql(0);
        transport.protocolVersion = 10;
        transport.init(fake_socket.server, function (err) {
            assert(err);
            err.message.should.match(/BadProtocolVersionUnsupported/);
        });

        // simulate client send HEL
        // note: client.protocolVersion=5 is lower than server protocolVersion(=10)
        // => server should raise an error
        const helloMessage = new HelloMessage({
            protocolVersion:   5,
            receiveBufferSize: 1000,
            sendBufferSize: 1000,
            maxMessageSize: 10,
            maxChunkCount: 10,
            endpointUrl: "some string"
        });

        fake_socket.client.on("data", function (data) {
            const stream = new BinaryStream(data);
            const messageHeader = readMessageHeader(stream);
            messageHeader.msgType.should.equal("ERR");
            stream.rewind();
            const response = decodeMessage(stream, AcknowledgeMessage);
            response._schema.name.should.equal("TCPErrorMessage");

            response.statusCode.name.should.eql("BadProtocolVersionUnsupported");
            done();
        });

        fake_socket.client.write(packTcpMessage("HEL", helloMessage));

    });

    function perform_sever_receiving_a_HEL_MESSAGE_followed_by_OpenChannelRequest_scenario(done) {

        const transport = new ServerTCP_transport();

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

        let counter = 1;
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

        const helloMessage_part1 = helloMessage.slice(0, 10);
        const helloMessage_part2 = helloMessage.slice(10);

        fake_socket.client.write(helloMessage_part1);
        fake_socket.client.write(helloMessage_part2);
        fake_socket.client.write(openChannelRequest);


    });

    it("should handle broken HEL message in three chunks (bug#36)", function (done) {

        perform_sever_receiving_a_HEL_MESSAGE_followed_by_OpenChannelRequest_scenario(done);

        const helloMessage_part1 = helloMessage.slice(0, 10);
        const helloMessage_part2 = helloMessage.slice(10, 25);
        const helloMessage_part3 = helloMessage.slice(25);

        fake_socket.client.write(helloMessage_part1);
        fake_socket.client.write(helloMessage_part2);
        fake_socket.client.write(helloMessage_part3);

        fake_socket.client.write(openChannelRequest);

    });

    it("should handle broken HEL message in many small chunks (bug#36)", function (done) {

        perform_sever_receiving_a_HEL_MESSAGE_followed_by_OpenChannelRequest_scenario(done);
        for (let i = 0; i < helloMessage.length; i++) {
            const single_byte_chunk = helloMessage.slice(i, i + 1);
            fake_socket.client.write(single_byte_chunk);
        }
        fake_socket.client.write(openChannelRequest);

    });
});
