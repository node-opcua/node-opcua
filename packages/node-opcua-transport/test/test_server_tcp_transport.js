"use strict";
const should = require("should");
const sinon = require("sinon");

const { assert } = require("node-opcua-assert");
const utils = require("node-opcua-utils");
const debug = require("node-opcua-debug");
const debugLog = debug.make_debugLog("TEST");

const { BinaryStream } = require("node-opcua-binary-stream");
const { readMessageHeader } = require("node-opcua-chunkmanager");

const { decodeMessage, packTcpMessage, ServerTCP_transport, HelloMessage, AcknowledgeMessage, TCPErrorMessage } = require("..");

const { TransportPairDirect, TransportPairSocket } = require("../dist/test_helpers");

const packets = require("../dist/test-fixtures");
const helloMessage = packets.helloMessage1;
const altered_helloMessage = packets.altered_helloMessage1;
const openChannelRequest = packets.openChannelRequest1;
const not_an_helloMessage = packets.getEndpointsRequest1;
const { altered_openChannelRequest1, altered_openChannelRequest2 } = packets;
const { altered_helloMessage2, altered_helloMessage3 } = packets;

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

const doDebugFlow = false;
const port = 5878;

function installTestFor(TransportPair) {
    describe("testing ServerTCP_transport with " + TransportPair.name, function () {
        let transportPair;
        beforeEach((done) => {
            transportPair = new TransportPair({ port });
            transportPair.initialize(done);

            transportPair.client.timeout = 10000;
        });

        afterEach((done) => {
            transportPair.shutdown(done);
        });

        /** @type {ServerTCP_transport} */
        let serverTransport;
        let spyOnClose, spyOnConnect, spyOnConnectionBreak;
        let oldThrottle = 0;
        beforeEach((done) => {
            oldThrottle = ServerTCP_transport.throttleTime;
            ServerTCP_transport.throttleTime = 100;

            serverTransport = new ServerTCP_transport();
            serverTransport.timeout = this.timeout();

            spyOnClose = sinon.spy();
            serverTransport.on("close", spyOnClose);

            spyOnConnect = sinon.spy();
            serverTransport.on("connect", spyOnConnect);

            spyOnConnectionBreak = sinon.spy();
            serverTransport.on("connection_break", spyOnConnectionBreak);

            transportPair.server.on("data", (data) => {
                doDebugFlow && console.log("Server Socket : Data");
            });
            transportPair.server.on("error", (error) => {
                doDebugFlow && console.log("Server Socket : Error", error);
            });
            transportPair.server.on("end", (error) => {
                doDebugFlow && console.log("Server Socket : End", error);
            });
            transportPair.server.on("timeout", (error) => {
                doDebugFlow && console.log("Server Socket : Timeout", error);
            });
            transportPair.server.on("close", (hadError) => {
                doDebugFlow && console.log("Server Socket : Close", hadError);
            });
            transportPair.server.on("connect", (data) => {
                doDebugFlow && console.log("Server Socket : Connect");
            });
            done();
        });

        afterEach((done) => {
            ServerTCP_transport.throttleTime = oldThrottle;
            setImmediate(() => {
                spyOnConnect.callCount.should.be.oneOf([0, 1]);
                spyOnClose.callCount.should.be.oneOf([0, 1]);
                if (spyOnConnect.callCount === 1) {
                    spyOnClose.callCount.should.equal(1);
                }
                done();
            });
        });

        it("TSS-0 should close the communication of the client doesn't send the HEL message on time, and init should complete with an error", (done) => {
            serverTransport.timeout = 100;

            let hasBeenClosed = false;
            let _errInit;
            serverTransport.init(transportPair.server, (err) => {
                assert(err);
                _errInit = err;
                _errInit.message.should.match(/timeout/);
                spyOnClose.callCount.should.eql(1);
                hasBeenClosed.should.eql(true);
                done();
            });

            transportPair.client.on("data", (data) => {
                const stream = new BinaryStream(data);
                const messageHeader = readMessageHeader(stream);
                messageHeader.msgType.should.equal("ERR");
                stream.rewind();
                const response = decodeMessage(stream, TCPErrorMessage);
                response.constructor.name.should.equal("TCPErrorMessage");
                setImmediate(() => {
                    // should have received a close event
                    spyOnClose.callCount.should.equal(1);
                });
            });

            serverTransport.on("close", () => {
                hasBeenClosed = true;
            });
            // client send nothing !
        });

        it("TSS-1 should send a TCPErrorMessage and close the communication if the client initiates the communication with a message which is not HEL", (done) => {
            let _err = null;
            serverTransport.init(transportPair.server, (err) => {
                assert(err);
                _err = err;

                _err.message.should.match(/Expecting 'HEL' message/);
                spyOnClose.callCount.should.eql(1);
                done();
            });

            transportPair.client.on("data", (data) => {
                const stream = new BinaryStream(data);
                const messageHeader = readMessageHeader(stream);
                messageHeader.msgType.should.equal("ERR");
                stream.rewind();
                const response = decodeMessage(stream, TCPErrorMessage);
                response.constructor.name.should.equal("TCPErrorMessage");

                setImmediate(() => {
                    // should have received a close event
                    spyOnClose.callCount.should.equal(1);
                });
            });

            transportPair.client.write(not_an_helloMessage);
        });

        it("TSS-2 should bind a socket and process the HEL message by returning ACK", (done) => {
            serverTransport.init(transportPair.server, (err) => {
                assert(!err);
            });

            // simulate client send HEL

            transportPair.client.on("data", (data) => {
                const stream = new BinaryStream(data);
                const messageHeader = readMessageHeader(stream);
                messageHeader.msgType.should.equal("ACK");
                stream.rewind();
                const response = decodeMessage(stream, AcknowledgeMessage);
                response.constructor.name.should.equal("AcknowledgeMessage");

                transportPair.client.end();
                done();
            });

            transportPair.client.write(helloMessage);
        });

        function test_malformedHelloMessage(altered_helloMessage, done) {
            let initError;
            serverTransport.init(transportPair.server, (err) => {
                initError = err;
                debugLog("failed !", err.message);
            });

            serverTransport.on("chunk", (messageChunk) => {
                // console.log("message ", messageChunk);
                done(new Error("Not expecting an message"));
            });
            serverTransport.on("close", (err) => {
                debugLog("close", err);
                if (initError) {
                    initError.message.should.match(/BadConnectionRejected/);
                }
                done();
            });
            transportPair.client.write(altered_helloMessage);
        }

        it("TSS-3 - should not crash is helloMessage  is malformed causing read overflow (bad endpoint uri length)", (done) => {
            test_malformedHelloMessage(altered_helloMessage, done);
        });

        it("TSS-4 - should not crash is helloM<essage  is malformed causing read overflow (bad endpoint uri length)", (done) => {
            test_malformedHelloMessage(altered_helloMessage2, done);
        });

        it("TSS-5 - should not crash is helloMessage  is malformed causing read overflow (bad endpoint uri length)", (done) => {
            test_malformedHelloMessage(altered_helloMessage3, done);
        });

        it("TSS-6 should bind a socket and process the HEL message by returning ERR if protocol version is not OK", (done) => {
            serverTransport.protocolVersion.should.eql(0);
            serverTransport.protocolVersion = 10;
            serverTransport.init(transportPair.server, (err) => {
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

            transportPair.client.on("data", (data) => {
                const stream = new BinaryStream(data);
                const messageHeader = readMessageHeader(stream);
                messageHeader.msgType.should.equal("ERR");
                stream.rewind();
                const response = decodeMessage(stream, AcknowledgeMessage);
                response.constructor.name.should.equal("TCPErrorMessage");

                response.statusCode.name.should.eql("BadProtocolVersionUnsupported");
                done();
            });

            transportPair.client.write(packTcpMessage("HEL", helloMessage));
        });

        let lastReceivedChunk;
        let counter = 0;

        function perform_sever_receiving_a_HEL_MESSAGE_followed_by_OpenChannelRequest_scenario() {
            counter = 0;
            serverTransport.setLimits({
                maxChunkCount: 10000,
                maxMessageSize: 10000,
                receiveBufferSize: 10000,
                sendBufferSize: 10000
            });

            serverTransport.init(transportPair.server, (err) => {
                if (err) {
                    console.log(err.message);
                }
                assert(!err);
            });

            serverTransport.on("chunk", (messageChunk) => {
                lastReceivedChunk = messageChunk;
            });

            transportPair.client.on("data", (data) => {
                // console.log("client", debug.hexDump(data));
                counter++;
            });

            serverTransport.bytesRead.should.equal(0);
            serverTransport.bytesWritten.should.equal(0);
        }
        async function doAllSteps(steps) {
            let index = 0;
            const doStep = async () => {
                await new Promise((resolve) => setImmediate(resolve));
                if (index < steps.length) {
                    await steps[index]();
                    index++;
                    await doStep();
                }
            };
            await doStep();
        }

        it("TSS-7 should bind a socket, process the HEL message and forward subsequent messageChunk", async () => {
            perform_sever_receiving_a_HEL_MESSAGE_followed_by_OpenChannelRequest_scenario();

            const steps = [
                () => transportPair.client.write(helloMessage),
                () => {
                    /** */
                    serverTransport.bytesRead.should.equal(helloMessage.length);
                    serverTransport.bytesWritten.should.be.greaterThan(0);
                },
                () => {
                    ///       spyOnConnect.callCount.should.eql(1);
                },
                () => transportPair.client.write(openChannelRequest),
                () => {
                    utils.compare_buffers(lastReceivedChunk, openChannelRequest);
                    // it should provide bytesRead and bytesWritten
                    serverTransport.bytesRead.should.be.greaterThan(0);
                    serverTransport.bytesWritten.should.be.greaterThan(20);
                },
                () => transportPair.client.end()
            ];
            await doAllSteps(steps);
        });

        it("TSS-8 should handle HEL message broken in two chunks (bug#36)", async () => {
            perform_sever_receiving_a_HEL_MESSAGE_followed_by_OpenChannelRequest_scenario();

            const helloMessage_part1 = helloMessage.subarray(0, 10);
            const helloMessage_part2 = helloMessage.subarray(10);
            const steps = [
                () => transportPair.client.write(helloMessage_part1),
                () => transportPair.client.write(helloMessage_part2),
                () => transportPair.client.write(openChannelRequest),
                () => transportPair.client.end()
            ];
            await doAllSteps(steps);
        });

        it("TSS-9 should handle broken HEL message in three chunks (bug#36)", async () => {
            perform_sever_receiving_a_HEL_MESSAGE_followed_by_OpenChannelRequest_scenario();

            const helloMessage_part1 = helloMessage.subarray(0, 10);
            const helloMessage_part2 = helloMessage.subarray(10, 25);
            const helloMessage_part3 = helloMessage.subarray(25);

            const steps = [
                () => transportPair.client.write(helloMessage_part1),
                () => transportPair.client.write(helloMessage_part2),
                () => transportPair.client.write(helloMessage_part3),
                () => transportPair.client.write(openChannelRequest),
                () => transportPair.client.end()
            ];
            await doAllSteps(steps);
        });

        it("TSS-A should handle broken HEL message in many small chunks (bug#36)", async () => {
            perform_sever_receiving_a_HEL_MESSAGE_followed_by_OpenChannelRequest_scenario();

            const steps = [
                () => {
                    for (let i = 0; i < helloMessage.length; i++) {
                        const single_byte_chunk = helloMessage.subarray(i, i + 1);
                        transportPair.client.write(single_byte_chunk);
                    }
                },
                () => {
                    transportPair.client.write(openChannelRequest);
                },
                () => transportPair.client.end()
            ];
            await doAllSteps(steps);
        });

        it("TSS-B  (issue#504)  server transport accept bufferSize greater than 8192 byes", (done) => {
            serverTransport.init(transportPair.server, (err) => {
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

            transportPair.client.on("data", (data) => {
                const stream = new BinaryStream(data);
                const messageHeader = readMessageHeader(stream);
                messageHeader.msgType.should.not.equal("ERR");
                stream.rewind();
                const response = decodeMessage(stream, AcknowledgeMessage);
                response.constructor.name.should.equal("AcknowledgeMessage");

                transportPair.client.end();
                done();
            });

            transportPair.client.write(packTcpMessage("HEL", helloMessage));
        });

        it("TSS-C  (issue#504) server transport should not accept bufferSize lower than 8192 byes", (done) => {
            serverTransport.init(transportPair.server, (err) => {
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

            transportPair.client.on("data", (data) => {
                const stream = new BinaryStream(data);
                const messageHeader = readMessageHeader(stream);
                messageHeader.msgType.should.equal("ERR");
                stream.rewind();
                const response = decodeMessage(stream, AcknowledgeMessage);
                response.constructor.name.should.equal("TCPErrorMessage");
                response.statusCode.name.should.eql("BadConnectionRejected");
                done();
            });

            transportPair.client.write(packTcpMessage("HEL", helloMessage));
        });

        it("TSS-D Test CLO message at transport end ", async () => {
            serverTransport.init(transportPair.server, (err) => {
                /** */
            });

            serverTransport.on("chunk", (messageChunk) => {
                // console.log("message ", messageChunk);
            });

            const b = Buffer.from("434c4f46180000000c000000010000000f0000000f000000", "hex");
            // xx console.log(debug.hexDump(b, 80));
            // xx console.log(debug.hexDump(packets.packect_outtec, 80));

            transportPair.client.on("data", (data) => {
                const stream = new BinaryStream(data);
                const messageHeader = readMessageHeader(stream);
                //  console.log(messageHeader);
                stream.rewind();
                const response = decodeMessage(stream, AcknowledgeMessage);
                //  console.log("response = ", response);
            });

            const steps = [
                () => transportPair.client.write(helloMessage),
                () => transportPair.client.write(packets.packect_outtec),
                () => transportPair.client.end()
            ];
            await doAllSteps(steps);
        });

        it("TSS-E should timeout if client is not sending a message in a timely manner", async () => {
            const timeout = 400;
            serverTransport.timeout = timeout;

            serverTransport.init(transportPair.server, (err) => {
                /** */

                transportPair.client.setTimeout(0);
            });

            serverTransport.on("chunk", (messageChunk) => {
                console.log("server received chunk", messageChunk.toString("hex"));
                serverTransport.write(messageChunk);
            });

            transportPair.client.on("data", (data) => {
                console.log("client received chunk", data.toString("hex"));
            });

            transportPair.client.on("error", (err) => {
                console.log("client error", err);
            });
            transportPair.client.on("close", (hadError) => {
                console.log("client close", hadError);
            });
            const steps = [
                () => transportPair.client.write(helloMessage),
                () => transportPair.client.write(packets.packect_outtec),
                async () => await new Promise((resolve) => setTimeout(resolve, timeout * 5)),
                () => {
                    transportPair.client.write(packets.packect_outtec);
                },
                () => {
                    transportPair.client.end();
                }
            ];

            const spyOnClientSocketTimeout = sinon.spy();
            transportPair.client.on("timeout", spyOnClientSocketTimeout);

            await doAllSteps(steps);
            // transportPair.client.closed.should.eql(true);
            // transportPair.server.closed.should.eql(true);
            spyOnClientSocketTimeout.callCount.should.eql(0);
        });
    });
}

installTestFor(TransportPairDirect);
installTestFor(TransportPairSocket);
