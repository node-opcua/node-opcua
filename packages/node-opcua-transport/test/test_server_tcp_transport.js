"use strict";
const should = require("should");
const assert = require("node-opcua-assert").assert;

const utils = require("node-opcua-utils");
const debug = require("node-opcua-debug");
const debugLog = debug.make_debugLog(__filename);

const BinaryStream = require("node-opcua-binary-stream").BinaryStream;
const readMessageHeader = require("node-opcua-chunkmanager").readMessageHeader;

const decodeMessage = require("..").decodeMessage;
const packTcpMessage = require("..").packTcpMessage;
const ServerTCP_transport = require("..").ServerTCP_transport;
const HelloMessage = require("..").HelloMessage;
const AcknowledgeMessage = require("..").AcknowledgeMessage;
const TCPErrorMessage = require("..").TCPErrorMessage;


const DirectTransport = require("../dist/test_helpers").DirectTransport;
const helloMessage = require("../dist/test-fixtures").packet_cs_1;
const openChannelRequest = require("../dist/test-fixtures").packet_cs_2;
const not_an_helloMessage = require("../dist/test-fixtures").packet_cs_3;


describe("testing ServerTCP_transport", function () {

    let fakeSocket;
    beforeEach(function (done) {
        fakeSocket = new DirectTransport();
        fakeSocket.initialize(done);
    });

    afterEach(function (done) {
        fakeSocket.shutdown(done);
    });

    it("should close the communication if the client initiates the communication with a message which is not HEL", function (done) {

        const transport = new ServerTCP_transport();

        transport.init(fakeSocket.server, function (err) {
            assert(err);
            err.message.should.match(/Expecting \'HEL\' message/);
        });


        fakeSocket.client.on("data", function (data) {
            const stream = new BinaryStream(data);
            const messageHeader = readMessageHeader(stream);
            messageHeader.msgType.should.equal("ERR");
            stream.rewind();
            const response = decodeMessage(stream, TCPErrorMessage);
            response.constructor.name.should.equal("TCPErrorMessage");
            done();
        });

        fakeSocket.client.write(not_an_helloMessage);

    });

    it("should bind a socket and process the HEL message by returning ACK", function (done) {

        const transport = new ServerTCP_transport();
        transport.init(fakeSocket.server, function (err) {
            assert(!err);
        });

        // simulate client send HEL


        fakeSocket.client.on("data", function (data) {
            const stream = new BinaryStream(data);
            const messageHeader = readMessageHeader(stream);
            messageHeader.msgType.should.equal("ACK");
            stream.rewind();
            const response = decodeMessage(stream, AcknowledgeMessage);
            response.constructor.name.should.equal("AcknowledgeMessage");
            done();
        });

        fakeSocket.client.write(helloMessage);

    });

    it("should bind a socket and process the HEL message by returning ERR if protocol version is not OK", function (done) {

        const transport = new ServerTCP_transport();
        transport.protocolVersion.should.eql(0);
        transport.protocolVersion = 10;
        transport.init(fakeSocket.server, function (err) {
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

        fakeSocket.client.on("data", function (data) {
            const stream = new BinaryStream(data);
            const messageHeader = readMessageHeader(stream);
            messageHeader.msgType.should.equal("ERR");
            stream.rewind();
            const response = decodeMessage(stream, AcknowledgeMessage);
            response.constructor.name.should.equal("TCPErrorMessage");

            response.statusCode.name.should.eql("BadProtocolVersionUnsupported");
            done();
        });

        fakeSocket.client.write(packTcpMessage("HEL", helloMessage));

    });

    function perform_sever_receiving_a_HEL_MESSAGE_followed_by_OpenChannelRequest_scenario(done) {

        const transport = new ServerTCP_transport();

        transport.init(fakeSocket.server, function (err) {
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
        fakeSocket.client.on("data", function (data) {
            counter++;

        });

        transport.bytesRead.should.equal(0);
        transport.bytesWritten.should.equal(0);

    }

    it("should bind a socket, process the HEL message and forward subsequent messageChunk", function (done) {


        perform_sever_receiving_a_HEL_MESSAGE_followed_by_OpenChannelRequest_scenario(done);

        fakeSocket.client.write(helloMessage);
        fakeSocket.client.write(openChannelRequest);

    });

    it("should handle HEL message broken in two chunks (bug#36)", function (done) {

        perform_sever_receiving_a_HEL_MESSAGE_followed_by_OpenChannelRequest_scenario(done);

        const helloMessage_part1 = helloMessage.slice(0, 10);
        const helloMessage_part2 = helloMessage.slice(10);

        fakeSocket.client.write(helloMessage_part1);
        fakeSocket.client.write(helloMessage_part2);
        fakeSocket.client.write(openChannelRequest);


    });

    it("should handle broken HEL message in three chunks (bug#36)", function (done) {

        perform_sever_receiving_a_HEL_MESSAGE_followed_by_OpenChannelRequest_scenario(done);

        const helloMessage_part1 = helloMessage.slice(0, 10);
        const helloMessage_part2 = helloMessage.slice(10, 25);
        const helloMessage_part3 = helloMessage.slice(25);

        fakeSocket.client.write(helloMessage_part1);
        fakeSocket.client.write(helloMessage_part2);
        fakeSocket.client.write(helloMessage_part3);

        fakeSocket.client.write(openChannelRequest);

    });

    it("should handle broken HEL message in many small chunks (bug#36)", function (done) {

        perform_sever_receiving_a_HEL_MESSAGE_followed_by_OpenChannelRequest_scenario(done);
        for (let i = 0; i < helloMessage.length; i++) {
            const single_byte_chunk = helloMessage.slice(i, i + 1);
            fakeSocket.client.write(single_byte_chunk);
        }
        fakeSocket.client.write(openChannelRequest);

    });
});
