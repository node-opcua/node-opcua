require("requirish")._(module);
var DirectTransport = require("lib/transport/fake_socket").DirectTransport;
var should = require("should");
var opcua = require("lib/opcua");
var assert = require("assert");
var utils = require("lib/misc/utils");
var color = require("colors");
var s = require("lib/datamodel/structures");
var BinaryStream = require("lib/misc/binaryStream").BinaryStream;


var debugLog = require("lib/misc/utils").make_debugLog(__filename);


describe("testing ServerTCP_transport", function () {


    var ServerTCP_transport = require("lib/transport/server_tcp_transport").ServerTCP_transport;

    var helloMessage = require("test/fixtures/fixture_full_tcp_packets").packet_cs_1;
    var openChannelRequest = require("test/fixtures/fixture_full_tcp_packets").packet_cs_2;

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

        var not_an_helloMessage = require("test/fixtures/fixture_full_tcp_packets").packet_cs_3;

        fake_socket.client.on("data", function (data) {
            var stream = new BinaryStream(data);
            var messageHeader = opcua.readMessageHeader(stream);
            messageHeader.msgType.should.equal("ERR");
            stream.rewind();
            var response = opcua.decodeMessage(stream, opcua.TCPErrorMessage);
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

        var helloMessage = require("test/fixtures/fixture_full_tcp_packets").packet_cs_1;

        fake_socket.client.on("data", function (data) {
            var stream = new BinaryStream(data);
            var messageHeader = opcua.readMessageHeader(stream);
            messageHeader.msgType.should.equal("ACK");
            stream.rewind();
            var response = opcua.decodeMessage(stream, opcua.AcknowledgeMessage);
            response._schema.name.should.equal("AcknowledgeMessage");
            done();
        });

        fake_socket.client.write(helloMessage);

    });

    it("should bind a socket and process the HEL message by returning ERR if protocol version is not OK", function (done) {

        var transport = new ServerTCP_transport();
        transport.init(fake_socket.server, function (err) {
            assert(err);
            err.message.should.match(/BadProtocolVersionUnsupported/);
        });

        // simulate client send HEL
        var helloMessage = new opcua.HelloMessage({
            protocolVersion: 5555,
            receiveBufferSize: 1000,
            sendBufferSize: 1000,
            maxMessageSize: 10,
            maxChunkCount: 10,
            endpointUrl: "some string"
        });

        fake_socket.client.on("data", function (data) {
            var stream = new BinaryStream(data);
            var messageHeader = opcua.readMessageHeader(stream);
            messageHeader.msgType.should.equal("ERR");
            stream.rewind();
            var response = opcua.decodeMessage(stream, opcua.AcknowledgeMessage);
            response._schema.name.should.equal("TCPErrorMessage");

            done();
        });

        fake_socket.client.write(opcua.packTcpMessage("HEL", helloMessage));

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

    it("should handle HEL message broken in two chunks (bug#36)",function(done) {

        perform_sever_receiving_a_HEL_MESSAGE_followed_by_OpenChannelRequest_scenario(done);

        var helloMessage_part1 = helloMessage.slice(0,10);
        var helloMessage_part2 = helloMessage.slice(10);

        fake_socket.client.write(helloMessage_part1);
        fake_socket.client.write(helloMessage_part2);
        fake_socket.client.write(openChannelRequest);


    });

    it("should handle broken HEL message in three chunks (bug#36)",function(done) {

        perform_sever_receiving_a_HEL_MESSAGE_followed_by_OpenChannelRequest_scenario(done);

        var helloMessage_part1 = helloMessage.slice(0,10);
        var helloMessage_part2 = helloMessage.slice(10,25);
        var helloMessage_part3 = helloMessage.slice(25);

        fake_socket.client.write(helloMessage_part1);
        fake_socket.client.write(helloMessage_part2);
        fake_socket.client.write(helloMessage_part3);

        fake_socket.client.write(openChannelRequest);

    });

    it("should handle broken HEL message in many small chunks (bug#36)",function(done) {

        perform_sever_receiving_a_HEL_MESSAGE_followed_by_OpenChannelRequest_scenario(done);
        for (var i=0;i<helloMessage.length;i++) {
            var single_byte_chunk = helloMessage.slice(i,i+1);
            fake_socket.client.write(single_byte_chunk);
        }
        fake_socket.client.write(openChannelRequest);

    });
});
