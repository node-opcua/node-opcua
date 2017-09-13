"use strict";
var _ = require("underscore");

var minFloat = -3.40 * Math.pow(10, 38);
var maxFloat = 3.40 * Math.pow(10, 38);


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

