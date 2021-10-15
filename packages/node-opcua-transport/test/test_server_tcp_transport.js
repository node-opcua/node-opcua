"use strict";
const should = require("should");
const { assert } = require("node-opcua-assert");

const utils = require("node-opcua-utils");
const debug = require("node-opcua-debug");
const debugLog = debug.make_debugLog("TEST");

const { BinaryStream } = require("node-opcua-binary-stream");
const { readMessageHeader } = require("node-opcua-chunkmanager");

const { decodeMessage, packTcpMessage, ServerTCP_transport, HelloMessage, AcknowledgeMessage, TCPErrorMessage } = require("..");

const DirectTransport = require("../dist/test_helpers").DirectTransport;

const packets = require("../dist/test-fixtures");
const helloMessage = packets.helloMessage1;
const altered_helloMessage = packets.altered_helloMessage1;
const openChannelRequest = packets.openChannelRequest1;
const not_an_helloMessage = packets.getEndpointsRequest1;
const { altered_openChannelRequest1, altered_openChannelRequest2 } = packets;
const { altered_helloMessage2, altered_helloMessage3 } = packets;

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

        transport.init(fakeSocket.server, (err) => {
            assert(err);
            err.message.should.match(/Expecting 'HEL' message/);
        });

        fakeSocket.client.on("data", (data) => {
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
        transport.init(fakeSocket.server, (err) => {
            assert(!err);
        });

        // simulate client send HEL

        fakeSocket.client.on("data", (data) => {
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

    function test_malformedHelloMessage(altered_helloMessage, done) {
        const transport = new ServerTCP_transport();

        let initError;
        transport.init(fakeSocket.server, (err) => {
            initError = err;
            debugLog("failed !", err.message);
        });

        transport.on("message", (messageChunk) => {
            // console.log("message ", messageChunk);
            done(new Error("Not expecting an message"));
        });
        transport.on("close", (err) => {
            debugLog("close", err);
            if (initError) {
                initError.message.should.match(/BadConnectionRejected/);
            }
            done();
        });
        fakeSocket.client.write(altered_helloMessage);
    }

    it("FUZZ1- should not crash is helloMessage  is malformed causing read overflow (bad endpoint uri length)", (done) => {
        test_malformedHelloMessage(altered_helloMessage, done);
    });
    it("FUZZ2- should not crash is helloMessage  is malformed causing read overflow (bad endpoint uri length)", (done) => {
        test_malformedHelloMessage(altered_helloMessage2, done);
    });
    it("FUZZ3- should not crash is helloMessage  is malformed causing read overflow (bad endpoint uri length)", (done) => {
        test_malformedHelloMessage(altered_helloMessage3, done);
    });

    it("should bind a socket and process the HEL message by returning ERR if protocol version is not OK", function (done) {
        const transport = new ServerTCP_transport();
        transport.protocolVersion.should.eql(0);
        transport.protocolVersion = 10;
        transport.init(fakeSocket.server, (err) => {
            assert(err);
            err.message.should.match(/BadProtocolVersionUnsupported/);
        });

        // simulate client send HEL
        // note: client.protocolVersion=5 is lower than server protocolVersion(=10)
        // => server should raise an error
        const helloMessage = new HelloMessage({
            protocolVersion: 5,
            receiveBufferSize: 1000,
            sendBufferSize: 1000,
            maxMessageSize: 10,
            maxChunkCount: 10,
            endpointUrl: "some string"
        });

        fakeSocket.client.on("data", (data) => {
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

        transport.init(fakeSocket.server, (err) => {
            assert(!err);
        });

        transport.on("message", (messageChunk) => {
            utils.compare_buffers(messageChunk, openChannelRequest);

            // it should provide bytesRead and bytesWritten
            transport.bytesRead.should.be.greaterThan(0);
            transport.bytesWritten.should.be.greaterThan(20);

            done();
        });

        let counter = 1;
        fakeSocket.client.on("data", (data) => {
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

    it("WXWX1 (issue#504)  server transport accept bufferSize greater than 8192 byes", function (done) {
        const transport = new ServerTCP_transport();

        transport.init(fakeSocket.server, (err) => {
            /** */
        });
        const helloMessage = new HelloMessage({
            protocolVersion: 0,
            receiveBufferSize: 8192,
            sendBufferSize: 8192,
            maxMessageSize: 0,
            maxChunkCount: 0,
            endpointUrl: "some string"
        });

        fakeSocket.client.on("data", (data) => {
            const stream = new BinaryStream(data);
            const messageHeader = readMessageHeader(stream);
            messageHeader.msgType.should.not.equal("ERR");
            stream.rewind();
            const response = decodeMessage(stream, AcknowledgeMessage);
            response.constructor.name.should.equal("AcknowledgeMessage");
            done();
        });

        fakeSocket.client.write(packTcpMessage("HEL", helloMessage));
    });

    it("WXWX2 (issue#504) server transport should not accept bufferSize lower than 8192 byes", function (done) {
        const transport = new ServerTCP_transport();

        transport.init(fakeSocket.server, (err) => {
            /** */
        });
        const helloMessage = new HelloMessage({
            protocolVersion: 0,
            receiveBufferSize: 512,
            sendBufferSize: 512,
            maxMessageSize: 0,
            maxChunkCount: 0,
            endpointUrl: "some string"
        });

        fakeSocket.client.on("data", (data) => {
            const stream = new BinaryStream(data);
            const messageHeader = readMessageHeader(stream);
            messageHeader.msgType.should.equal("ERR");
            stream.rewind();
            const response = decodeMessage(stream, AcknowledgeMessage);
            response.constructor.name.should.equal("TCPErrorMessage");
            response.statusCode.name.should.eql("BadConnectionRejected");
            done();
        });

        fakeSocket.client.write(packTcpMessage("HEL", helloMessage));
    });

    it("Test CLO message at transport end ", function (done) {
        const transport = new ServerTCP_transport();
        transport.init(fakeSocket.server, (err) => {
            /** */
        });

        transport.on("message", (messageChunk) => {
            // console.log("message ", messageChunk);
            done();
        });

        const b = Buffer.from("434c4f46180000000c000000010000000f0000000f000000", "hex");
        // xx console.log(debug.hexDump(b, 80));
        // xx console.log(debug.hexDump(packets.packect_outtec, 80));

        fakeSocket.client.on("data", (data) => {
            const stream = new BinaryStream(data);
            const messageHeader = readMessageHeader(stream);
            //  console.log(messageHeader);
            stream.rewind();
            const response = decodeMessage(stream, AcknowledgeMessage);
            //  console.log("response = ", response);
        });

        fakeSocket.client.write(helloMessage);
        fakeSocket.client.write(packets.packect_outtec);
    });
});
