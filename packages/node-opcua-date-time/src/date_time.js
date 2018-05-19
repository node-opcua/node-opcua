"use strict";
const assert = require("node-opcua-assert").assert;
const Long = require("long");

const offset_factor_1601 = (function () {

    const utc1600 = new Date(Date.UTC(1601, 0, 1, 0, 0, 0));
    const t1600 = utc1600.getTime();

    const utc1600_plus_one_day = new Date(Date.UTC(1601, 0, 2, 0, 0, 0));
    const t1600_1d = utc1600_plus_one_day.getTime();

    const factor = (24 * 60 * 60 * 1000) * 10000 / (t1600_1d - t1600);

    const utc1970 = new Date(Date.UTC(1970, 0, 1, 0, 0, 0));
    const t1970 = utc1970.getTime();

    const offsetToGregorianCalendarZero = -t1600 + t1970;

    assert(factor === 10000);
    assert(offsetToGregorianCalendarZero === 11644473600000);
    return [offsetToGregorianCalendarZero, factor];

})();

exports.offset_factor_1601 = offset_factor_1601;

const offset = offset_factor_1601[0];
const factor = offset_factor_1601[1];

const offsetLong = Long.fromNumber(offset,true);
const factorLong = Long.fromNumber(factor,true);

// Extracted from OpcUA Spec v1.02 : part 6:
//
// 5.2.2.5 DateTime
// A DateTime value shall be encoded as a 64-bit signed integer (see Clause 5.2.2.2) which represents
// the number of 100 nanosecond intervals since January 1, 1601 (UTC) .
// Not all DevelopmentPlatforms will be able to represent the full range of dates and times that can be
// represented with this DataEncoding. For example, the UNIX time_t structure only has a 1 second
// resolution and cannot represent dates prior to 1970. For this reason, a number of rules shall be
// applied when dealing with date/time values that exceed the dynamic range of a DevelopmentPlatform.
//
// These rules are:
// a) A date/time value is encoded as 0 if either
//    1) The value is equal to or earlier than 1601-01-01 12:00AM.
//    2) The value is the earliest date that can be represented with the DevelopmentPlatform‟s encoding.
//
// b) A date/time is encoded as the maximum value for an Int64 if either
//     1) The value is equal to or greater than 9999-01-01 11:59:59PM,
//     2) The value is the latest date that can be represented with the DevelopmentPlatform‟s encoding.
//
// c) A date/time is decoded as the earliest time that can be represented on the platform if either
//    1) The encoded value is 0,
//    2) The encoded value represents a time earlier than the earliest time that can be
//       represented with the DevelopmentPlatform‟s encoding.
//
//  d) A date/time is decoded as the latest time that can be represented on the platform if either
//    1) The encoded value is the maximum value for an Int64,
//    2) The encoded value represents a time later than the latest time that can be represented with the
//       DevelopmentPlatform‟s encoding.
//
// These rules imply that the earliest and latest times that can be represented on a given platform are
// invalid date/time values and should be treated that way by Applications.
// A decoder shall truncate the value if a decoder encounters a DateTime value with a resolution that is
// greater than the resolution supported on the DevelopmentPlatform.
//
/**
 *
 * @param date {Date}
 * @param picoseconds {Number} : represent the portion of the date that cannot be managed by the javascript Date object
 *
 * @returns {[high,low]}
 */
function bn_dateToHundredNanoSecondFrom1601_fast(date, picoseconds) {


    assert(date instanceof Date);
    if (date.high_low) {
        return date.high_low;
    }

    // note : The value returned by the getTime method is the number
    //        of milliseconds since 1 January 1970 00:00:00 UTC.
    //
    const t = date.getTime(); // number of milliseconds since since 1 January 1970 00:00:00 UTC.
    const excess_100nano_second = (picoseconds !== undefined) ? Math.floor(picoseconds / 100000) : 0;

    //           value_64 = (t + offset ) * factor;
    const tL = Long.fromNumber(t,false);
    const a = tL.add(offsetLong).multiply(factorLong).add(excess_100nano_second);

    date.high_low = [a.getHighBits(),a.getLowBits()];
    date.picoseconds = excess_100nano_second * 10000 +  picoseconds;
    return date.high_low;
}

exports.bn_dateToHundredNanoSecondFrom1601 = bn_dateToHundredNanoSecondFrom1601_fast;

exports.bn_dateToHundredNanoSecondFrom1601Excess = function bn_dateToHundredNanoSecondFrom1601Excess(data,picoseconds)
{
    // 100 nano seconds = 100 x 1000 picoseconds
    return  (picoseconds !== undefined) ? picoseconds % 100000 :0 ;

};

function bn_hundredNanoSecondFrom1601ToDate_fast(high, low , picoseconds) {
    assert(low !== undefined);
    //           value_64 / factor  - offset = t
    const l= new Long(low,high,/*unsigned*/true);
    const value1 = l.div(factor).toNumber()-offset;
    const date = new Date(value1);
    // enrich the date
    const excess_100nano_in_pico = l.mod(10000).mul(100000).toNumber();
    date.high_low = [high,low];
    // picosecond will contains un-decoded 100 nanoseconds => 10 x 100 nanoseconds = 1 microsecond
    date.picoseconds = excess_100nano_in_pico + ((picoseconds !=null )? picoseconds : 0);
    return date;
}

exports.bn_hundredNanoSecondFrom1601ToDate = bn_hundredNanoSecondFrom1601ToDate_fast;


let last_now_date = null;
let last_picoseconds = 0;
let small_tick_picosecond = 1000 * 100; // 100 nano second in picoseconds
/**
 *
 * @return {{timestamp: *, picoseconds: number}}
 */
function getCurrentClockWithJavascriptDate() {
    const now = new Date();
    if (last_now_date && now.getTime() === last_now_date.getTime()) {
        last_picoseconds += small_tick_picosecond; // add "100 nano" second which is hte resolution of OPCUA DateTime
    } else {
        last_picoseconds = 0;
        last_now_date = now;
    }
    return {
        timestamp: last_now_date,
        picoseconds: last_picoseconds
    };
}

const origin  = process.hrtime();
const refTime = Date.now();
const g_clock = {
    tick: [0,0],
    timestamp: new Date(),
    picoseconds: 0
};

// make sure we get a pointer to the actual process.hrtime, just in case it get overridden by some library (such as sinon)
const hrtime = process.hrtime;

function getCurrentClockWithProcessHRTime() {
    g_clock.tick = hrtime(origin); // [seconds, nanoseconds]
    const milliseconds = g_clock.tick[0] * 1000 + Math.floor(g_clock.tick[1] / 1000000) + refTime;
    const picoseconds = (g_clock.tick[1] % 1000000) * 1000;
    // display drift in seconds :
    //    console.log(g_clock.tick[0] - Math.floor((Date.now()-refTime) / 1000));

    g_clock.timestamp =new Date(milliseconds);
    g_clock.picoseconds= picoseconds;
    return g_clock;
}

const getCurrentClock = ( process.hrtime && true) ? getCurrentClockWithProcessHRTime: getCurrentClockWithJavascriptDate;


function coerceClock(timestamp, picoseconds) {
    if (timestamp) {
        return {
            timestamp: timestamp,
            picoseconds: picoseconds
        };
    } else {
        return getCurrentClock();
    }
}

exports.getCurrentClock = getCurrentClock;
exports.coerceClock = coerceClock;
