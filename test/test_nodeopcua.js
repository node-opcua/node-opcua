
opcua = require("../lib/nodeopcua");
var should = require("should");


describe("testing message encoding and decoding",function(){

    it("should encode and decode HelloMessage ",function(){

        var helloMessage1 = new opcua.HelloMessage();
        //xx console.log(Object.getPrototypeOf(helloMessage1),opcua.HelloMessage);

        var stream = new opcua.BinaryStream(2000);

        opcua.encodeMessage('HEL',helloMessage1,stream);

        //xx console.log(helloMessage1);

        stream.rewind();

        var helloMessage2 = opcua.decodeMessage(stream,opcua.HelloMessage);
        //xx console.log(helloMessage2);

        helloMessage1.should.eql(helloMessage2);
        helloMessage1.protocolVersion.should.eql(helloMessage2.protocolVersion);
        helloMessage1.receiveBufferSize.should.eql(helloMessage2.receiveBufferSize);
        helloMessage1.sendBufferSize.should.eql(helloMessage2.sendBufferSize);
        helloMessage1.maxMessageSize.should.eql(helloMessage2.maxMessageSize);
        helloMessage1.endpointUrl.should.eql(helloMessage2.endpointUrl);

    });
});
