var should = require("should");
var ec = require("../../lib/misc/encode_decode");
var opcua = require("../../lib/nodeopcua");
var BinaryStream = require("../../lib/misc/binaryStream").BinaryStream;
var ExpandedNodeId = require("./../../lib/datamodel/expanded_nodeid").ExpandedNodeId;
var NodeIdType = require("./../../lib/datamodel/nodeid").NodeIdType;

function test_encode_decode(obj, encode_func, decode_func, expectedLength, verify_buffer_func) {

    var binaryStream = new BinaryStream();
    binaryStream.length.should.equal(0);

    encode_func(obj, binaryStream);
    binaryStream.length.should.equal(expectedLength);

    if (verify_buffer_func) {
        verify_buffer_func(binaryStream._buffer);
    }
    binaryStream.rewind();

    var obj_verif = decode_func(binaryStream);
    binaryStream.length.should.equal(expectedLength);

    if (obj !== undefined) {
        obj_verif.should.eql(obj);

    } else {
        should.not.exists(obj_verif);
    }
}

describe("testing built-in type encoding", function () {


    it("should encode and decode a boolean as a single byte", function () {

        test_encode_decode(true, ec.encodeBoolean, ec.decodeBoolean, 1);
        test_encode_decode(false, ec.encodeBoolean, ec.decodeBoolean, 1);

    });


    it("should encode and decode a Int16 (2 bytes)", function () {

        test_encode_decode(255, ec.encodeInt16, ec.decodeInt16, 2, function (buffer) {
            // should be little endian
            buffer.readUInt8(0).should.equal(0xFF);
            buffer.readUInt8(1).should.equal(0x00);
        });
        test_encode_decode(-32000, ec.encodeInt16, ec.decodeInt16, 2);

    });

    it("should encode and decode a Int16 (2 bytes)", function () {

        test_encode_decode(0xFFFE, ec.encodeUInt16, ec.decodeUInt16, 2, function (buffer) {
            // should be little endian
            buffer.readUInt8(0).should.equal(0xFE);
            buffer.readUInt8(1).should.equal(0xFF);
        });

    });

    it("should encode and decode a Integer (4 bytes)", function () {


        test_encode_decode(1000000000, ec.encodeInt32, ec.decodeInt32, 4, function (buffer) {
            // should be little endian
            buffer.readUInt8(0).should.equal(0x00);
            buffer.readUInt8(1).should.equal(0xCA);
            buffer.readUInt8(2).should.equal(0x9A);
            buffer.readUInt8(3).should.equal(0x3B);
        });
        test_encode_decode(-100000000, ec.encodeInt32, ec.decodeInt32, 4);

    });

    it("should encode and decode a Floating Point (4 bytes)", function () {

        var value = -6.5;
        // I EEE-754
        test_encode_decode(value, ec.encodeFloat, ec.decodeFloat, 4, function (buffer) {
            // should be little endian
            buffer.readUInt8(0).should.equal(0x00);
            buffer.readUInt8(1).should.equal(0x00);
            buffer.readUInt8(2).should.equal(0xD0);
            buffer.readUInt8(3).should.equal(0xC0);
        });

    });

    it("should encode and decode a Double Point (8 bytes)", function () {
        // I EEE-754

        var value = -6.5;
        // I EEE-754
        test_encode_decode(value, ec.encodeDouble, ec.decodeDouble, 8, function (buffer) {
            // should be little endian
            buffer.readUInt8(0).should.equal(0x00);
            buffer.readUInt8(1).should.equal(0x00);
            buffer.readUInt8(2).should.equal(0x00);
            buffer.readUInt8(3).should.equal(0x00);
            buffer.readUInt8(4).should.equal(0x00);
            buffer.readUInt8(5).should.equal(0x00);
            buffer.readUInt8(6).should.equal(0x1a);
            buffer.readUInt8(7).should.equal(0xc0);
        });

    });

    it("should encode and decode a null string", function () {

        var value = undefined;


        test_encode_decode(value, ec.encodeString, ec.decodeString, 4, function (buffer) {
            // should be little endian
            buffer.readUInt8(0).should.equal(0xff);
            buffer.readUInt8(1).should.equal(0xff);
            buffer.readUInt8(2).should.equal(0xff);
            buffer.readUInt8(3).should.equal(0xff);
        });

    });

    it("should encode and decode a normal string", function () {

        var value = "Hello";

        test_encode_decode(value, ec.encodeString, ec.decodeString, 9, function (buffer) {
            // should be little endian
            buffer.readUInt8(0).should.equal(0x05);
            buffer.readUInt8(1).should.equal(0x00);
            buffer.readUInt8(2).should.equal(0x00);
            buffer.readUInt8(3).should.equal(0x00);
            buffer.readUInt8(4).should.equal('H'.charCodeAt(0));
            buffer.readUInt8(5).should.equal('e'.charCodeAt(0));
            buffer.readUInt8(6).should.equal('l'.charCodeAt(0));
            buffer.readUInt8(7).should.equal('l'.charCodeAt(0));
            buffer.readUInt8(8).should.equal('o'.charCodeAt(0));
        });

    });

    it("should encode and decode a DateTime", function () {

        var value = new Date(2014, 0, 2, 15, 0);
        test_encode_decode(value, ec.encodeDateTime, ec.decodeDateTime, 8, function (buffer) {
            // todo
        });

    });

    it("should encode and decode a GUID", function () {

        var value = ec.emptyGuid;

        test_encode_decode(value, ec.encodeGuid, ec.decodeGuid, 16, function (buffer) {
            buffer.readUInt8(0).should.equal(0x00);
            buffer.readUInt8(1).should.equal(0x00);
            buffer.readUInt8(2).should.equal(0x00);
            buffer.readUInt8(3).should.equal(0x00);

            buffer.readUInt8(4).should.equal(0x00);
            buffer.readUInt8(5).should.equal(0x00);

            buffer.readUInt8(6).should.equal(0x00);
            buffer.readUInt8(7).should.equal(0x00);

            buffer.readUInt8(8).should.equal(0x00);
            buffer.readUInt8(9).should.equal(0x00);

            buffer.readUInt8(10).should.equal(0x00);
            buffer.readUInt8(11).should.equal(0x00);
            buffer.readUInt8(12).should.equal(0x00);
            buffer.readUInt8(13).should.equal(0x00);
            buffer.readUInt8(14).should.equal(0x00);
            buffer.readUInt8(15).should.equal(0x00);
        });
    });

    it("should encode and decode a GUID", function () {

        var value = "72962B91-FA75-4AE6-8D28-B404DC7DAF63";

        test_encode_decode(value, ec.encodeGuid, ec.decodeGuid, 16, function (buffer) {
            buffer.readUInt8(0).should.equal(0x91);
            buffer.readUInt8(1).should.equal(0x2B);
            buffer.readUInt8(2).should.equal(0x96);
            buffer.readUInt8(3).should.equal(0x72);

            buffer.readUInt8(4).should.equal(0x75);
            buffer.readUInt8(5).should.equal(0xFA);

            buffer.readUInt8(6).should.equal(0xE6);
            buffer.readUInt8(7).should.equal(0x4A);

            buffer.readUInt8(8).should.equal(0x8D);
            buffer.readUInt8(9).should.equal(0x28);

            buffer.readUInt8(10).should.equal(0xB4);
            buffer.readUInt8(11).should.equal(0x04);
            buffer.readUInt8(12).should.equal(0xDC);
            buffer.readUInt8(13).should.equal(0x7D);
            buffer.readUInt8(14).should.equal(0xAF);
            buffer.readUInt8(15).should.equal(0x63);
        });
    });

    it("should encode and decode a ByteString", function () {

        var buf = new Buffer(256);
        buf.write("THIS IS MY BUFFER");

        test_encode_decode(buf, ec.encodeByteString, ec.decodeByteString, 256 + 4, function (buffer) {

            buffer.readUInt32LE(0).should.equal(256);
        });
        //xx check_buf.toString('hex').should.equal(buf.toString('hex'));


    });

    it("should encode and decode a two byte NodeId", function () {

        var nodeId = ec.makeNodeId(25);
        nodeId.identifierType.should.eql(ec.NodeIdType.NUMERIC);

        test_encode_decode(
            nodeId,
            ec.encodeNodeId,
            ec.decodeNodeId,
            2,
            function verify_buffer(buffer) {
                buffer.readUInt8(0).should.equal(0);
                buffer.readUInt8(1).should.equal(25); // namespace
            }
        );

    });


    it("should encode and decode a four byte NodeId", function () {

        var nodeId = ec.makeNodeId(258);
        nodeId.identifierType.should.eql(ec.NodeIdType.NUMERIC);
        test_encode_decode(
            nodeId,
            ec.encodeNodeId,
            ec.decodeNodeId,
            4,
            function verify_buffer(buffer) {
                buffer.readUInt8(0).should.equal(1);
                buffer.readUInt8(1).should.equal(0); // namespace
                buffer.readUInt16LE(2).should.equal(258);
            }
        );
    });

    it("should encode and decode a Numeric NodeId", function () {

        var nodeId = ec.makeNodeId(545889, 2500);
        nodeId.identifierType.should.eql(ec.NodeIdType.NUMERIC);
        test_encode_decode(
            nodeId,
            ec.encodeNodeId,
            ec.decodeNodeId,
            7
        );
    });
    it("should encode and decode a byte NodeId (bug reported by Mika)", function () {

        var nodeId = ec.makeNodeId(129, 129);
        test_encode_decode(
            nodeId,
            ec.encodeNodeId,
            ec.decodeNodeId,
            4 // nb bytes
        );
    });

    it("should encode and decode any small numeric NodeId", function () {

        for (var i = 0; i <= 255; i++) {
            var nodeId = ec.makeNodeId(/*value*/i, /*namespace*/ 2);
            test_encode_decode(
                nodeId,
                ec.encodeNodeId,
                ec.decodeNodeId,
                4
            );

        }
    });


    it("should encode and decode a String NodeId", function () {

        var nodeId = ec.makeNodeId("SomeStuff", 2500);
        nodeId.identifierType.should.eql(ec.NodeIdType.STRING);

        test_encode_decode(
            nodeId,
            ec.encodeNodeId,
            ec.decodeNodeId,
                4 + 9 + 2 + 1
        );

    });

    it("should encode and decode a Guid NodeId", function () {

        var nodeId = ec.makeNodeId("72962B91-FA75-4AE6-8D28-B404DC7DAF63", 2500);
        nodeId.identifierType.should.eql(ec.NodeIdType.GUID);
        test_encode_decode(
            nodeId,
            ec.encodeNodeId,
            ec.decodeNodeId,
                16 + 2 + 1
        );


    });

    it("should encode and decode a Opaque NodeId", function () {

        var value = Buffer(32);
        for (var i = 0; i < 32; i++) {
            value.writeUInt8(i, i);
        }
        var nodeId = ec.makeNodeId(value, 0x1BCD);
        nodeId.identifierType.should.equal(ec.NodeIdType.BYTESTRING);
        var expectedLength = 1 + 2 + 4 + 32;
        test_encode_decode(nodeId, ec.encodeNodeId, ec.decodeNodeId, expectedLength, function (buffer) {
            // cod
            buffer.readUInt8(0).should.equal(0x05);
            // namespace
            buffer.readUInt8(1).should.equal(0xCD);
            buffer.readUInt8(2).should.equal(0x1B);
            // size
            buffer.readUInt32LE(3).should.equal(32);

            buffer.readUInt8(7).should.equal(0x00);
            buffer.readUInt8(8).should.equal(0x01);
            buffer.readUInt8(9).should.equal(0x02);
            buffer.readUInt8(10).should.equal(0x03);
            buffer.readUInt8(11).should.equal(0x04);
            buffer.readUInt8(12).should.equal(0x05);
            // ...
            buffer.readUInt8(38).should.equal(31);
        });
    });

    it("should encode and decode a BYTESTRING NodeId", function () {
        var NodeId = require("./../../lib/datamodel/nodeid").NodeId;
        var NodeIdType = require("./../../lib/datamodel/nodeid").NodeIdType;
        var crypto = require("crypto");

        var nodeId = new NodeId(NodeIdType.BYTESTRING, crypto.randomBytes(16));

        var expectedLength = 1 + 2 + 4 + 16;
        test_encode_decode(nodeId, ec.encodeNodeId, ec.decodeNodeId, expectedLength, function (buffer) {
        });

    });

    it("should encode and decode a Expanded NodeId  - TwoBytes", function () {

        test_encode_decode(
            ec.makeExpandedNodeId(10),
            ec.encodeExpandedNodeId,
            ec.decodeExpandedNodeId,
            2
        );
    });

    it("should encode and decode a Expanded NodeId  - FourBytes", function () {

        test_encode_decode(
            ec.makeExpandedNodeId(32000),
            ec.encodeExpandedNodeId,
            ec.decodeExpandedNodeId,
            4
        );
    });

    it("should encode and decode a Expanded NodeId with namespaceUri", function () {

        var serverIndex = 2;
        var namespaceUri = "some:namespace:uri";
        var expandedNodeId = new ExpandedNodeId(NodeIdType.NUMERIC, 4123, 4, namespaceUri, serverIndex);
        test_encode_decode(
            expandedNodeId,
            ec.encodeExpandedNodeId,
            ec.decodeExpandedNodeId,
            33
        );
    });

});


describe("encoding and decoding arrays", function () {


    it("should encode and decode an array of integer",function(){

        function encode_array_float(arr,stream) {
            ec.encodeArray(arr,stream,ec.encodeFloat);
        }
        function decode_array_float(stream) {
            return ec.decodeArray(stream,ec.decodeFloat);
        }
        test_encode_decode([10,20,30,40],encode_array_float,decode_array_float, 4*3 + 8);
    });

    it("should encode and decode an array of strings",function(){

        function encode_array_string(arr,stream) {
            ec.encodeArray(arr,stream,ec.encodeString);
        }
        function decode_array_string(stream) {
            return ec.decodeArray(stream,ec.decodeString);
        }
        test_encode_decode(["Hoo","Hello","World","Lorem Ipsum"],encode_array_string,decode_array_string, 44);
    });

});


describe("check isValid and random for various types", function () {

    it("should test isValid on UInt16", function () {

        ec.isValidUInt16(0).should.eql(true);
        ec.isValidUInt16(0xFFFFFF).should.eql(false);
    });

    var types = [
        "Byte",
        "SByte",
        "UInt8",
        "UInt16",
        "UInt32",
        "Int8",
        "Int16",
        "Int32",
        "String",
        "Boolean",
        "Double",
        "Float",
        "Guid",
        "DateTime",
        "NodeId",
        "ByteString",
        "Int64",
        "UInt64"
    ];

    types.forEach(function (type) {

        it("should have a random and isValid method for type " + type, function () {

            var randomFunc = ec["random" + type];
            var isValidFunc = ec["isValid" + type];

            ec.should.have.property("encode" + type);
            ec.should.have.property("decode" + type);
            ec.should.have.property("random" + type);
            ec.should.have.property("isValid" + type);

            var random_value = randomFunc();
            isValidFunc(random_value).should.eql(true);


        });

    });

});
describe("check coerce various types", function () {

//
//        "String",
//        "Boolean",
//        "Double",
//        "Float",
//        "Guid",
//        "DateTime",
//        "NodeId",
//        "ByteString",

    it("should have a coerce method for boolean",function() {

        ec.coerceBoolean("false").should.equal(false);
        ec.coerceBoolean("true").should.equal(true);

        ec.coerceBoolean(0).should.equal(false);
        ec.coerceBoolean(1).should.equal(true);

        ec.coerceBoolean(false).should.equal(false);
        ec.coerceBoolean(true).should.equal(true);

        ec.coerceBoolean("0").should.equal(false);
        ec.coerceBoolean("1").should.equal(true);

    });


    var types = [
        "Byte",
        "SByte",
        "UInt8",
        "UInt16",
        "UInt32",
        "Int8",
        "Int16",
        "Int32",
        "Float",
        "Double",
        "Int64",
        "UInt64"
    ];

    types.forEach(function (type) {

        it("should have a coerce method for " + type, function () {

            var coerceFunc = ec["coerce" + type];
            var randomFunc = ec["random" + type];
            var isValidFunc = ec["isValid" + type];

            ec.should.have.property("coerce" + type);
            ec.should.have.property("random" + type);
            ec.should.have.property("isValid" + type);

            var random_value = randomFunc();

            var value1 = coerceFunc(random_value);
            value1.should.eql(random_value);

            var value2 = coerceFunc(random_value.toString());
            value2.should.eql(random_value);

        });
    });

    function w(str,l) {
        return(str+ "                        ").substring(0,l);
    }
    types.forEach(function (type) {

        it("coerce" + w(type,8) + " should preserves null or undefined values ", function () {

            var coerceFunc = ec["coerce" + type];

            ec.should.have.property("coerce" + type);


            var value1 = coerceFunc(null);
            should(value1).be.equal(null);


            var value2 = coerceFunc();
            should(value2).be.equal(undefined);


        });
    });
});

