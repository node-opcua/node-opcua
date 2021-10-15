"use strict";
const { BinaryStream } = require("node-opcua-binary-stream");

const { HelloMessage, packTcpMessage, decodeMessage } = require("..");

describe("testing message encoding and decoding", function () {
    it("should encode and decode HelloMessage ", function () {
        const helloMessage1 = new HelloMessage({});

        const message = packTcpMessage("HEL", helloMessage1);
        const stream = new BinaryStream(message);

        const helloMessage2 = decodeMessage(stream, HelloMessage);
        //xx console.log(helloMessage2);

        helloMessage1.should.eql(helloMessage2);
        helloMessage1.protocolVersion.should.eql(helloMessage2.protocolVersion);
        helloMessage1.receiveBufferSize.should.eql(helloMessage2.receiveBufferSize);
        helloMessage1.sendBufferSize.should.eql(helloMessage2.sendBufferSize);
        helloMessage1.maxMessageSize.should.eql(helloMessage2.maxMessageSize);
        helloMessage1.endpointUrl.should.eql(helloMessage2.endpointUrl);
    });
});
