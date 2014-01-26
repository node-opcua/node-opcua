var BinaryStream = require("./binaryStream").BinaryStream;
var assert = require("assert");

var ec = exports;
var util = require("util");

exports.decodeUAString = function (stream) {
    var value;
    var length = stream.readInteger();
    if (length == -1) {
        value = undefined;
    } else {
        value = stream._buffer.toString(encoding = 'binary', stream.length, stream.length + length);
        stream.length += length;
    }
    return value;
};

exports.encodeUAString = function (value, stream) {

    if (value === undefined) {
        stream.writeInteger(-1);
        return;
    }
    stream.writeInteger(value.length);
    stream._buffer.write(value, stream.length);
    stream.length += value.length;
};

exports.encodeInt32 = function (value, stream) {
    stream.writeInteger(value);
};

exports.decodeInt32 = function (stream) {
    return stream.readInteger();
};

exports.encodeUInt32 = function (value, stream) {
    stream.writeUInt32(value);
};

exports.decodeUInt32 = function (stream) {
    return stream.readUInt32();
};

exports.encodeBoolean = function (value, stream) {
    assert(typeof value === "boolean");
    stream.writeByte(value ? 1 : 0);
};

exports.decodeBoolean = function (stream) {
    return value = stream.readByte() ? true : false;
};

exports.encodeByte = function (value, stream) {
    stream.writeByte(value);
};

exports.decodeByte = function (stream) {
    return value = stream.readByte();
};

exports.encodeFloat = function (value, stream) {
    stream.writeFloat(value);
};

exports.decodeFloat = function (stream) {
    return value = stream.readFloat();
};

exports.encodeDouble = function (value, stream) {
    stream.writeDouble(value);
};

exports.decodeDouble = function (stream) {
    return value = stream.readDouble();
};


//xx var int64 = require("int64-native");
var offset1601 = function () {
    // utc = Date.UTC(this.value.getYear(),this.value.getMonth()); // Number of second since January 1970
    var utc1600 = new Date(1601, 1, 1);
    var utc1970 = new Date(1970, 1, 1);
    var t1970 = utc1970.getTime();
    var t1600 = utc1600.getTime();
    return  (t1970 - t1600);
}();

exports.encodeDateTime = function (date, stream) {

    var t = date.getTime(); // number of millisecond since 1/1/70

    assert(new Date(t).getTime() == t);

    var span = t + offset1601;
    var high = Math.floor(span / 0xffffffff);
    var low = span % 0xffffffff;

    var check_value = high * 0xffffffff + low;
    assert(check_value === span);

    stream.writeUInt32(high);
    stream.writeUInt32(low);

};

exports.decodeDateTime = function (stream) {

    var high = stream.readUInt32();
    var low = stream.readUInt32();
    var value = (high * 0xffffffff) + low;
    value -= offset1601;

    var d = new Date(value);
    return d;
};

exports.isValidGUID = function (guid) {
    assert(guid.length == 36)
};


exports.encodeGUID = function (guid, stream) {

    exports.isValidGUID(guid);
    //            1         2         3
    //  0123456789012345678901234567890123456
    //           |    |    | |  |
    // “72962B91-FA75-4AE6-8D28-B404DC7DAF63”
    stream.writeUInt32(parseInt("0x" + guid.substr(0, 8)));

    stream.writeUInt16(parseInt("0x" + guid.substr(9, 4)));

    stream.writeUInt16(parseInt("0x" + guid.substr(14, 4)));

    stream.writeUInt8(parseInt("0x" + guid.substr(19, 2)));
    stream.writeUInt8(parseInt("0x" + guid.substr(21, 2)));

    stream.writeUInt8(parseInt("0x" + guid.substr(24, 2)));
    stream.writeUInt8(parseInt("0x" + guid.substr(26, 2)));
    stream.writeUInt8(parseInt("0x" + guid.substr(28, 2)));
    stream.writeUInt8(parseInt("0x" + guid.substr(30, 2)));
    stream.writeUInt8(parseInt("0x" + guid.substr(32, 2)));
    stream.writeUInt8(parseInt("0x" + guid.substr(34, 2)));

};

function toHex(i, nb) {
    return ("000000000000000" + i.toString(16)).substr(-nb)
}

exports.decodeGUID = function (stream) {

    var data1 = toHex(stream.readUInt32(), 8);

    var data2 = toHex(stream.readUInt16(), 4);

    var data3 = toHex(stream.readUInt16(), 4);

    var data4 = toHex(stream.readUInt8(), 2);
    var data5 = toHex(stream.readUInt8(), 2);

    var data6 = toHex(stream.readUInt8(), 2);
    var data7 = toHex(stream.readUInt8(), 2);

    var data8 = toHex(stream.readUInt8(), 2);
    var data9 = toHex(stream.readUInt8(), 2);
    var dataA = toHex(stream.readUInt8(), 2);
    var dataB = toHex(stream.readUInt8(), 2);

    var guid = data1 + "-" + data2 + "-" + data3 + "-" + data4 + data5 + "-" +
        data6 + data7 + data8 + data9 + dataA + dataB;
    return guid.toUpperCase();
};

var makeNodeId = function makeNodeId(value,namespace) {

    value = value || 0;
    namespace = namespace || null;
    return { value: value, namespace: namespace};
};
exports.makeNodeId = makeNodeId;

exports.encodeNodeId = function(nodeId,stream)
{
    if (typeof nodeId.value === 'number') {
        if (nodeId.value < 255 && ( !nodeId.namespace)) {
            // 2 byte encoding
            stream.writeByte(0);// encoding byte
            stream.writeByte(nodeId.value);
        } else if (nodeId.value <= 65535 && nodeId.namespace >= 0 && nodeId.namespace <= 255) {
            stream.writeByte(1); // encoding byte
            stream.writeByte(nodeId.namespace); // encoding byte
            stream.writeInt16(nodeId.value);
        } else {
            throw " cannot encode node id "+ util.inspect(nodeId);
        }
    } else {
        stream.writeByte(3); // UAString
        stream.writeInt16(nodeId.namespace);
        ec.encodeUAString(nodeId.value,stream);
    }

};

exports.decodeNodeId = function(stream)
{
    var encoding_byte = stream.readByte();
    var nodeId = { value: 0, namespace: null};
    var value,namespace;
    switch(encoding_byte) {
        case 0:
           value = stream.readByte();
           return makeNodeId(value);
           break;
        case 1:
            namespace = stream.readByte();
            value = stream.readInt16();
            return makeNodeId(value,namespace);
            break;
        case 3:
            namespace = stream.readInt16();
            value = ec.decodeUAString(stram);
            return makeNodeId(value,namespace);
            break;
        default:
            throw new Error("invalid nodeId ");
            break;
    }
};


exports.makeExpandedNodeId = function makeExpandedNodeId(value,namespace) {

    value = value || 0;
    namespace = namespace || 0;
    return { value: value, namespace: namespace, };
};

exports.encodeExpandedNodeId = function(expandedNodeId, stream) {

};

exports.decodeExpandedNodeId = function(expandedNodeId, stream) {

};



exports.encodeLocaleId = ec.encodeUAString;
exports.decodeLocaleId =  ec.decodeUAString;
exports.validateLocaleId = function( value) {
    // TODO : check that localeID is wellformed
    // see part 3 $8.4 page 63
    return true;
};

exports.encodeByteString = function(byteString,stream) {
    stream.writeByteStream(byteString);
};

exports.decodeByteString = function(stream) {
    return stream.readByteStream();
};

