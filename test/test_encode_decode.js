var should = require("should");
var ec = require("../lib/encode_decode");
var opcua = require("../lib/nodeopcua");


describe("testing built-in type encoding",function() {


    it("should encode a boolean as a single byte",function(){

        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        ec.encodeBoolean(true,binaryStream);
        binaryStream.length.should.equal(1);

        binaryStream.rewind();
        var boolValue =ec.decodeBoolean(binaryStream);
        boolValue.should.equal(true);


    });

    it("should encode a Integer as a 4 byte stream",function(){

        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        ec.encodeInt32(1000000000,binaryStream);
        binaryStream.length.should.equal(4);

        // should be little endian
        //xx console.log(binaryStream.stream.slice(0,4));//toJSON());
        binaryStream.stream.readUInt8(0).should.equal(0x00);
        binaryStream.stream.readUInt8(1).should.equal(0xCA);
        binaryStream.stream.readUInt8(2).should.equal(0x9A);
        binaryStream.stream.readUInt8(3).should.equal(0x3B);

        binaryStream.rewind();
        var check_value =ec.decodeInt32(binaryStream);
        check_value.should.equal(1000000000);
    });

    it("should encode a Floating Point as a 4 byte stream",function(){
        // I EEE-754
        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        var value = -6.5;
        ec.encodeFloat(value,binaryStream);

        binaryStream.length.should.equal(4);
        // should be little endian
        binaryStream.stream.readUInt8(0).should.equal(0x00);
        binaryStream.stream.readUInt8(1).should.equal(0x00);
        binaryStream.stream.readUInt8(2).should.equal(0xD0);
        binaryStream.stream.readUInt8(3).should.equal(0xC0);

        binaryStream.rewind();
        var check_value =ec.decodeFloat(binaryStream);
        check_value.should.equal(value);
    });

    it("should encode a Double Point as a 8 byte stream",function(){
        // I EEE-754
        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        var value = -6.5;
        ec.encodeDouble(value,binaryStream);

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

        binaryStream.rewind();
        var check_value =ec.decodeDouble(binaryStream);
        check_value.should.equal(value);
    });

    it("should encode a null string" ,function() {

        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        var value = undefined;
        ec.encodeUAString(value,binaryStream);

        binaryStream.length.should.equal(4);

        binaryStream.stream.readUInt8(0).should.equal(0xff);
        binaryStream.stream.readUInt8(1).should.equal(0xff);
        binaryStream.stream.readUInt8(2).should.equal(0xff);
        binaryStream.stream.readUInt8(3).should.equal(0xff);

        binaryStream.rewind();
        var check_value =ec.decodeUAString(binaryStream);
        should.not.exists(check_value);

    });

    it("should encode a normal string" ,function() {

        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        var value ="Hello";
        ec.encodeUAString(value,binaryStream);

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

        binaryStream.rewind();
        var check_value =ec.decodeUAString(binaryStream);
        check_value.should.equal(value);

    });

    it("should encode a DateTime" ,function() {

        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        var value = new Date();
        ec.encodeDateTime(value,binaryStream);

        binaryStream.length.should.equal(8);

        binaryStream.rewind();
        var checked_value = ec.decodeDateTime(binaryStream);
        checked_value.should.eql(value);

    });

    it("should encode a GUID" ,function() {

        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        var value = "72962B91-FA75-4AE6-8D28-B404DC7DAF63";
        ec.encodeGUID(value,binaryStream);

        binaryStream.length.should.equal(16);


        binaryStream.rewind();
        // should be little endian
        binaryStream.readUInt8().should.equal(0x91);
        binaryStream.readUInt8().should.equal(0x2B);
        binaryStream.readUInt8().should.equal(0x96);
        binaryStream.readUInt8().should.equal(0x72);

        binaryStream.readUInt8().should.equal(0x75);
        binaryStream.readUInt8().should.equal(0xFA);

        binaryStream.readUInt8().should.equal(0xE6);
        binaryStream.readUInt8().should.equal(0x4A);

        binaryStream.readUInt8().should.equal(0x8D);
        binaryStream.readUInt8().should.equal(0x28);

        binaryStream.readUInt8().should.equal(0xB4);
        binaryStream.readUInt8().should.equal(0x04);
        binaryStream.readUInt8().should.equal(0xDC);
        binaryStream.readUInt8().should.equal(0x7D);
        binaryStream.readUInt8().should.equal(0xAF);
        binaryStream.readUInt8().should.equal(0x63);

        binaryStream.rewind();
        var checked_value = ec.decodeGUID(binaryStream);
        checked_value.should.eql(value);


    });


    it("should encode and decode a ByteString" ,function() {

        var buf = new Buffer(256);
        buf.write("THIS IS MY BUFFER");

        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        ec.encodeByteString(buf,binaryStream);
        binaryStream.length.should.equal(256+4);

        binaryStream.rewind();
        var check_buf = ec.decodeByteString(binaryStream);
        check_buf.length.should.equal(buf.length);



    });

    it("should encode a two byte NodeId" ,function() {
        // standard binary encoding
        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        var value = ec.makeNodeId(25);
        ec.encodeNodeId(value,binaryStream);

        binaryStream.length.should.equal(2);
        binaryStream.stream.readUInt8(0).should.equal(0);
        binaryStream.stream.readUInt8(1).should.equal(25);

    });
    it("should encode a four byte NodeId" ,function() {
        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        var value = ec.makeNodeId(258);
        ec.encodeNodeId(value,binaryStream);

        binaryStream.length.should.equal(4);
        binaryStream.stream.readUInt8(0).should.equal(1);
        binaryStream.stream.readUInt8(1).should.equal(0); // namespace
        binaryStream.stream.readUInt16LE(2).should.equal(258);

    });
    it("should encode a Numeric NodeId" ,function() {
    });
    it("should encode a long NodeId" ,function() {


        // standard binary encoding
        var binaryStream = new opcua.BinaryStream();
        binaryStream.length.should.equal(0);

        var value = new ec.makeNodeId("SomeStuff",2500);
        ec.encodeNodeId(value,binaryStream);

        binaryStream.stream.readUInt8(0).should.equal(3);


    });
    it("should encode a Guid NodeId" ,function() {
    });
    it("should encode a Opaque NodeId" ,function() {
    });
    it("should encode a Expanded NodeId" ,function() {
    });


});
