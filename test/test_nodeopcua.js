
opcua = require("../lib/nodeopcua");
var should = require("should");


describe("testing message encoding and decoding",function(){

    it("should encode and decode HelloMessage ",function(){

        var helloMessage1 = new opcua.HelloMessage();
        //xx console.log(Object.getPrototypeOf(helloMessage1),opcua.HelloMessage);


        var message = opcua.packTcpMessage('HEL',helloMessage1);


        var stream = new opcua.BinaryStream(message);

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

describe("testing parseEndpointUrl",function(){
    it(" should parse a endpoint ",function(){

        var ep = opcua.parseEndpointUrl("opc.tcp://abcd1234:51210/UA/SampleServer");

        ep.protocol.should.equal("opc.tcp");
        ep.hostname.should.equal("abcd1234");
        ep.port.should.equal(51210);
        ep.address.should.equal("/UA/SampleServer");
    });
    it(" should parse this endpoint as well",function(){

        var ep = opcua.parseEndpointUrl("opc.tcp://ABCD12354:51210/UA/SampleServer");

        ep.protocol.should.equal("opc.tcp");
        ep.hostname.should.equal("ABCD12354");
        ep.port.should.equal(51210);
        ep.address.should.equal("/UA/SampleServer");
    });

});
