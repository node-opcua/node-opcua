var DirectTransport = require("../../lib/transport/fake_socket").DirectTransport;
var should = require("should");
var opcua = require("../../lib/nodeopcua");
var assert = require("assert");
var utils = require("../../lib/utils");
var color = require("colors");
var s = require("../../lib/structures");


var debugLog  = require("../../lib/utils").make_debugLog(__filename);


describe("testing ClientTCP_transport",function(){

    var ClientTCP_transport = require("../../lib/transport/tcp_transport").ClientTCP_transport;

    var transport ;
    beforeEach(function(done){
        transport = new ClientTCP_transport();
        done();
    });
    afterEach(function(done){
        transport.disconnect(function(err){
            assert(!err);
            done();
        })
    });

    var fake_AcknowledgeMessage =  new opcua.AcknowledgeMessage({
        protocolVersion:      1,
        receiveBufferSize:    8192,
        sendBufferSize:       8192,
        maxMessageSize:     100000,
        maxChunkCount:      600000
    });

    it("should create and connect to a client TCP",function(done){

        var fake_socket = new DirectTransport();

        fake_socket.server.on("data",function(data){

            assert(data);
            // received Fake HEL Message

            // send Fake ACK response
            var messageChunk = opcua.packTcpMessage("ACK", fake_AcknowledgeMessage);
            fake_socket.server.write(messageChunk);

        });


        require("../../lib/transport/tcp_transport").setFakeTransport(fake_socket.client);

        transport.connect("fake://localhost:2033/SomeAddress",function(err){
            done(err);
        });

    });

    it("should report a time out error if trying to connect to a non responding server",function(done){

        var fake_no_responding_socket = new DirectTransport();

        fake_no_responding_socket.server.on("data",function(data){

            // DO NOTHING !!
        });

        require("../../lib/transport/tcp_transport").setFakeTransport(fake_no_responding_socket.client);

        transport.timeout = 10; // very short timeout;

        transport.connect("fake://localhost:2033/SomeAddress",function(err){
            if (err) {
                err.message.should.containEql("Timeout");
                done();
            } else {
                done(new Error("Should have raised a timeout error"));
            }
        });

    });

    it("should report an error if the server close the socket unexpectedly",function(done){

        var fake_socket = new DirectTransport();

        fake_socket.server.on("data",function(data){

            // received Fake HEL Message

            // Pretend the message is malformed or that the server crashed for some reason : abort now !
            fake_socket.server.end();
        });
        require("../../lib/transport/tcp_transport").setFakeTransport(fake_socket.client);

        transport.timeout = 10; // very short timeout;

        transport.connect("fake://localhost:2033/SomeAddress",function(err){
            if (err) {
                err.message.should.match(/Connection aborted/);
                done();
            } else {
                done(new Error("Should have raised a connection error"));
            }
        });

    });

    function makeError(statusCode){
        return new s.TCPErrorMessage({ name: statusCode.value, reason: statusCode.description});
    }

    it("should report an error if the server reports a protocol version mismatch",function(done){

        var fake_socket = new DirectTransport();
        var StatusCodes = require("../../lib/opcua_status_code").StatusCodes;

        fake_socket.server.on("data",function(data){
            // received Fake HEL Message

            // Pretend the protocol version is wrong.
            var errorResponse  = makeError(StatusCodes.Bad_ProtocolVersionUnsupported);
            var messageChunk = opcua.packTcpMessage("ERR",errorResponse);
            fake_socket.server.write(messageChunk);

            setImmediate(function(){fake_socket.server.end();});
        });
        require("../../lib/transport/tcp_transport").setFakeTransport(fake_socket.client);

        transport.timeout = 10; // very short timeout;

        transport.connect("fake://localhost:2033/SomeAddress",function(err){
            if (err) {
                err.message.should.match(/The applications do not have compatible protocol versions/);
                done();
            } else {
                done(new Error("transport.connect should have raised a connection error"));
            }
        });

    });

    it("should connect and forward subsequent message chunks after a valid HEL/ACK transaction",function(done){

        var message1 = new Buffer(10);
        message1.writeUInt32BE(0xDEADBEEF,0);
        message1.writeUInt32BE(0xFEFEFEFE,4);
        message1.writeUInt16BE(0xFFFF,8);

        var fake_socket = new DirectTransport();

        var counter = 1;

        fake_socket.server.on("data",function(data){

            debugLog("\ncounter = ".cyan.bold , counter);
            debugLog(utils.hexDump(data).yellow.bold);
            if (counter === 1) {
                // HEL/ACK transaction
                var messageChunk = opcua.packTcpMessage("ACK", fake_AcknowledgeMessage);
                counter += 1;
                fake_socket.server.write(messageChunk);

            } else if (counter == 2) {

                counter += 1;
                data.length.should.equal(18);

                utils.compare_buffers(data.slice(8),message1);
                fake_socket.server.write(data);

            } else {
                console.log(" UNWANTED PACKET");
            }
            counter.should.be.lessThan(4);
        });

        require("../../lib/transport/tcp_transport").setFakeTransport(fake_socket.client);

        transport.timeout = 10; // very short timeout;

        transport.on("message",function(message_chunk){
            debugLog(utils.hexDump(message_chunk).cyan.bold);
            utils.compare_buffers(message_chunk.slice(8),message1);
            done();
        });

        transport.connect("fake://localhost:2033/SomeAddress",function(err){
            assert(!err);
            var buf = transport.createChunk("MSG","F",message1.length);
            message1.copy(buf,transport.headerSize,0,message1.length);
            transport.write(buf);
        });
    });
});


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
