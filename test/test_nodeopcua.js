
opcua = require("../lib/nodeopcua");
var should = require("should");


describe("testing built-in type encoding",function() {


    it("should encode a boolean as a single byte",function(){

        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        var boolValue = new opcua.Boolean(true);
        boolValue.encode(binaryStream);

        binaryStream.length.should.equal(1);

    });
    it("should encode a Integer as a 4 byte stream",function(){

        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        var value = new opcua.Integer(1000000000);
        value.encode(binaryStream);

        binaryStream.length.should.equal(4);
        // should be little endian
        //xx console.log(binaryStream.stream.slice(0,4));//toJSON());
        binaryStream.stream.readUInt8(0).should.equal(0x00);
        binaryStream.stream.readUInt8(1).should.equal(0xCA);
        binaryStream.stream.readUInt8(2).should.equal(0x9A);
        binaryStream.stream.readUInt8(3).should.equal(0x3B);

    });
    it("should encode a Floating Point as a 4 byte stream",function(){
        // I EEE-754
        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        var value = new opcua.Float(-6.5);
        value.encode(binaryStream);

        binaryStream.length.should.equal(4);
        // should be little endian
        //xx console.log(binaryStream.stream.slice(0,4));//toJSON());
        binaryStream.stream.readUInt8(0).should.equal(0x00);
        binaryStream.stream.readUInt8(1).should.equal(0x00);
        binaryStream.stream.readUInt8(2).should.equal(0xD0);
        binaryStream.stream.readUInt8(3).should.equal(0xC0);

    });
    it("should encode a Double Point as a 8 byte stream",function(){
        // I EEE-754
        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        var value = new opcua.Double(-6.5);
        value.encode(binaryStream);

        binaryStream.length.should.equal(8);
        // should be little endian
        //xx console.log(binaryStream.stream.slice(0,8));//toJSON());
        binaryStream.stream.readUInt8(0).should.equal(0x00);
        binaryStream.stream.readUInt8(1).should.equal(0x00);
        binaryStream.stream.readUInt8(2).should.equal(0x00);
        binaryStream.stream.readUInt8(3).should.equal(0x00);
        binaryStream.stream.readUInt8(4).should.equal(0x00);
        binaryStream.stream.readUInt8(5).should.equal(0x00);
        binaryStream.stream.readUInt8(6).should.equal(0x1a);
        binaryStream.stream.readUInt8(7).should.equal(0xc0);

    });

    it("should encode a null string" ,function() {

        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        var value = new opcua.UAString();
        value.encode(binaryStream);

        binaryStream.length.should.equal(4);
        // should be little endian
        binaryStream.stream.readUInt8(0).should.equal(0xff);
        binaryStream.stream.readUInt8(1).should.equal(0xff);
        binaryStream.stream.readUInt8(2).should.equal(0xff);
        binaryStream.stream.readUInt8(3).should.equal(0xff);

    });
    it("should encode a normal string" ,function() {

        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        var value = new opcua.UAString("Hello");
        value.encode(binaryStream);

        binaryStream.length.should.equal(4 + 5);
        // should be little endian
        binaryStream.stream.readUInt8(0).should.equal(0x05);
        binaryStream.stream.readUInt8(1).should.equal(0x00);
        binaryStream.stream.readUInt8(2).should.equal(0x00);
        binaryStream.stream.readUInt8(3).should.equal(0x00);
        binaryStream.stream.readUInt8(4).should.equal('H'.charCodeAt(0));
        binaryStream.stream.readUInt8(5).should.equal('e'.charCodeAt(0));
        binaryStream.stream.readUInt8(6).should.equal('l'.charCodeAt(0));
        binaryStream.stream.readUInt8(7).should.equal('l'.charCodeAt(0));
        binaryStream.stream.readUInt8(8).should.equal('o'.charCodeAt(0));

    });
    it("should encode a DateTime" ,function() {

        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        var value = new opcua.DateTime(Date.now());
        value.encode(binaryStream);

        binaryStream.length.should.equal(8);
        // should be little endian

    });
    it("should encode a GUID" ,function() {

        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        var value = new opcua.GUID("72962B91-FA75-4AE6-8D28-B404DC7DAF63");
        value.encode(binaryStream);

        binaryStream.length.should.equal(16);
        // should be little endian
        binaryStream.stream.readUInt8(0).should.equal(0x91);
        binaryStream.stream.readUInt8(1).should.equal(0x2B);
        binaryStream.stream.readUInt8(2).should.equal(0x96);
        binaryStream.stream.readUInt8(3).should.equal(0x72);

        binaryStream.stream.readUInt8(4).should.equal(0x75);
        binaryStream.stream.readUInt8(5).should.equal(0xFA);

        binaryStream.stream.readUInt8(6).should.equal(0xE6);
        binaryStream.stream.readUInt8(7).should.equal(0x4A);

        binaryStream.stream.readUInt8(8).should.equal(0x8D);
        binaryStream.stream.readUInt8(9).should.equal(0x28);

        binaryStream.stream.readUInt8(10).should.equal(0xB4);
        binaryStream.stream.readUInt8(11).should.equal(0x04);
        binaryStream.stream.readUInt8(12).should.equal(0xDC);
        binaryStream.stream.readUInt8(13).should.equal(0x7D);
        binaryStream.stream.readUInt8(14).should.equal(0xAF);
        binaryStream.stream.readUInt8(15).should.equal(0x63);

    });
    it("should encode a two byte NodeId" ,function() {
        // standard binary encoding
        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        var value = new opcua.NodeId(25);
        value.encode(binaryStream);

        binaryStream.length.should.equal(2);
        binaryStream.stream.readUInt8(0).should.equal(0);
        binaryStream.stream.readUInt8(1).should.equal(25);

    });
    it("should encode a four byte NodeId" ,function() {
        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        var value = new opcua.NodeId(258);
        value.encode(binaryStream);

        binaryStream.length.should.equal(4);
        binaryStream.stream.readUInt8(0).should.equal(1);
        binaryStream.stream.readUInt8(1).should.equal(0); // namespace
        binaryStream.stream.readUInt16LE(2).should.equal(258);

    });
    it("should encode a Numeric NodeId" ,function() {
    });
    it("should encode a String NodeId" ,function() {


        // standard binary encoding
        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        var value = new opcua.NodeId("SomeName");
        value.encode(binaryStream);
        binaryStream.stream.readUInt8(0).should.equal(3);


    });
    it("should encode a Guid NodeId" ,function() {
    });
    it("should encode a Opaque NodeId" ,function() {
    });
    it("should encode a Expanded NodeId" ,function() {
    });


});


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
