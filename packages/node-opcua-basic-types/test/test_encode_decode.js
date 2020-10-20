"use strict";
const should = require("should");

const { hexDump } = require("node-opcua-debug");
const { BinaryStream } = require("node-opcua-binary-stream");
const guid = require("node-opcua-guid");

const ec = require("..");
const {
    makeNodeId,
    NodeIdType,
    NodeId,
    makeExpandedNodeId,
    ExpandedNodeId
} = require("node-opcua-nodeid");
const crypto = require("crypto");
const { encodeNodeId, decodeNodeId, randomGuid } = require("..");


/**
 * @method test_encode_decode
 *
 * @param obj
 * @param encode_func {Function}
 * @param encode_func.obj {Object}
 * @param encode_func.binaryStream {BinaryStream}
 * @param decode_func {Function}
 * @param decode_func.binaryStream {BinaryStream}
 * @param expectedLength {Integer}
 * @param [verify_buffer_func=null] {Function}
 * @param verify_buffer_func.buffer {Buffer}
 */
function test_encode_decode(obj, encode_func, decode_func, expectedLength, verify_buffer_func) {
    const binaryStream = new BinaryStream();
    binaryStream.length.should.equal(0);

    encode_func(obj, binaryStream);
    binaryStream.length.should.equal(expectedLength);

    if (verify_buffer_func) {
        verify_buffer_func(binaryStream.buffer);
    }
    binaryStream.rewind();

    const obj_reloaded = decode_func(binaryStream);
    binaryStream.length.should.equal(expectedLength);

    if (obj !== undefined && obj !== null) {
        obj_reloaded.should.eql(obj);
    } else {
        should.not.exists(obj_reloaded);
    }
}

describe("testing built-in type encoding", () => {
    it("should encode and decode a boolean as a single byte", () => {
        test_encode_decode(true, ec.encodeBoolean, ec.decodeBoolean, 1);
        test_encode_decode(false, ec.encodeBoolean, ec.decodeBoolean, 1);
    });
    it("should encode and decode a Int8 (1 (signed) byte)", () => {
        test_encode_decode(27, ec.encodeInt8, ec.decodeInt8, 1, (buffer) => {
            buffer.should.be.instanceOf(Buffer);
            buffer.readInt8(0).should.equal(27);
        });
        test_encode_decode(-32, ec.encodeInt8, ec.decodeInt8, 1);
    });
    it("should encode and decode a UInt8 (1 byte)", () => {
        test_encode_decode(130, ec.encodeUInt8, ec.decodeUInt8, 1, (buffer) => {
            buffer.should.be.instanceOf(Buffer);
            buffer.readUInt8(0).should.equal(130);
        });
    });

    it("should encode and decode a Int16 (2 bytes)", () => {
        test_encode_decode(255, ec.encodeInt16, ec.decodeInt16, 2, (buffer) => {
            buffer.should.be.instanceOf(Buffer);
            // should be little endian
            buffer.readUInt8(0).should.equal(0xff);
            buffer.readUInt8(1).should.equal(0x00);
        });
        test_encode_decode(-32000, ec.encodeInt16, ec.decodeInt16, 2);
    });

    it("should encode and decode a Int16 (2 bytes)", () => {
        test_encode_decode(0xfffe, ec.encodeUInt16, ec.decodeUInt16, 2, (buffer) => {
            buffer.should.be.instanceOf(Buffer);
            // should be little endian
            buffer.readUInt8(0).should.equal(0xfe);
            buffer.readUInt8(1).should.equal(0xff);
        });
    });

    it("should encode and decode a Integer (4 bytes)", () => {
        test_encode_decode(1000000000, ec.encodeInt32, ec.decodeInt32, 4, (buffer) => {
            // should be little endian
            buffer.readUInt8(0).should.equal(0x00);
            buffer.readUInt8(1).should.equal(0xca);
            buffer.readUInt8(2).should.equal(0x9a);
            buffer.readUInt8(3).should.equal(0x3b);
        });
        test_encode_decode(-100000000, ec.encodeInt32, ec.decodeInt32, 4);
    });

    it("should encode and decode a Int64 (8 bytes)", () => {
        test_encode_decode([0, 1000000000], ec.encodeInt64, ec.decodeInt64, 8, (buffer) => {
            // should be little endian
            buffer.readUInt8(0).should.equal(0x00);
            buffer.readUInt8(1).should.equal(0xca);
            buffer.readUInt8(2).should.equal(0x9a);
            buffer.readUInt8(3).should.equal(0x3b);
            buffer.readUInt8(4).should.equal(0x00);
            buffer.readUInt8(5).should.equal(0x00);
            buffer.readUInt8(6).should.equal(0x00);
            buffer.readUInt8(7).should.equal(0x00);
        });
        test_encode_decode([0, 100000000], ec.encodeInt64, ec.decodeInt64, 8);

        const stream = new BinaryStream();
        ec.encodeInt64(1000, stream);
        ec.encodeUInt64(1000, stream);
    });

    it("should encode and decode a Floating Point (4 bytes)", () => {
        const value = -6.5;
        // I EEE-754
        test_encode_decode(value, ec.encodeFloat, ec.decodeFloat, 4, (buffer) => {
            // should be little endian
            buffer.readUInt8(0).should.equal(0x00);
            buffer.readUInt8(1).should.equal(0x00);
            buffer.readUInt8(2).should.equal(0xd0);
            buffer.readUInt8(3).should.equal(0xc0);
        });
    });

    it("should encode and decode a Double Point (8 bytes)", () => {
        // I EEE-754

        const value = -6.5;
        // I EEE-754
        test_encode_decode(value, ec.encodeDouble, ec.decodeDouble, 8, (buffer) => {
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

    it("should encode and decode a null string", () => {
        let value;

        test_encode_decode(value, ec.encodeString, ec.decodeString, 4, (buffer) => {
            // should be little endian
            buffer.readUInt8(0).should.equal(0xff);
            buffer.readUInt8(1).should.equal(0xff);
            buffer.readUInt8(2).should.equal(0xff);
            buffer.readUInt8(3).should.equal(0xff);
        });
    });

    it("should encode and decode a normal string", () => {
        const value = "Hello";

        test_encode_decode(value, ec.encodeString, ec.decodeString, 9, (buffer) => {
            // should be little endian
            buffer.readUInt8(0).should.equal(0x05);
            buffer.readUInt8(1).should.equal(0x00);
            buffer.readUInt8(2).should.equal(0x00);
            buffer.readUInt8(3).should.equal(0x00);
            buffer.readUInt8(4).should.equal("H".charCodeAt(0));
            buffer.readUInt8(5).should.equal("e".charCodeAt(0));
            buffer.readUInt8(6).should.equal("l".charCodeAt(0));
            buffer.readUInt8(7).should.equal("l".charCodeAt(0));
            buffer.readUInt8(8).should.equal("o".charCodeAt(0));
        });
    });
    it("should encode and decode a LocaleId", () => {
        const value = "Hello";
        test_encode_decode(value, ec.encodeLocaleId, ec.decodeLocaleId, 9, (buffer) => {
            // should be little endian
            buffer.readUInt8(0).should.equal(0x05);
            buffer.readUInt8(1).should.equal(0x00);
            buffer.readUInt8(2).should.equal(0x00);
            buffer.readUInt8(3).should.equal(0x00);
            buffer.readUInt8(4).should.equal("H".charCodeAt(0));
            buffer.readUInt8(5).should.equal("e".charCodeAt(0));
            buffer.readUInt8(6).should.equal("l".charCodeAt(0));
            buffer.readUInt8(7).should.equal("l".charCodeAt(0));
            buffer.readUInt8(8).should.equal("o".charCodeAt(0));
        });
    });


    it("should encode and decode a DateTime - origin", () => {
        const value = new Date(Date.UTC(1601, 0, 1, 0, 0, 0));
        test_encode_decode(value, ec.encodeDateTime, ec.decodeDateTime, 8, (buffer) => {
            // todo
        });
    });
    it("should encode and decode a DateTime", () => {
        const value = new Date(Date.UTC(2014, 0, 2, 15, 0));
        test_encode_decode(value, ec.encodeDateTime, ec.decodeDateTime, 8, (buffer) => {
            // todo
        });
    });

    it("should encode and decode a GUID", () => {
        const value = guid.emptyGuid;
        should.exist(value);

        test_encode_decode(value, ec.encodeGuid, ec.decodeGuid, 16, (buffer) => {
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

    it("should encode and decode a GUID", () => {
        const value = "72962B91-FA75-4AE6-8D28-B404DC7DAF63";

        test_encode_decode(value, ec.encodeGuid, ec.decodeGuid, 16, (buffer) => {
            buffer.readUInt8(0).should.equal(0x91);
            buffer.readUInt8(1).should.equal(0x2b);
            buffer.readUInt8(2).should.equal(0x96);
            buffer.readUInt8(3).should.equal(0x72);

            buffer.readUInt8(4).should.equal(0x75);
            buffer.readUInt8(5).should.equal(0xfa);

            buffer.readUInt8(6).should.equal(0xe6);
            buffer.readUInt8(7).should.equal(0x4a);

            buffer.readUInt8(8).should.equal(0x8d);
            buffer.readUInt8(9).should.equal(0x28);

            buffer.readUInt8(10).should.equal(0xb4);
            buffer.readUInt8(11).should.equal(0x04);
            buffer.readUInt8(12).should.equal(0xdc);
            buffer.readUInt8(13).should.equal(0x7d);
            buffer.readUInt8(14).should.equal(0xaf);
            buffer.readUInt8(15).should.equal(0x63);
        });
    });

    it("should encode and decode a ByteString", () => {
        const buf = Buffer.allocUnsafe(256);
        buf.write("THIS IS MY BUFFER");

        test_encode_decode(buf, ec.encodeByteString, ec.decodeByteString, 256 + 4, (buffer) => {
            buffer.readUInt32LE(0).should.equal(256);
        });
        //xx check_buf.toString('hex').should.equal(buf.toString('hex'));
    });

    it("should encode and decode a two byte NodeId", () => {
        const nodeId = makeNodeId(25);
        nodeId.identifierType.should.eql(NodeIdType.NUMERIC);

        test_encode_decode(nodeId, ec.encodeNodeId, ec.decodeNodeId, 2, function verify_buffer(buffer) {
            buffer.readUInt8(0).should.equal(0);
            buffer.readUInt8(1).should.equal(25); // namespace
        });
    });

    it("should encode and decode a four byte NodeId", () => {
        const nodeId = makeNodeId(258);
        nodeId.identifierType.should.eql(NodeIdType.NUMERIC);
        test_encode_decode(nodeId, ec.encodeNodeId, ec.decodeNodeId, 4, function verify_buffer(buffer) {
            buffer.readUInt8(0).should.equal(1);
            buffer.readUInt8(1).should.equal(0); // namespace
            buffer.readUInt16LE(2).should.equal(258);
        });
    });

    it("should encode and decode a Numeric NodeId", () => {
        const nodeId = makeNodeId(545889, 2500);
        nodeId.identifierType.should.eql(NodeIdType.NUMERIC);
        test_encode_decode(nodeId, ec.encodeNodeId, ec.decodeNodeId, 7);
    });
    it("should encode and decode a byte NodeId (bug reported by Mika)", () => {
        const nodeId = makeNodeId(129, 129);
        test_encode_decode(
            nodeId,
            ec.encodeNodeId,
            ec.decodeNodeId,
            4 // nb bytes
        );
    });

    it("should encode and decode any small numeric NodeId", () => {
        for (let i = 0; i <= 255; i++) {
            const nodeId = makeNodeId(/*value*/ i, /*namespace*/ 2);
            test_encode_decode(nodeId, ec.encodeNodeId, ec.decodeNodeId, 4);
        }
    });

    it("should encode and decode a String NodeId", () => {
        const nodeId = makeNodeId("SomeStuff", 2500);
        nodeId.identifierType.should.eql(NodeIdType.STRING);

        test_encode_decode(nodeId, ec.encodeNodeId, ec.decodeNodeId, 4 + 9 + 2 + 1);
    });

    it("should encode and decode a Guid NodeId", () => {
        const nodeId = makeNodeId("72962B91-FA75-4AE6-8D28-B404DC7DAF63", 2500);
        nodeId.identifierType.should.eql(NodeIdType.GUID);
        test_encode_decode(nodeId, ec.encodeNodeId, ec.decodeNodeId, 16 + 2 + 1);
    });
    it("should encode and decode a String NodeId that looks like a GUID (issue#377)", () => {
        const nodeId = new NodeId(NodeIdType.STRING, "72962B91-FA75-4AE6-8D28-B404DC7DAF63", 2500);
        nodeId.identifierType.should.eql(NodeIdType.STRING);
        test_encode_decode(nodeId, ec.encodeNodeId, ec.decodeNodeId, 43);
    });

    it("should encode and decode a Opaque NodeId", () => {
        const value = Buffer.allocUnsafe(32);
        for (let i = 0; i < 32; i++) {
            value.writeUInt8(i, i);
        }
        const nodeId = makeNodeId(value, 0x1bcd);
        nodeId.identifierType.should.equal(NodeIdType.BYTESTRING);
        const expectedLength = 1 + 2 + 4 + 32;
        test_encode_decode(nodeId, ec.encodeNodeId, ec.decodeNodeId, expectedLength, (buffer) => {
            // cod
            buffer.readUInt8(0).should.equal(0x05);
            // namespace
            buffer.readUInt8(1).should.equal(0xcd);
            buffer.readUInt8(2).should.equal(0x1b);
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

    it("should encode and decode a BYTESTRING NodeId", () => {

        const nodeId = new NodeId(NodeIdType.BYTESTRING, crypto.randomBytes(16));

        const expectedLength = 1 + 2 + 4 + 16;
        test_encode_decode(nodeId, ec.encodeNodeId, ec.decodeNodeId, expectedLength, (buffer) => {
        });
    });

    it("should use the second form of decodeNodeId", () => {

        const nodeId = new NodeId(NodeIdType.GUID, randomGuid());
        const stream = new BinaryStream();
        encodeNodeId(nodeId, stream);
        stream.rewind();

        const reloadedNodeId = new NodeId();
        decodeNodeId(stream, reloadedNodeId);

        NodeId.sameNodeId(reloadedNodeId, nodeId).should.eql(true);


    });

    it("should encode and decode a Expanded NodeId  - TwoBytes", () => {
        test_encode_decode(makeExpandedNodeId(10), ec.encodeExpandedNodeId, ec.decodeExpandedNodeId, 2);
    });

    it("should encode and decode a Expanded NodeId  - FourBytes", () => {
        test_encode_decode(makeExpandedNodeId(32000), ec.encodeExpandedNodeId, ec.decodeExpandedNodeId, 4);
    });

    it("should encode and decode a Expanded NodeId with namespaceUri", () => {
        const serverIndex = 2;
        const namespaceUri = "some:namespace:uri";
        const expandedNodeId = new ExpandedNodeId(NodeIdType.NUMERIC, 4123, 4, namespaceUri, serverIndex);
        test_encode_decode(expandedNodeId, ec.encodeExpandedNodeId, ec.decodeExpandedNodeId, 33);
    });

    it("should encode and decode a UInt64 EightBytes", () => {
        test_encode_decode([356, 234], ec.encodeUInt64, ec.decodeUInt64, 8);
    });

    it("should encode and decode a Int64 EightBytes", () => {
        test_encode_decode([356, 234], ec.encodeInt64, ec.decodeInt64, 8);
    });
});

describe("encoding and decoding string", () => {
    it("should encode and decode a simple ascii String", () => {
        test_encode_decode("hello world", ec.encodeString, ec.decodeString, 11 + 4);
    });
    it("should encode and decode a utf-8 containing double bytes characters", () => {
        test_encode_decode(
            "°C",
            ec.encodeString,
            ec.decodeString,
            3 + 4, // (°=2 bytes characters + 1)
            function verify_buffer_func(buffer) {
                console.log(hexDump(buffer.slice(0, 7)));
            }
        );
    });
    it("should encode and decode a utf-8 containing chinese characters", () => {
        test_encode_decode(
            "你好世界", // hello world
            ec.encodeString,
            ec.decodeString,
            16,
            function verify_buffer_func(buffer) {
                console.log(hexDump(buffer.slice(0, 16)));
            }
        );
    });
});
describe("encoding and decoding arrays", () => {

    it("should encode and decode a null array of integer", () => {

        function encode_array_float(arr, stream) {
            ec.encodeArray(arr, stream, ec.encodeFloat);
        }

        function decode_array_float(stream) {
            return ec.decodeArray(stream, ec.decodeFloat);
        }
        test_encode_decode(null, encode_array_float, decode_array_float, 4);

    });

    it("should encode and decode an array of integer", () => {
        function encode_array_float(arr, stream) {
            ec.encodeArray(arr, stream, ec.encodeFloat);
        }

        function decode_array_float(stream) {
            return ec.decodeArray(stream, ec.decodeFloat);
        }

        test_encode_decode([10, 20, 30, 40], encode_array_float, decode_array_float, 4 * 3 + 8);
    });

    it("should encode and decode an array of strings", () => {
        function encode_array_string(arr, stream) {
            ec.encodeArray(arr, stream, ec.encodeString);
        }

        function decode_array_string(stream) {
            return ec.decodeArray(stream, ec.decodeString);
        }

        test_encode_decode(
            ["Hoo", "Hello", "World", "你好世界", "привет мир", "こんにちは世界"],
            encode_array_string,
            decode_array_string,
            93
        );
    });

    it("should encode and decode an array of ByteString", () => {
        function encode_array_string(arr, stream) {
            ec.encodeArray(arr, stream, ec.encodeByteString);
        }

        function decode_array_string(stream) {
            return ec.decodeArray(stream, ec.decodeByteString);
        }

        let data = [Buffer.from("ABCD"), null, Buffer.alloc(0), []];
        data = data.map(ec.coerceByteString);

        test_encode_decode(data, encode_array_string, decode_array_string, 24);
    });
});

describe("check isValid and random for various types", () => {

    it("isValidDouble on string shall return false", () => {
        ec.isValidDouble("Value").should.eql(false);
    });
    it("isValidFloat on string shall return false", () => {
        ec.isValidFloat("Value").should.eql(false);
    });

    it("should test isValid on Int32", () => {
        ec.isValidInt32(0).should.eql(true);
        ec.isValidInt32(-10).should.eql(true);
    });
    it("should test isValid on UInt16", () => {
        ec.isValidUInt16(0).should.eql(true);
        ec.isValidUInt16(0xffffff).should.eql(false);
    });

    const types = [
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

    types.forEach(function(type) {
        it("should have a random and isValid method for type " + type, () => {
            const randomFunc = ec["random" + type];
            const isValidFunc = ec["isValid" + type];

            ec.should.have.property("encode" + type);
            ec.should.have.property("decode" + type);
            ec.should.have.property("random" + type);
            ec.should.have.property("isValid" + type);

            const random_value = randomFunc();
            isValidFunc(random_value).should.eql(true);
        });
    });
});



describe("DateTime", () => {
    it("converting 1491684476245", () => {
        function check_date(t) {
            const date1 = new Date();
            date1.setTime(t);

            const stream = new BinaryStream(10);
            ec.encodeDateTime(date1, stream);
            //xx console.log(stream.buffer.toString("hex"));

            stream.rewind();
            const date2 = ec.decodeDateTime(stream);

            date1.getTime().should.eql(date2.getTime());
        }

        // -1491685621859
        // +1491685621853
        check_date(1491685621859);
        check_date(1491685621853);
    });
});

describe("Float", () => {
    it("should encode float (0)", () => {
        const buffer = Buffer.allocUnsafe(4);
        buffer[0] = 0x1;
        buffer[0] = 0x2;
        buffer[0] = 0x3;
        buffer[0] = 0x4;

        buffer.writeFloatLE(0.0, 0);

        console.log(buffer.toString("hex"));

        const value = buffer.readFloatLE(0);
        value.should.eql(0.0);
    });

    it("should encode float (0)", () => {
        const stream = new BinaryStream(4);
        ec.encodeFloat(0.0, stream);

        console.log(stream.buffer.toString("hex"));

        stream.rewind();
        const value = ec.decodeFloat(stream);
        value.should.eql(0.0);
    });

    it("should decode zero from a buffer with 4 bytes set to zero", () => {
        const buf = Buffer.allocUnsafe(4);
        buf.writeUInt32LE(0, 0);
        const stream = new BinaryStream(buf);

        const value = ec.decodeFloat(stream);
        value.should.eql(0.0);
    });
});

