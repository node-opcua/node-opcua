"use strict";

var buffer_utils = require("node-opcua-buffer-utils");
var createFastUninitializedBuffer = buffer_utils.createFastUninitializedBuffer;

var getRandomInt = require("./utils").getRandomInt;
var _ = require("underscore");

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

function coerceByteString(value) {

    if (_.isArray(value)) {
        return new Buffer(value);
    }
    if (typeof value === "string") {
        return new Buffer(value, "base64");
    }
    return value;
}
exports.coerceByteString = coerceByteString;

