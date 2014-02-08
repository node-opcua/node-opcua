var DirectTransport = require("../../lib/transport/fake_socket").DirectTransport;
var should = require("should");
var opcua = require("../../lib/nodeopcua");
var assert = require("assert");
var utils = require("../../lib/utils");
var color = require("colors");
var s = require("../../lib/structures");


var debugLog  = require("../../lib/utils").make_debugLog(__filename);



describe("testing ServerTCP_transport",function(){
    var ServerTCP_transport = require("../../lib/transport/tcp_transport").ServerTCP_transport;

    var fake_socket;
    beforeEach(function(){
        fake_socket = new DirectTransport();
    });
    afterEach(function(){

    });

    it("should close the communication if the client initiates the communication with a message which is not HEL",function(done){

        var transport = new ServerTCP_transport();
        transport.init(fake_socket.server,function(err){ assert(!err); });

        var not_an_helloMessage = require("../fixture_full_tcp_packets").packet_cs_3;

        fake_socket.client.on("data",function(data){
            var stream = new opcua.BinaryStream(data);
            var messageHeader = opcua.readMessageHeader(stream);
            messageHeader.msgType.should.equal("ERR");
            stream.rewind();
            var response = opcua.decodeMessage(stream, opcua.TCPErrorMessage);
            response._description.name.should.equal("TCPErrorMessage");
            done();
        });

        fake_socket.client.write(not_an_helloMessage);

    });

    it("should bind a socket and process the HEL message by returning ACK",function(done){

        var transport = new ServerTCP_transport();
        transport.init(fake_socket.server,function(err){ assert(!err); });

        // simulate client send HEL

        var helloMessage = require("../fixture_full_tcp_packets").packet_cs_1;

        fake_socket.client.on("data",function(data){
            var stream = new opcua.BinaryStream(data);
            var messageHeader = opcua.readMessageHeader(stream);
            messageHeader.msgType.should.equal("ACK");
            stream.rewind();
            var response = opcua.decodeMessage(stream, opcua.AcknowledgeMessage);
            response._description.name.should.equal("AcknowledgeMessage");
            done();
        });

        fake_socket.client.write(helloMessage);

    });

    it("should bind a socket and process the HEL message by returning ERR if protocol version is not OK",function(done){

        var transport = new ServerTCP_transport();
        transport.init(fake_socket.server,function(err){
            assert(err);
            err.message.should.match(/Protocol version mismatch/);
        });

        // simulate client send HEL
        var helloMessage =   new opcua.HelloMessage({
            protocolVersion:   5555,
            receiveBufferSize: 1000,
            sendBufferSize:    1000,
            maxMessageSize:    10,
            maxChunkCount:     10,
            endpointUrl:       "some string"
        });

        fake_socket.client.on("data",function(data){
            var stream = new opcua.BinaryStream(data);
            var messageHeader = opcua.readMessageHeader(stream);
            messageHeader.msgType.should.equal("ERR");
            stream.rewind();
            var response = opcua.decodeMessage(stream, opcua.AcknowledgeMessage);
            response._description.name.should.equal("TCPErrorMessage");
            done();
        });

        fake_socket.client.write(opcua.packTcpMessage("HEL", helloMessage));

    });

    it("should bind a socket, process the HEL message and forward subsequent messageChunk",function(done){

        var transport = new ServerTCP_transport();
        transport.init(fake_socket.server,function(err){ assert(!err); });

        var helloMessage = require("../fixture_full_tcp_packets").packet_cs_1;
        var openChannelRequest = require("../fixture_full_tcp_packets").packet_cs_2;

        transport.on("message",function(messageChunk){
            utils.compare_buffers(messageChunk,openChannelRequest);
            done();
        });

        var counter =1;
        fake_socket.client.on("data",function(data){
            counter++;

        });

        fake_socket.client.write(helloMessage);

        fake_socket.client.write(openChannelRequest);


    });

});
