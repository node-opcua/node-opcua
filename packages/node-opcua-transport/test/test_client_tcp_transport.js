"use strict";
var should = require("should");
var assert = require("node-opcua-assert");
var color = require("colors");
var sinon =require("sinon");


var debugLog = require("node-opcua-debug").make_debugLog(__filename);

var FakeServer = require("../test_helpers/fake_socket").FakeServer;

var AcknowledgeMessage = require("../_generated_/_auto_generated_AcknowledgeMessage").AcknowledgeMessage;
var TCPErrorMessage = require("../_generated_/_auto_generated_TCPErrorMessage").TCPErrorMessage;

var ClientTCP_transport = require("../src/client_tcp_transport").ClientTCP_transport;
var packTcpMessage = require("../src/tools").packTcpMessage;
var StatusCodes = require("node-opcua-status-code").StatusCodes;
var StatusCode = require("node-opcua-status-code").StatusCode;
var utils  =require("node-opcua-utils");
var hexDump = require("node-opcua-debug").hexDump;
var compare_buffers = require("node-opcua-utils").compare_buffers;

describe("testing ClientTCP_transport", function () {

    var transport;
    var spyOnClose,spyOnConnect,spyOnConnectionBreak;

    var fake_server ;
    var url;

    beforeEach(function (done) {
        transport = new ClientTCP_transport();

        spyOnClose = sinon.spy();
        transport.on("close",spyOnClose);

        spyOnConnect = sinon.spy();
        transport.on("connect",spyOnConnect);

        spyOnConnectionBreak = sinon.spy();
        transport.on("connection_break",spyOnConnectionBreak);
        
        fake_server = new FakeServer(function(err){
            url = fake_server.url;
            //xx console.log("-----------",err,url);
            done();
        });
    });

    afterEach(function (done) {

        transport.disconnect(function (err) {
            transport = null;
            fake_server.shutdown(function(err){
                fake_server = null;
                done(err);
            });
        });
    });

    var fake_AcknowledgeMessage = new AcknowledgeMessage({
        protocolVersion: 0,
        receiveBufferSize: 8192,
        sendBufferSize: 8192,
        maxMessageSize: 100000,
        maxChunkCount: 600000
    });

    it("should create and connect to a client TCP", function (done) {

        var spyOnServerWrite = sinon.spy(function (socket,data) {
            assert(data);
            // received Fake HEL Message
            // send Fake ACK response
            var messageChunk = packTcpMessage("ACK", fake_AcknowledgeMessage);
            socket.write(messageChunk);
        });

        fake_server.pushResponse(spyOnServerWrite);

        transport.connect(url, function (err) {

            spyOnConnect.callCount.should.eql(1);
            spyOnClose.callCount.should.eql(0);
            spyOnConnectionBreak.callCount.should.eql(0);
            spyOnServerWrite.callCount.should.eql(1);

            transport.disconnect(function(err) {

                spyOnConnect.callCount.should.eql(1);
                spyOnClose.callCount.should.eql(1);
                spyOnConnectionBreak.callCount.should.eql(0);
                spyOnServerWrite.callCount.should.eql(1);

                done(err);
            });

        });

    });

    it("should report a time out error if trying to connect to a non responding server", function (done) {

        var spyOnServerWrite = sinon.spy(function (socket,data) {
            // DO NOTHING !!
        });
        fake_server.pushResponse(spyOnServerWrite);

        transport.timeout = 10; // very short timeout;

        transport.connect(url, function (err) {

            if (err) {
                err.message.should.containEql("Timeout");

                spyOnConnect.callCount.should.eql(0);
                spyOnClose.callCount.should.eql(0);
                spyOnConnectionBreak.callCount.should.eql(0);
                spyOnServerWrite.callCount.should.eql(1);

                done();
            } else {
                done(new Error("Should have raised a timeout error"));
            }
        });

    });

    it("should report an error if the server close the socket unexpectedly", function (done) {

        var spyOnServerWrite = sinon.spy(function (socket,data) {
            should.exist(data);
            // received Fake HEL Message
            // Pretend the message is malformed or that the server crashed for some reason : abort now !
            socket.end();
        });
        fake_server.pushResponse(spyOnServerWrite);

        transport.timeout = 1000; // very short timeout;

        transport.connect(url, function (err) {

            if (err) {

                err.message.should.match(/Connection aborted/);

                spyOnConnect.callCount.should.eql(0);
                spyOnClose.callCount.should.eql(0);
                spyOnConnectionBreak.callCount.should.eql(0);

                done();
            } else {
                done(new Error("Should have raised a connection error"));
            }
        });

    });

    function makeError(statusCode) {
        assert(statusCode instanceof StatusCode);
        return new TCPErrorMessage({statusCode: statusCode, reason: statusCode.description});
    }

    it("should report an error if the server reports a protocol version mismatch", function (done) {


        var spyOnServerWrite = sinon.spy(function (socket,data) {
            // received Fake HEL Message

            // Pretend the protocol version is wrong.
            var errorResponse = makeError(StatusCodes.BadProtocolVersionUnsupported);
            var messageChunk = packTcpMessage("ERR", errorResponse);
            socket.write(messageChunk);

            setImmediate(function () {
                socket.end();
            });
        });
        fake_server.pushResponse(spyOnServerWrite);

        transport.timeout = 1000; // very short timeout;

        transport.connect(url, function (err) {
            if (err) {
                err.message.should.match(/The applications do not have compatible protocol versions/);

                spyOnConnect.callCount.should.eql(0);
                spyOnClose.callCount.should.eql(0);
                spyOnConnectionBreak.callCount.should.eql(0);

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


        var counter = 1;
        var spyOnServerWrite = sinon.spy(function (socket,data) {
            debugLog("\ncounter = ".cyan.bold, counter);
            debugLog(hexDump(data).yellow.bold);
            if (counter === 1) {
                // HEL/ACK transaction
                var messageChunk = packTcpMessage("ACK", fake_AcknowledgeMessage);
                counter += 1;
                socket.write(messageChunk);

            } else if (counter === 2) {

                counter += 1;
                data.length.should.equal(18);

                compare_buffers(data.slice(8), message1);
                socket.write(data);

            } else {
                console.log(" UNWANTED PACKET");
            }
            counter.should.be.lessThan(4);
        });
        fake_server.pushResponse(spyOnServerWrite);
        fake_server.pushResponse(spyOnServerWrite);
        fake_server.pushResponse(spyOnServerWrite);


        transport.timeout = 1000; // very short timeout;

        transport.on("message", function (message_chunk) {
            debugLog(hexDump(message_chunk).cyan.bold);
            compare_buffers(message_chunk.slice(8), message1);

            spyOnConnect.callCount.should.eql(1);
            spyOnClose.callCount.should.eql(0);
            spyOnConnectionBreak.callCount.should.eql(0);

            spyOnServerWrite.callCount.should.eql(2);

            done();
        });

        transport.connect(url, function (err) {
            if (err) {
                console.log(" err = ".bgWhite.red,err.message);
            }
            assert(!err);
            var buf = transport.createChunk("MSG", "F", message1.length);
            message1.copy(buf, transport.headerSize, 0, message1.length);
            transport.write(buf);
        });
    });

    it("should close the socket and emit a close event when disconnect() is called", function (done) {


        var counter = 1;

        var server_confirms_that_server_socket_has_been_closed = false;
        var transport_confirms_that_close_event_has_been_processed = false;

        var spyOnServerWrite = sinon.spy(function (socket,data) {
            debugLog("\ncounter = ".cyan.bold, counter);
            debugLog(hexDump(data).yellow.bold);
            if (counter === 1) {
                // HEL/ACK transaction
                var messageChunk = packTcpMessage("ACK", fake_AcknowledgeMessage);
                counter += 1;
                socket.write(messageChunk);
                return;
            }
            assert(false, "unexpected data received");
        });
        fake_server.pushResponse(spyOnServerWrite);
        fake_server.pushResponse(spyOnServerWrite);

        fake_server.on("end", function () {
            server_confirms_that_server_socket_has_been_closed = true;
        });

        transport.timeout = 1000; // very short timeout;

        transport.on("close", function (err) {
            transport_confirms_that_close_event_has_been_processed.should.eql(false, "close event shall only be received once");
            transport_confirms_that_close_event_has_been_processed = true;
            should(err).be.eql(null, "close event shall have err===null, when disconnection is initiated by the client itself");
        });

        transport.connect(url, function (err) {
            if (err) {
                console.log(" err = ".bgWhite.red,err.message);
            }
            assert(!err);
            server_confirms_that_server_socket_has_been_closed.should.equal(false);
            transport_confirms_that_close_event_has_been_processed.should.equal(false);
            transport.disconnect(function (err) {
                if (err) {
                    console.log(" err = ".bgWhite.red,err.message);
                }
                assert(!err);
                setImmediate(function() {
                    server_confirms_that_server_socket_has_been_closed.should.equal(true);
                    transport_confirms_that_close_event_has_been_processed.should.equal(true);
                    done(err);
                });
            });
        });
    });

    it("should dispose the socket and emit a close event when socket is closed by the other end", function (done) {

        var counter = 1;

        var server_confirms_that_server_socket_has_been_closed = false;
        var transport_confirms_that_close_event_has_been_processed = false;

        var spyOnServerWrite = sinon.spy(function (socket,data) {

            debugLog("\ncounter = ".cyan.bold, counter);
            debugLog(hexDump(data).yellow.bold);
            if (counter === 1) {
                // HEL/ACK transaction
                var messageChunk = packTcpMessage("ACK", fake_AcknowledgeMessage);
                counter += 1;
                socket.write(messageChunk);

                setTimeout(function () {
                    debugLog(" Aborting server ");
                    socket.end(); // close after 10 ms
                }, 10);

            } else if (counter === 2) {
                //
            } else {
                assert(false, "unexpected data received");
            }
        });
        fake_server.pushResponse(spyOnServerWrite);

        fake_server.on("end", function () {
            server_confirms_that_server_socket_has_been_closed = true;
        });


        transport.timeout = 1000; // very short timeout;
        transport.on("close", function (err) {

            //xx console.log(" XXXXX where are we ?", (new Error()).stack);

            transport_confirms_that_close_event_has_been_processed.should.eql(false, "close event shall only be received once");

            transport_confirms_that_close_event_has_been_processed = true;

            should(err).be.instanceOf(Error,
                "the close event should pass a valid Error object because disconnection is caused by external event");

            done();

        });

        transport.connect(url, function (err) {
            assert(!err);
        });

    });


    it("should returns an error if url has invalid port", function (done) {

        transport.connect("opc.tcp://localhost:XXXXX/SomeAddress", function (err) {
            if (err) {
                var regexp_1 = /EADDRNOTAVAIL|ECONNREFUSED/; // node v0.10
                var regexp_2 = /port(" option)* should be/; // node >v0.10 < 9.000
                var regexp_3 = /Port should be > 0 and < 65536. Received NaN/; // node >= 9.000
                var test1 = !!err.message.match(regexp_1);
                var test2 = !!err.message.match(regexp_2);
                var test3 = !!err.message.match(regexp_3);
                (test1 || test2 || test3).should.eql(true, "expecting one of those error message");
                done();
            } else {
                done(new Error("Should have raised a connection error"));
            }
        });
    });

});
