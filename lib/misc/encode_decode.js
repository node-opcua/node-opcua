"use strict";
/**
 * @module opcua.miscellaneous
 * @class EncodeDecode
 * @static
 */
require("requirish")._(module);

var assert = require("better-assert");
var Enum = require("lib/misc/enum");

var ec = exports;
var _ = require("underscore");

var isValidGuid = require("lib/datamodel/guid").isValidGuid;
var emptyGuid = require("lib/datamodel/guid").emptyGuid;

var NodeIdType = exports.NodeIdType = require("lib/datamodel/nodeid").NodeIdType;

var makeNodeId = exports.makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
exports.makeExpandedNodeId = require("lib/datamodel/expanded_nodeid").makeExpandedNodeId;
var ExpandedNodeId = require("lib/datamodel/expanded_nodeid").ExpandedNodeId;

var set_flag = require("lib/misc/utils").set_flag;
var check_flag = require("lib/misc/utils").check_flag;

var buffer_utils = require("lib/misc/buffer_utils");
var createFastUninitializedBuffer = buffer_utils.createFastUninitializedBuffer;

/**
 * return a random integer value in the range of  min inclusive and  max exclusive
 * @method getRandomInt
 * @param min
 * @param max
 * @return {*}
 * @private
 */
function getRandomInt(min, max) {
    // note : Math.random() returns a random number between 0 (inclusive) and 1 (exclusive):
    return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * return a random float value in the range of  min inclusive and  max exclusive
 * @method getRandomInt
 * @param min
 * @param max
 * @return {*}
 * @private
 */
function getRandomDouble(min, max) {
    return Math.random() * (max - min ) + min;
}

exports.isValidString = function (value) {
    return typeof value === "string";
};
exports.randomString = function () {
    var nbCar = getRandomInt(1, 20);
    var cars = [];
    for (var i = 0; i < nbCar; i++) {
        cars.push(String.fromCharCode(65 + getRandomInt(0, 26)));
    }
    return cars.join("");
};

exports.decodeString = function (stream) {
    return stream.readString();
};
exports.encodeString = function (value, stream) {
    stream.writeString(value);
};

exports.isValidUInt16 = function (value) {
    if (!_.isFinite(value)) {
        return false;
    }
    return value >= 0 && value <= 0xFFFF;
};
exports.randomUInt16 = function () {
    return getRandomInt(0, 0xFFFF);
};
exports.encodeUInt16 = function (value, stream) {
    stream.writeUInt16(value);
};
exports.decodeUInt16 = function (stream) {
    return stream.readUInt16();
};

exports.isValidInt16 = function (value) {
    if (!_.isFinite(value)) {
        return false;
    }
    return value >= -0x8000 && value <= 0x7FFF;
};
exports.randomInt16 = function () {
    return getRandomInt(-0x8000, 0x7FFF);
};
exports.encodeInt16 = function (value, stream) {
    assert(_.isFinite(value));
    stream.writeInt16(value);
};
exports.decodeInt16 = function (stream) {
    return stream.readInt16();
};

exports.isValidInt32 = function (value) {
    if (!_.isFinite(value)) {
        return false;
    }
    return value >= -0x80000000 && value <= 0x7fffffff;
};
exports.randomInt32 = function () {
    return getRandomInt(-0x80000000, 0x7fffffff);
};
exports.encodeInt32 = function (value, stream) {
    assert(_.isFinite(value));
    stream.writeInteger(value);
};
exports.decodeInt32 = function (stream) {
    return stream.readInteger();
};

exports.isValidUInt32 = function (value) {
    if (!_.isFinite(value)) {
        return false;
    }
    return value >= 0 && value <= 0xFFFFFFFF;
};
exports.randomUInt32 = function () {
    return getRandomInt(0, 0xFFFFFFFF);
};
exports.encodeUInt32 = function (value, stream) {
    stream.writeUInt32(value);
};
exports.decodeUInt32 = function (stream) {
    return stream.readUInt32();
};

var isValidBoolean = exports.isValidBoolean = function (value) {
    return typeof value === "boolean";
};

exports.randomBoolean = function () {
    return (Math.random() > 0.5);
};

exports.encodeBoolean = function (value, stream) {
    assert(isValidBoolean(value));
    stream.writeUInt8(value ? 1 : 0);
};
exports.decodeBoolean = function (stream) {
    return stream.readUInt8() ? true : false;
};

function isValidInt8(value) {
    if (!_.isFinite(value)) {
        return false;
    }
    return value >= -0x80 && value <= 0x7F;
}
exports.isValidInt8 = isValidInt8;

exports.randomInt8 = function () {
    return getRandomInt(-0x7F, 0x7E);
};
exports.encodeInt8 = function (value, stream) {
    assert(isValidInt8(value));
    stream.writeInt8(value);
};
exports.decodeInt8 = function (stream) {
    return stream.readInt8();
};


exports.isValidSByte = exports.isValidInt8;
exports.randomSByte = exports.randomInt8;
exports.encodeSByte = exports.encodeInt8;
exports.decodeSByte = exports.decodeInt8;


exports.isValidUInt8 = function (value) {
    if (!_.isFinite(value)) {
        return false;
    }
    return value >= -0x00 && value <= 0xFF;
};
exports.randomUInt8 = function () {
    return getRandomInt(0x00, 0xFF);
};
exports.encodeUInt8 = function (value, stream) {
    stream.writeUInt8(value);
};
exports.decodeUInt8 = function (stream) {
    return stream.readUInt8();
};

exports.isValidByte = exports.isValidUInt8;
exports.randomByte = exports.randomUInt8;
exports.encodeByte = exports.encodeUInt8;
exports.decodeByte = exports.decodeUInt8;

var minFloat = -3.40 * Math.pow(10, 38);
var maxFloat = 3.40 * Math.pow(10, 38);

exports.isValidFloat = function (value) {
    if (!_.isFinite(value)) {
        return false;
    }
    return value > minFloat && value < maxFloat;
};

function roundToFloat2(float) {
    if (float === 0) {
        return float;
    }
    // this method artificially rounds a float to 7 significant digit in base 10
    // Note:
    //   this is to overcome the that that Javascript doesn't  provide  single precision float values (32 bits)
    //   but only double precision float values

    // wikipedia:(http://en.wikipedia.org/wiki/Floating_point)
    //
    // * Single precision, usually used to represent the "float" type in the C language family
    //   (though this is not guaranteed). This is a binary format that occupies 32 bits (4 bytes) and its
    //   significand has a precision of 24 bits (about 7 decimal digits).
    // * Double precision, usually used to represent the "double" type in the C language family
    //   (though this is not guaranteed). This is a binary format that occupies 64 bits (8 bytes) and its
    //   significand has a precision of 53 bits (about 16 decimal digits).
    //
    var nbDigits = Math.ceil(Math.log(Math.abs(float)) / Math.log(10));
    var r = Math.pow(10, -nbDigits + 2);
    return Math.round(float * r) / r;
}

var r = new Float32Array(1);
function roundToFloat(float) {
    r[0] = float;
    var float_r = r[0];
    return float_r;
}

exports.randomFloat = function () {
    return roundToFloat(getRandomDouble(-1000, 1000));
};

exports.encodeFloat = function (value, stream) {
    stream.writeFloat(value);
};

exports.decodeFloat = function (stream) {
    var float = stream.readFloat();
    return float;
    //xx return roundToFloat(float);
};

exports.isValidDouble = function (value) {
    if (!_.isFinite(value)) {
        return false;
    }
    return true;
};

exports.randomDouble = function () {
    return getRandomDouble(-1000000, 1000000);
};

exports.encodeDouble = function (value, stream) {
    stream.writeDouble(value);
};

exports.decodeDouble = function (stream) {
    return stream.readDouble();
};

var date_time = require("lib/misc/date_time");
var bn_dateToHundredNanoSecondFrom1601 = date_time.bn_dateToHundredNanoSecondFrom1601;
var bn_hundredNanoSecondFrom1601ToDate = date_time.bn_hundredNanoSecondFrom1601ToDate;

//  Date(year, month [, day, hours, minutes, seconds, ms])
exports.isValidDateTime = function (value) {
    return value instanceof Date;
};
exports.randomDateTime = function () {
    var r = getRandomInt;
    return new Date(
        1900 + r(0, 200), r(0, 11), r(0, 28),
        r(0, 24), r(0, 59), r(0, 59), r(0, 1000));

};
exports.encodeDateTime = function (date, stream) {

    if (!date) {
        stream.writeUInt32(0);
        stream.writeUInt32(0);
        return;
    }
    if (!(date instanceof Date)){
        throw new Error("Expecting a Date : but got a " + typeof(date) + " " + date.toString());
    }
    assert(date instanceof Date);
    var hl = bn_dateToHundredNanoSecondFrom1601(date);
    var hi = hl[0];
    var lo = hl[1];
    stream.writeUInt32(lo);
    stream.writeUInt32(hi);
    //xx assert(date.toString() === bn_hundredNanoSecondFrom1601ToDate(hi, lo).toString());
};

exports.decodeDateTime = function (stream) {
    var lo = stream.readUInt32();
    var hi = stream.readUInt32();
    return bn_hundredNanoSecondFrom1601ToDate(hi, lo);
};


exports.emptyGuid = emptyGuid;
exports.isValidGuid = isValidGuid;
exports.randomGuid = function () {
    var BinaryStream = require("lib/misc/binaryStream").BinaryStream;

    var b = new BinaryStream(20);
    for (var i = 0; i < 20; i++) {
        b.writeUInt8(getRandomInt(0, 255));
    }
    b.rewind();
    var value = exports.decodeGuid(b);
    return value;
};
exports.encodeGuid = function (guid, stream) {

    if (!isValidGuid(guid)) {
        throw new Error(" Invalid GUID " + JSON.stringify(guid));
    }
    //           1         2         3
    // 012345678901234567890123456789012345
    // |        |    |    | |  | | | | | |
    // 12345678-1234-1234-ABCD-0123456789AB
    // 00000000-0000-0000-0000-000000000000";
    function write_UInt32(starts) {
        var start,i,n = starts.length;
        for (i=0;i<n;i++) {
            start = starts[i];
            stream.writeUInt32(parseInt(guid.substr(start, 8), 16));
        }
    }

    function write_UInt16(starts) {
        var start,i,n = starts.length;
        for (i=0;i<n;i++) {
            start = starts[i];
            stream.writeUInt16(parseInt(guid.substr(start, 4), 16));
        }
    }

    function write_UInt8(starts){
        var start,i,n = starts.length;
        for (i=0;i<n;i++) {
            start = starts[i];
           stream.writeUInt8(parseInt(guid.substr(start, 2), 16));
        }
    }

    write_UInt32([0]);
    write_UInt16([9, 14]);
    write_UInt8([19, 21, 24, 26, 28, 30, 32, 34]);
};

var toHex = require("lib/misc/utils").toHex;

exports.decodeGuid = function (stream) {

    function read_UInt32() {
        return toHex(stream.readUInt32(), 8);
    }

    function read_UInt16() {
        return toHex(stream.readUInt16(), 4);
    }

    function read_UInt8() {
        return toHex(stream.readUInt8(), 2);
    }

    function read_many(func, nb) {
        var result = "";
        for (var i = 0; i < nb; i++) {
            result += func();
        }
        return result;
    }

    var data1 = read_UInt32();

    var data2 = read_UInt16();

    var data3 = read_UInt16();

    var data4_5 = read_many(read_UInt8, 2);

    var data6_B = read_many(read_UInt8, 6);

    var guid = data1 + "-" + data2 + "-" + data3 + "-" + data4_5 + "-" + data6_B;

    return guid.toUpperCase();
};


var EnumNodeIdEncoding = new Enum({
    TwoBytes: 0x00, // A numeric value that fits into the two byte representation.
    FourBytes: 0x01, // A numeric value that fits into the four byte representation.
    Numeric: 0x02, // A numeric value that does not fit into the two or four byte representations.
    String: 0x03, // A String value.
    Guid: 0x04, // A Guid value.
    ByteString: 0x05, // An opaque (ByteString) value.
    NamespaceUriFlag: 0x80, //  NamespaceUriFlag on  ExpandedNodeId is present
    ServerIndexFlag: 0x40  //  NamespaceUriFlag on  ExpandedNodeId is present
});


function is_uint8(value) {

    return value >= 0 && value <= 0xFF;
}
function is_uint16(value) {

    return value >= 0 && value <= 0xFFFF;
}

function nodeID_encodingByte(nodeId) {

    if (!nodeId) {
        return 0;
    }
    assert(nodeId.hasOwnProperty("identifierType"));

    var encodingByte = 0;

    if (nodeId.identifierType.is(NodeIdType.NUMERIC)) {

        if (is_uint8(nodeId.value) && (!nodeId.namespace) && !nodeId.namespaceUri && !nodeId.serverIndex) {

            encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.TwoBytes);

        } else if (is_uint16(nodeId.value) && is_uint8(nodeId.namespace) && !nodeId.namespaceUri && !nodeId.serverIndex) {

            encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.FourBytes);

        } else {
            encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.Numeric);
        }

    } else if (nodeId.identifierType.is(NodeIdType.STRING)) {

        encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.String);

    } else if (nodeId.identifierType.is(NodeIdType.BYTESTRING)) {
        encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.ByteString);

    } else if (nodeId.identifierType.is(NodeIdType.GUID)) {
        encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.Guid);
    }

    if (nodeId.hasOwnProperty("namespaceUri") && nodeId.namespaceUri) {
        encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.NamespaceUriFlag);
    }
    if (nodeId.hasOwnProperty("serverIndex") && nodeId.serverIndex) {
        encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.ServerIndexFlag);
    }
    return encodingByte;
}


exports.isValidNodeId = function (nodeId) {
    if (nodeId === null || nodeId === void 0) {
        return false;
    }
    return nodeId.hasOwnProperty("identifierType")
        ;
};
exports.randomNodeId = function () {

    var value = getRandomInt(0, 0xFFFFF);
    var namespace = getRandomInt(0, 3);
    return makeNodeId(value, namespace);
};


function _encodeNodeId(encoding_byte, nodeId, stream) {

    stream.writeUInt8(encoding_byte);// encoding byte

    /*jslint bitwise: true */
    encoding_byte &= 0x3F;

    switch (encoding_byte) {
        case EnumNodeIdEncoding.TwoBytes.value:
            stream.writeUInt8(nodeId.value);
            break;
        case EnumNodeIdEncoding.FourBytes.value:
            stream.writeUInt8(nodeId.namespace);
            stream.writeUInt16(nodeId.value);
            break;
        case EnumNodeIdEncoding.Numeric.value:
            stream.writeUInt16(nodeId.namespace);
            stream.writeUInt32(nodeId.value);
            break;
        case EnumNodeIdEncoding.String.value:
            stream.writeUInt16(nodeId.namespace);
            ec.encodeString(nodeId.value, stream);
            break;
        case EnumNodeIdEncoding.ByteString.value:
            stream.writeUInt16(nodeId.namespace);
            ec.encodeByteString(nodeId.value, stream);
            break;
        default:
            assert(encoding_byte === EnumNodeIdEncoding.Guid.value);
            stream.writeUInt16(nodeId.namespace);
            ec.encodeGuid(nodeId.value, stream);
            break;
    }

}

exports.encodeNodeId = function (nodeId, stream) {

    var encoding_byte = nodeID_encodingByte(nodeId);
    /*jslint bitwise: true */
    encoding_byte &= 0x3F;
    _encodeNodeId(encoding_byte, nodeId, stream);

};

exports.encodeExpandedNodeId = function (expandedNodeId, stream) {

    var encodingByte = nodeID_encodingByte(expandedNodeId);
    _encodeNodeId(encodingByte, expandedNodeId, stream);
    if (check_flag(encodingByte, EnumNodeIdEncoding.NamespaceUriFlag)) {
        exports.encodeString(expandedNodeId.namespaceUri, stream);
    }
    if (check_flag(encodingByte, EnumNodeIdEncoding.ServerIndexFlag)) {
        exports.encodeUInt32(expandedNodeId.serverIndex, stream);
    }
};

var _decodeNodeId = function (encoding_byte, stream) {

    var value, namespace;
    /*jslint bitwise: true */
    encoding_byte &= 0x3F;
    switch (encoding_byte) {
        case EnumNodeIdEncoding.TwoBytes.value:
            value = stream.readUInt8();
            break;
        case EnumNodeIdEncoding.FourBytes.value:
            namespace = stream.readUInt8();
            value = stream.readUInt16();
            break;
        case EnumNodeIdEncoding.Numeric.value:
            namespace = stream.readUInt16();
            value = stream.readUInt32(stream);
            break;
        case EnumNodeIdEncoding.String.value:
            namespace = stream.readUInt16();
            value = ec.decodeString(stream);
            break;
        case EnumNodeIdEncoding.ByteString.value:
            namespace = stream.readUInt16();
            value = ec.decodeByteString(stream);
            break;
        default:
            if (encoding_byte !== EnumNodeIdEncoding.Guid.value) {
                /*jslint bitwise: true */
                console.log(" encoding_byte = " + encoding_byte.toString(16), encoding_byte, encoding_byte & 0x3F);
                //xx var exit = require("exit");
                //xx exit(1);
                throw new Error(" encoding_byte = " + encoding_byte.toString(16));
            }
            namespace = stream.readUInt16();
            value = ec.decodeGuid(stream);
            assert(isValidGuid(value));
            break;
    }
    return makeNodeId(value, namespace);
};
exports.decodeNodeId = function (stream) {
    var encoding_byte = stream.readUInt8();
    return _decodeNodeId(encoding_byte, stream);
};


exports.decodeExpandedNodeId = function (stream) {

    var encoding_byte = stream.readUInt8();
    var expandedNodeId = _decodeNodeId(encoding_byte, stream);
    expandedNodeId.namespaceUri = null;
    expandedNodeId.serverIndex = 0;

    if (check_flag(encoding_byte, EnumNodeIdEncoding.NamespaceUriFlag)) {
        expandedNodeId.namespaceUri = ec.decodeString(stream);
    }
    if (check_flag(encoding_byte, EnumNodeIdEncoding.ServerIndexFlag)) {
        expandedNodeId.serverIndex = ec.decodeUInt32(stream);
    }
    var e = expandedNodeId;
    return new ExpandedNodeId( e.identifierType, e.value,e.namespace, e.namespaceUri, e.serverIndex);
};
exports.encodeLocaleId = ec.encodeString;
exports.decodeLocaleId = ec.decodeString;

exports.validateLocaleId = function (/*value*/) {
    // TODO : check that localeID is well-formed
    // see part 3 $8.4 page 63

    return true;
};

exports.isValidByteString = function (value) {
    return value === null || value instanceof Buffer;
};
exports.randomByteString = function (value, len) {
    len = len || getRandomInt(1, 200);
    var b = createFastUninitializedBuffer(len);
    for (var i = 0; i < len; i++) {
        b.writeUInt8(getRandomInt(0, 255), i);
    }
    return b;
};
exports.encodeByteString = function (byteString, stream) {
    stream.writeByteStream(byteString);
};
exports.decodeByteString = function (stream) {
    return stream.readByteStream();
};

exports.decodeStatusCode = require("lib/datamodel/opcua_status_code").decodeStatusCode;
exports.encodeStatusCode = require("lib/datamodel/opcua_status_code").encodeStatusCode;


exports.isValidUInt64 = function (value) {
    return value instanceof Array && value.length === 2;
};
exports.randomUInt64 = function () {
    return [getRandomInt(0, 0xFFFFFFFF), getRandomInt(0, 0xFFFFFFFF)];
};
exports.encodeUInt64 = function (value, stream) {

    if (_.isNumber(value)) {
        value = exports.coerceUInt64(value);
    }
    stream.writeUInt32(value[1]);
    stream.writeUInt32(value[0]);
};

exports.decodeUInt64 = function (stream) {
    var low = stream.readUInt32();
    var high = stream.readUInt32();
    return exports.constructInt64(high, low);
};
exports.constructInt64 = function (high, low) {
    assert(low >= 0 && low <= 0xFFFFFFFF);
    assert(high >= 0 && high <= 0xFFFFFFFF);
    return [high, low];
};

exports.coerceUInt64 = function (value) {

    var high, low, v;
    if (value === null || value === undefined) {
        return value;
    }
    if (value instanceof Array) {
        assert(_.isNumber(value[0]));
        assert(_.isNumber(value[1]));
        return value;
    }
    if (typeof value === "string") {
        v = value.split(",");
        high = parseInt(v[0], 10);
        low = parseInt(v[1], 10);
        return exports.constructInt64(high, low);
    }
    if (value > 0xFFFFFFFF) {
        // beware : as per javascript, value is a double here !
        //          our conversion will suffer from some inacuracy

        high = Math.floor(value / 0x100000000);
        low = value - high * 0x100000000;
        return exports.constructInt64(high, low);
    }
    return exports.constructInt64(0, value);
};

exports.randomInt64 = function () {
    // High, low
    return [getRandomInt(0, 0xFFFFFFFF), getRandomInt(0, 0xFFFFFFFF)];
};
exports.coerceInt64 = exports.coerceUInt64;
exports.isValidInt64 = exports.isValidUInt64;
exports.encodeInt64 = exports.encodeUInt64;
exports.decodeInt64 = exports.decodeUInt64;


var falsy = /^(?:f(?:alse)?|no?|0+)$/i;

exports.coerceBoolean = function coerceBoolean(value) {
    if (value === null || value === undefined) {
        return value;
    }

    // http://stackoverflow.com/a/24744599/406458
    return !falsy.test(value) && !!value;

    // return !!(+value||String(value).toLowerCase().replace(!!0,''));
};

exports.coerceInt8 = function coerceInt8(value) {
    if (value === null || value === undefined) {
        return value;
    }
    return parseInt(value, 10);
};
exports.coerceUInt8 = function coerceUInt8(value) {
    if (value === null || value === undefined) {
        return value;
    }
    return parseInt(value, 10);
};
exports.coerceByte = function coerceByte(value) {
    if (value === null || value === undefined) {
        return value;
    }
    return parseInt(value, 10);
};
exports.coerceSByte = function coerceSByte(value) {
    if (value === null || value === undefined) {
        return value;
    }
    return parseInt(value, 10);
};
exports.coerceUInt16 = function coerceUInt16(value) {
    if (value === null || value === undefined) {
        return value;
    }
    return parseInt(value, 10);
};
exports.coerceInt16 = function coerceInt16(value) {
    if (value === null || value === undefined) {
        return value;
    }
    return parseInt(value, 10);
};
exports.coerceUInt32 = function coerceUInt32(value) {
    if (value === null || value === undefined) {
        return value;
    }
    return parseInt(value, 10);
};
exports.coerceInt32 = function coerceInt32(value) {
    if (value === null || value === undefined) {
        return value;
    }
    return parseInt(value, 10);
};
exports.coerceFloat = function coerceFloat(value) {
    if (value === null || value === undefined) {
        return value;
    }
    return parseFloat(value);
};
exports.coerceDouble = function coerceDouble(value) {
    if (value === null || value === undefined) {
        return value;
    }
    return parseFloat(value);
};


/**
 * @method encodeArray
 * @param arr {Array} the array to encode.
 * @param stream {BinaryStream}  the stream.
 * @param encode_element_func  {Function}  The  function to encode a single array element.
 * @param encode_element_func.element {object}
 * @param encode_element_func.stream  {BinaryStream}  the stream.
 */
exports.encodeArray = function (arr, stream, encode_element_func) {

    if (arr === null) {
        stream.writeUInt32(0xFFFFFFFF);
        return;
    }
    assert(_.isArray(arr));
    stream.writeUInt32(arr.length);
    for (var i = 0; i < arr.length; i++) {
        encode_element_func(arr[i], stream);
    }
};
/**
 * @method decodeArray
 * @param stream {BinaryStream}  the stream.
 * @param decode_element_func {Function}  The  function to decode a single array element. This function returns the element decoded from the stream
 * @param decode_element_func.stream {BinaryStream}  the stream.
 * @return {Array}
 */
exports.decodeArray = function (stream, decode_element_func) {

    var length = stream.readUInt32(stream);
    if (length === 0xFFFFFFFF) {
        return null;
    }

    var arr = [];
    for (var i = 0; i < length; i++) {
        arr.push(decode_element_func(stream));
    }

    return arr;
};


