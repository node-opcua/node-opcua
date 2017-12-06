"use strict";
var assert = require("node-opcua-assert");

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


var falsy = /^(?:f(?:alse)?|no?|0+)$/i;

exports.coerceBoolean = function coerceBoolean(value) {
    if (value === null || value === undefined) {
        return value;
    }

    // http://stackoverflow.com/a/24744599/406458
    return !falsy.test(value) && !!value;

    // return !!(+value||String(value).toLowerCase().replace(!!0,''));
};

