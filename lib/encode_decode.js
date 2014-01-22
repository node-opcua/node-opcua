var BinaryStream = require("./binaryStream").BinaryStream;
var assert = require("assert");

exports.decodeUAString = function (stream) {
    var value;
    var length = stream.readInteger();
    if (length == -1) {
        value = undefined;
    } else {
        value = stream.stream.toString(encoding = 'binary', stream.length, stream.length + length);
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
    stream.stream.write(value, stream.length);
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
    utc1600 = new Date(1601, 1, 1);
    utc1970 = new Date(1970, 1, 1);
    t1970 = utc1970.getTime();
    t1600 = utc1600.getTime();
    return  (t1970 - t1600);
}();

exports.encodeDateTime = function (date, stream) {

    t = date.getTime(); // number of millisecond since 1/1/70

    assert(new Date(t).getTime() == t);

    span = t + offset1601;
    high = Math.floor(span / 0xffffffff);
    low = span % 0xffffffff;

    check_value = high * 0xffffffff + low;
    assert(check_value === span);

    stream.writeUInt32(high);
    stream.writeUInt32(low);

};

exports.decodeDateTime = function (stream) {

    high = stream.readUInt32();
    low = stream.readUInt32();
    value = (high * 0xffffffff) + low;

    value = value - offset1601;
    d = new Date(value);
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
