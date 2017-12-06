"use strict";

var getRandomInt = require("./utils").getRandomInt;
var _ = require("underscore");
var assert=require("node-opcua-assert");

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
