require("requirish")._(module);
var DirectTransport = require("lib/transport/fake_socket").DirectTransport;
var should = require("should");
var opcua = require("lib/nodeopcua");
var assert = require("assert");
var utils = require("lib/misc/utils");
var color = require("colors");
var s = require("lib/datamodel/structures");
var StatusCode = require("lib/datamodel/opcua_status_code").StatusCode;

var debugLog = require("lib/misc/utils").make_debugLog(__filename);


var ClientTCP_transport = require("lib/transport/client_tcp_transport").ClientTCP_transport;

describe("testing ClientTCP_transport", function () {


    var transport;
    beforeEach(function (done) {
        transport = new ClientTCP_transport();
        done();
    });
    afterEach(function (done) {
        transport.disconnect(function (err) {
            done(err);
        });
    });

    var fake_AcknowledgeMessage = new opcua.AcknowledgeMessage({
        protocolVersion:    0,
        receiveBufferSize:  8192,
        sendBufferSize:     8192,
        maxMessageSize:     100000,
        maxChunkCount:      600000
    });

    it("should create and connect to a client TCP", function (done) {

        var fake_socket = new DirectTransport();

        fake_socket.server.on("data", function (data) {

            assert(data);
            // received Fake HEL Message

            // send Fake ACK response
            var messageChunk = opcua.packTcpMessage("ACK", fake_AcknowledgeMessage);
            fake_socket.server.write(messageChunk);

        });


        require("lib/transport/tcp_transport").setFakeTransport(fake_socket.client);

        transport.connect("fake://localhost:2033/SomeAddress", function (err) {
            done(err);
        });

    });

    it("should report a time out error if trying to connect to a non responding server", function (done) {

        var fake_no_responding_socket = new DirectTransport();

        fake_no_responding_socket.server.on("data", function (data) {

            // DO NOTHING !!
        });

        require("lib/transport/tcp_transport").setFakeTransport(fake_no_responding_socket.client);

        transport.timeout = 10; // very short timeout;

        transport.connect("fake://localhost:2033/SomeAddress", function (err) {
            if (err) {
                err.message.should.containEql("Timeout");
                done();
            } else {
                done(new Error("Should have raised a timeout error"));
            }
        });

    });

    it("should report an error if the server close the socket unexpectedly", function (done) {

        var fake_socket = new DirectTransport();

        fake_socket.server.on("data", function (data) {

            // received Fake HEL Message

            // Pretend the message is malformed or that the server crashed for some reason : abort now !
            fake_socket.server.end();
        });
        require("lib/transport/tcp_transport").setFakeTransport(fake_socket.client);

        transport.timeout = 10; // very short timeout;

        transport.connect("fake://localhost:2033/SomeAddress", function (err) {
            if (err) {
                err.message.should.match(/Connection aborted/);
                done();
            } else {
                done(new Error("Should have raised a connection error"));
            }
        });

    });

    function makeError(statusCode) {
        assert(statusCode instanceof StatusCode);
        return new s.TCPErrorMessage({ name: statusCode.value, reason: statusCode.description});
    }

    it("should report an error if the server reports a protocol version mismatch", function (done) {

        var fake_socket = new DirectTransport();
        var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

        fake_socket.server.on("data", function (data) {
            // received Fake HEL Message

            // Pretend the protocol version is wrong.
            var errorResponse = makeError(StatusCodes.BadProtocolVersionUnsupported);
            var messageChunk = opcua.packTcpMessage("ERR", errorResponse);
            fake_socket.server.write(messageChunk);

            setImmediate(function () {
                fake_socket.server.end();
            });
        });
        require("lib/transport/tcp_transport").setFakeTransport(fake_socket.client);

        transport.timeout = 10; // very short timeout;

        transport.connect("fake://localhost:2033/SomeAddress", function (err) {
            if (err) {
                err.message.should.match(/The applications do not have compatible protocol versions/);
                done();
            } else {
                done(new Error("transport.connect should have raised a connection error"));
            }
        });

    });

    it("should connect and forward subsequent message chunks after a valid HEL/ACK transaction", function (done) {

        // lets build the subsequent message
        var message1 = new Buffer(10);
        message1.writeUInt32BE(0xDEADBEEF, 0);
        message1.writeUInt32BE(0xFEFEFEFE, 4);
        message1.writeUInt16BE(0xFFFF, 8);

        var fake_socket = new DirectTransport();

        var counter = 1;

        fake_socket.server.on("data", function (data) {

            debugLog("\ncounter = ".cyan.bold, counter);
            debugLog(utils.hexDump(data).yellow.bold);
            if (counter === 1) {
                // HEL/ACK transaction
                var messageChunk = opcua.packTcpMessage("ACK", fake_AcknowledgeMessage);
                counter += 1;
                fake_socket.server.write(messageChunk);

            } else if (counter === 2) {

                counter += 1;
                data.length.should.equal(18);

                utils.compare_buffers(data.slice(8), message1);
                fake_socket.server.write(data);

            } else {
                console.log(" UNWANTED PACKET");
            }
            counter.should.be.lessThan(4);
        });

        require("lib/transport/tcp_transport").setFakeTransport(fake_socket.client);

        transport.timeout = 10; // very short timeout;

        transport.on("message", function (message_chunk) {
            debugLog(utils.hexDump(message_chunk).cyan.bold);
            utils.compare_buffers(message_chunk.slice(8), message1);
            done();
        });

        transport.connect("fake://localhost:2033/SomeAddress", function (err) {
            assert(!err);
            var buf = transport.createChunk("MSG", "F", message1.length);
            message1.copy(buf, transport.headerSize, 0, message1.length);
            transport.write(buf);
        });
    });

    it("should close the socket and emit a close event when disconnect() is called", function (done) {

        var fake_socket = new DirectTransport();

        var counter = 1;

        var server_confirms_that_server_socket_has_been_closed = false;
        var transport_confirms_that_close_event_has_been_processed = false;

        fake_socket.server.on("data", function (data) {

            debugLog("\ncounter = ".cyan.bold, counter);
            debugLog(utils.hexDump(data).yellow.bold);
            if (counter === 1) {
                // HEL/ACK transaction
                var messageChunk = opcua.packTcpMessage("ACK", fake_AcknowledgeMessage);
                counter += 1;
                fake_socket.server.write(messageChunk);
                return;
            }
            assert(false, "unexpected data received");

        }).on("end", function () {
            server_confirms_that_server_socket_has_been_closed = true;
        });

        require("lib/transport/tcp_transport").setFakeTransport(fake_socket.client);

        transport.timeout = 10; // very short timeout;

        transport.on("close", function (err) {
            transport_confirms_that_close_event_has_been_processed.should.eql(false, "close event shall only be received once");
            transport_confirms_that_close_event_has_been_processed = true;
            should(err).be.eql(null, "close event shall have err===null, when disconnection is initiated by the client itself");
        });

        transport.connect("fake://localhost:2033/SomeAddress", function (err) {
            assert(!err);
            server_confirms_that_server_socket_has_been_closed.should.equal(false);
            transport_confirms_that_close_event_has_been_processed.should.equal(false);
            transport.disconnect(function (err) {
                assert(!err);
                server_confirms_that_server_socket_has_been_closed.should.equal(true);
                transport_confirms_that_close_event_has_been_processed.should.equal(true);
                done(err);
            });
        });
    });

    it("should dispose the socket and emit a close event when socket is closed by the other end", function (done) {

        var fake_socket = new DirectTransport();

        var counter = 1;

        var server_confirms_that_server_socket_has_been_closed = false;
        var transport_confirms_that_close_event_has_been_processed = false;

        fake_socket.server.on("data", function (data) {

            debugLog("\ncounter = ".cyan.bold, counter);
            debugLog(utils.hexDump(data).yellow.bold);
            if (counter === 1) {
                // HEL/ACK transaction
                var messageChunk = opcua.packTcpMessage("ACK", fake_AcknowledgeMessage);
                counter += 1;
                fake_socket.server.write(messageChunk);

                setTimeout(function () {
                    debugLog(" Aborting server ");
                    fake_socket.server.end(); // close after 10 ms
                }, 10);

            } else if (counter === 2) {

            } else {
                assert(false, "unexpected data received");
            }
        }).on("end", function () {
            server_confirms_that_server_socket_has_been_closed = true;
        });

        require("lib/transport/tcp_transport").setFakeTransport(fake_socket.client);

        transport.timeout = 10; // very short timeout;
        transport.on("close", function (err) {

            //xx console.log(" XXXXX where are we ?", (new Error()).stack);

            transport_confirms_that_close_event_has_been_processed.should.eql(false,"close event shall only be received once");

            transport_confirms_that_close_event_has_been_processed = true;

            should(err).be.instanceOf(Error,
                "the close event should pass a valid Error object because disconnection is caused by external event");

            done();

        });

        transport.connect("fake://localhost:2033/SomeAddress", function (err) {
            assert(!err);
        });

    });


    it("should returns an error if url has invalid port",function(done){

        transport.connect("opc.tcp://localhost:XXXXX/SomeAddress", function (err) {
            if (err) {
                err.message.should.match(/port should be >= 0 and < 65536/);
                done();
            } else {
                done(new Error("Should have raised a connection error"));
            }
        });
    });

});
