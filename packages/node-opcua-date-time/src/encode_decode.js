"use strict";
const assert = require("node-opcua-assert").assert;
const _ =require("underscore");

const date_time = require("./date_time");
const bn_dateToHundredNanoSecondFrom1601 = date_time.bn_dateToHundredNanoSecondFrom1601;
const bn_hundredNanoSecondFrom1601ToDate = date_time.bn_hundredNanoSecondFrom1601ToDate;



//  Date(year, month [, day, hours, minutes, seconds, ms])
exports.isValidDateTime = function (value) {
    return value instanceof Date;
};

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


exports.randomDateTime = function () {
    const r = getRandomInt;
    return new Date(
      1900 + r(0, 200), r(0, 11), r(0, 28),
      r(0, 24), r(0, 59), r(0, 59), r(0, 1000));

};
const MAXUINT32 = 4294967295; // 2**32 - 1
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
    let hl = bn_dateToHundredNanoSecondFrom1601(date);
    let hi = hl[0];
    let lo = hl[1];

    // make sure that date are not lower than expected limit
    if (hi<0 || lo<0) {
        hi=0;lo=0;
    }
    if (hi <0 || lo<0 || hi > MAXUINT32 || lo > MAXUINT32 ) {
        hl = bn_dateToHundredNanoSecondFrom1601(date);
        throw new Error("INVALID " + hi  + " "+lo + " "+date.toUTCString());
    }
    stream.writeUInt32(lo);
    stream.writeUInt32(hi);
    //xx assert(date.toString() === bn_hundredNanoSecondFrom1601ToDate(hi, lo).toString());
};

exports.decodeDateTime = function (stream) {
    const lo = stream.readUInt32();
    const hi = stream.readUInt32();
    return bn_hundredNanoSecondFrom1601ToDate(hi, lo);
};


function coerceDateTime(value) {
    if (value instanceof Date) {
        return value;
    }
    return new Date(value);
}
exports.coerceDateTime = coerceDateTime;