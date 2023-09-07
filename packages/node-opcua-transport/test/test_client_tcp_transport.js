"use strict";
const should = require("should");
const chalk = require("chalk");
const sinon = require("sinon");

const { assert } = require("node-opcua-assert");
const { hexDump } = require("node-opcua-debug");
const { make_debugLog, make_errorLog } = require("node-opcua-debug");
const { StatusCodes, StatusCode } = require("node-opcua-status-code");
const { compare_buffers } = require("node-opcua-utils");

const debugLog = make_debugLog("TEST");
const errorLog = make_errorLog("TEST");

const { FakeServer } = require("../dist/test_helpers");

const port = 5678;

const { AcknowledgeMessage, TCPErrorMessage, ClientTCP_transport, packTcpMessage } = require("..");
const { MessageBuilderBase, writeTCPMessageHeader } = require("..");

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing ClientTCP_transport", function () {
    this.timeout(Math.max(15 * 1000, this.timeout()));

    let clientTransport;
    let spyOnClose, spyOnConnect, spyOnConnectionBreak;

    let fakeServer;
    let endpointUrl;

    beforeEach((done) => {
        clientTransport = new ClientTCP_transport({});

        clientTransport.timeout = 50000; // very long timeout;

        spyOnClose = sinon.spy();
        clientTransport.on("close", spyOnClose);

        spyOnConnect = sinon.spy();
        clientTransport.on("connect", spyOnConnect);

        spyOnConnectionBreak = sinon.spy();
        clientTransport.on("connection_break", spyOnConnectionBreak);

        fakeServer = new FakeServer({ port });
        fakeServer.initialize((err) => {
            endpointUrl = fakeServer.url;
            done(err);
        });
    });

    afterEach((done) => {
        clientTransport.disconnect((err) => {
            spyOnConnect.callCount.should.be.oneOf([0, 1]);
            spyOnClose.callCount.should.be.oneOf([0, 1]);
            if (spyOnConnect.callCount === 1) {
                spyOnClose.callCount.should.equal(1);
            }

            clientTransport.removeAllListeners();
            clientTransport = null;
            fakeServer.shutdown((err) => {
                fakeServer = null;
                done(err);
            });
        });
    });

    const fakeAcknowledgeMessage = new AcknowledgeMessage({
        protocolVersion: 0,
        receiveBufferSize: 8192,
        sendBufferSize: 8192,
        maxMessageSize: 100000,
        maxChunkCount: 600000
    });

    it("TCS-1 should create and connect to a client TCP", (done) => {
        const spyOnServerWrite = sinon.spy(function (socket, data) {
            assert(data);
            // received Fake HEL Message
            // send Fake ACK response
            const messageChunk = packTcpMessage("ACK", fakeAcknowledgeMessage);
            socket.write(messageChunk);
        });

        fakeServer.pushResponse(spyOnServerWrite);

        clientTransport.connect(endpointUrl, (err) => {
            spyOnConnect.callCount.should.eql(1);
            spyOnClose.callCount.should.eql(0);
            spyOnConnectionBreak.callCount.should.eql(0);
            spyOnServerWrite.callCount.should.eql(1);

            clientTransport.disconnect((err) => {
                spyOnConnect.callCount.should.eql(1);
                spyOnClose.callCount.should.eql(1);
                spyOnConnectionBreak.callCount.should.eql(0);
                spyOnServerWrite.callCount.should.eql(1);

                done(err);
            });
        });
    });

    it("TCS-2 should report a time out error if trying to connect to a non responding server", (done) => {
        const spyOnServerWrite = sinon.spy(function (socket, data) {
            // DO NOTHING !!
        });
        fakeServer.pushResponse(spyOnServerWrite);

        clientTransport.timeout = 500; // very short timeout;

        clientTransport.connect(endpointUrl, (err) => {
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

    it("TCS-3 should report an error if the server close the socket unexpectedly", (done) => {
        const spyOnServerWrite = sinon.spy(function (socket, data) {
            should.exist(data);
            // received Fake HEL Message
            // Pretend the message is malformed or that the server crashed for some reason : abort now !
            socket.end();
        });
        fakeServer.pushResponse(spyOnServerWrite);

        clientTransport.timeout = 1000; // very short timeout;

        clientTransport.connect(endpointUrl, (err) => {
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
        return new TCPErrorMessage({ statusCode: statusCode, reason: statusCode.description });
    }

    it("TCS-4 should report an error if the server reports a protocol version mismatch", (done) => {
        const spyOnServerWrite = sinon.spy(function (socket, data) {
            // received Fake HEL Message

            // Pretend the protocol version is wrong.
            const errorResponse = makeError(StatusCodes.BadProtocolVersionUnsupported);
            const messageChunk = packTcpMessage("ERR", errorResponse);
            socket.write(messageChunk);

            setImmediate(function () {
                socket.end();
            });
        });
        fakeServer.pushResponse(spyOnServerWrite);

        clientTransport.timeout = 1000; // very short timeout;

        clientTransport.connect(endpointUrl, (err) => {
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

    it("TCS-5 should connect and forward subsequent message chunks after a valid HEL/ACK transaction", (done) => {
        // lets build the subsequent message
        const message1 = Buffer.alloc(10);
        message1.writeUInt32BE(0xdeadbeef, 0);
        message1.writeUInt32BE(0xfefefefe, 4);
        message1.writeUInt16BE(0xffff, 8);

        let counter = 1;
        const spyOnServerWrite = sinon.spy(function (socket, data) {
            debugLog(chalk.cyan.bold("\ncounter = "), counter);
            debugLog(chalk.yellow.bold(hexDump(data)));
            if (counter === 1) {
                // HEL/ACK transaction
                const messageChunk = packTcpMessage("ACK", fakeAcknowledgeMessage);
                counter += 1;
                socket.write(messageChunk);
            } else if (counter === 2) {
                counter += 1;
                data.length.should.equal(18);

                compare_buffers(data.slice(8), message1);
                socket.write(data);
            } else {
                errorLog(" UNWANTED PACKET");
            }
            counter.should.be.lessThan(4);
        });
        fakeServer.pushResponse(spyOnServerWrite);
        fakeServer.pushResponse(spyOnServerWrite);
        fakeServer.pushResponse(spyOnServerWrite);

        clientTransport.timeout = 1000; // very short timeout;

        clientTransport.on("chunk", function (message_chunk) {
            debugLog(chalk.cyan.bold(hexDump(message_chunk)));
            compare_buffers(message_chunk.slice(8), message1);

            spyOnConnect.callCount.should.eql(1);
            spyOnClose.callCount.should.eql(0);
            spyOnConnectionBreak.callCount.should.eql(0);

            spyOnServerWrite.callCount.should.eql(2);

            done();
        });

        /**
         * ```createChunk``` is used to construct a pre-allocated chunk to store up to ```length``` bytes of data.
         * The created chunk includes a prepended header for ```chunk_type``` of size ```self.headerSize```.
         *
         * @method createChunk
         * @param msgType
         * @param chunkType {String} chunk type. should be 'F' 'C' or 'A'
         * @param length
         * @return a buffer object with the required length representing the chunk.
         *
         * Note:
         *  - only one chunk can be created at a time.
         *  - a created chunk should be committed using the ```write``` method before an other one is created.
         */
        function createChunk(msgType, chunkType, headerSize, length) {
            assert(msgType === "MSG");
            const totalLength = length + headerSize;
            const buffer = Buffer.alloc(totalLength);
            writeTCPMessageHeader("MSG", chunkType, totalLength, buffer);
            return buffer;
        }
        clientTransport.connect(endpointUrl, (err) => {
            if (err) {
                errorLog(chalk.bgWhite.red(" err = "), err.message);
            }
            assert(!err);
            const buf = createChunk("MSG", "F", clientTransport.headerSize, message1.length);
            message1.copy(buf, clientTransport.headerSize, 0, message1.length);
            clientTransport.write(buf);
        });
    });

    it("TCS-6 should close the socket and emit a close event when disconnect() is called", (done) => {
        let counter = 1;

        let server_confirms_that_server_socket_has_been_closed = false;
        let transport_confirms_that_close_event_has_been_processed = false;

        const spyOnServerWrite = sinon.spy(function (socket, data) {
            debugLog(chalk.cyan.bold("\ncounter = "), counter);
            debugLog(chalk.yellow.bold(hexDump(data)));
            if (counter === 1) {
                // HEL/ACK transaction
                const messageChunk = packTcpMessage("ACK", fakeAcknowledgeMessage);
                counter += 1;
                socket.write(messageChunk);
                return;
            }
            assert(false, "unexpected data received");
        });
        fakeServer.pushResponse(spyOnServerWrite);
        fakeServer.pushResponse(spyOnServerWrite);

        fakeServer.on("end", function () {
            server_confirms_that_server_socket_has_been_closed = true;
        });

        clientTransport.timeout = 1000; // very short timeout;

        clientTransport.on("close", (err) => {
            transport_confirms_that_close_event_has_been_processed.should.eql(false, "close event shall only be received once");
            transport_confirms_that_close_event_has_been_processed = true;
            should(err).be.eql(null, "close event shall have err===null, when disconnection is initiated by the client itself");
        });

        clientTransport.connect(endpointUrl, (err) => {
            if (err) {
                errorLog(chalk.bgWhite.red(" err = "), err.message);
            }
            assert(!err);
            server_confirms_that_server_socket_has_been_closed.should.equal(false);
            transport_confirms_that_close_event_has_been_processed.should.equal(false);
            clientTransport.disconnect((err) => {
                if (err) {
                    errorLog(chalk.bgWhite.red(" err = "), err.message);
                }
                assert(!err);
                setImmediate(function () {
                    server_confirms_that_server_socket_has_been_closed.should.equal(true);
                    transport_confirms_that_close_event_has_been_processed.should.equal(true);
                    done(err);
                });
            });
        });
    });

    it("TCS-7 should dispose the socket and emit a close event when socket is closed by the other end", (done) => {
        let counter = 1;

        let server_confirms_that_server_socket_has_been_closed = false;
        let transport_confirms_that_close_event_has_been_processed = false;

        const spyOnServerWrite = sinon.spy(function (socket, data) {
            debugLog(chalk.cyan.bold("\ncounter = "), counter);
            debugLog(chalk.yellow.bold(hexDump(data)));
            if (counter === 1) {
                // HEL/ACK transaction
                const messageChunk = packTcpMessage("ACK", fakeAcknowledgeMessage);
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
        fakeServer.pushResponse(spyOnServerWrite);

        fakeServer.on("end", function () {
            server_confirms_that_server_socket_has_been_closed = true;
        });

        clientTransport.timeout = 1000; // very short timeout;
        clientTransport.on("close", (err) => {
            transport_confirms_that_close_event_has_been_processed.should.eql(false, "close event shall only be received once");

            transport_confirms_that_close_event_has_been_processed = true;

            should(err).be.instanceOf(
                Error,
                "the close event should pass a valid Error object because disconnection is caused by external event"
            );

            done();
        });

        clientTransport.connect(endpointUrl, (err) => {
            assert(!err);
        });
    });

    it("TCS-8 should send 'close' event on internal timeout - #1205", (done) => {
        clientTransport.timeout = 100;

        const spyOnServerWrite = sinon.spy(function (socket, data) {
            assert(data);
            // received Fake HEL Message
            // send Fake ACK response
            const messageChunk = packTcpMessage("ACK", fakeAcknowledgeMessage);
            socket.write(messageChunk);
        });
        fakeServer.pushResponse(spyOnServerWrite);


        clientTransport.on("connect", () => {
            console.log("A - transport connected");
        });

        clientTransport.on("close", function () {
            clearTimeout(timeoutId);
            done();
        });

        clientTransport.connect(endpointUrl, () => {
            console.log("B - transport connected");
            console.log("C - now doing nothing, waiting for timeout to occur");
        });

        console.log("transport.timeout ", clientTransport.timeout);

        const timeoutId = setTimeout(() => {
            done(new Error("TEST: the ClientTCP_transport didn't receive the socket_close event as the communication timed out"));
        }, clientTransport.timeout + 10000);
    });

    it("TCS-9 should returns an error if url has invalid port", (done) => {
        clientTransport.connect("opc.tcp://localhost:XXXXX/SomeAddress", (err) => {
            if (err) {
                const regexp_1 = /EADDRNOTAVAIL|ECONNREFUSED/; // node v0.10
                const regexp_2 = /port(" option)* should be/; // node >v0.10 < 9.000
                const regexp_3 = /Port should be > 0 and < 65536. Received NaN/; // node >= 9.00
                const regexp_4 = /ERR_SOCKET_BAD_PORT|Port should be >= 0 and < 65536. Received NaN./; // node > 10.20
                const regexp_5 = /ERR_SOCKET_BAD_PORT|Port should be >= 0 and < 65536. Received type number/; // node > 19.0
                const test1 = !!err.message.match(regexp_1);
                const test2 = !!err.message.match(regexp_2);
                const test3 = !!err.message.match(regexp_3);
                const test4 = !!err.message.match(regexp_4);
                const test5 = !!err.message.match(regexp_5);
                (test1 || test2 || test3 || test4 || test5).should.eql(
                    true,
                    "expecting one of those error message. got: " + err.message
                );
                done();
            } else {
                done(new Error("Should have raised a connection error"));
            }
        });
    });
});
