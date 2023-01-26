/**
 * @module node-opcua-date-time
 */
import * as long from "long";
import { assert } from "node-opcua-assert";
import { hrtime } from "node-opcua-utils";

export interface DateWithPicoseconds extends Date {
    picoseconds: number;
    high_low: [number, number];
}

export const offsetFactor1601 = (function offset_factor_1601() {
    const utc1600 = new Date(Date.UTC(1601, 0, 1, 0, 0, 0));
    const t1600 = utc1600.getTime();

    const utc1600PlusOneDay = new Date(Date.UTC(1601, 0, 2, 0, 0, 0));
    const t1600OneDay = utc1600PlusOneDay.getTime();

    const factor1 = (24 * 60 * 60 * 1000 * 10000) / (t1600OneDay - t1600);

    const utc1970 = new Date(Date.UTC(1970, 0, 1, 0, 0, 0));
    const t1970 = utc1970.getTime();

    const offsetToGregorianCalendarZero = -t1600 + t1970;

    assert(factor1 === 10000);
    assert(offsetToGregorianCalendarZero === 11644473600000);
    return [offsetToGregorianCalendarZero, factor1];
})();

const offset = offsetFactor1601[0];
const factor = offsetFactor1601[1];

const offsetLong = long.fromNumber(offset, true);
const factorLong = long.fromNumber(factor, true);

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
 * @param date        {Date}
 * @param picoseconds {Number} : represent the portion of the date that cannot be managed by the javascript Date object
 *
 * @returns {[high,low]}
 */
export function bn_dateToHundredNanoSecondFrom1601(date: Date, picoseconds: number) {
    assert(date instanceof Date);
    if ((date as any).high_low) {
        return (date as any).high_low;
    }
    // note : The value returned by the getTime method is the number
    //        of milliseconds since 1 January 1970 00:00:00 UTC.
    //
    const t = date.getTime(); // number of milliseconds since since 1 January 1970 00:00:00 UTC.
    const excess100nanosecond = picoseconds !== undefined ? Math.floor(picoseconds / 100000) : 0;

    //           value_64 = (t + offset ) * factor;
    const tL = long.fromNumber(t, false);
    const a = tL.add(offsetLong).multiply(factorLong).add(excess100nanosecond);

    (date as any).high_low = [a.getHighBits(), a.getLowBits()];
    (date as any).picoseconds = excess100nanosecond * 10000 + +picoseconds;
    return (date as any).high_low;
}

export function bn_dateToHundredNanoSecondFrom1601Excess(date: Date, picoseconds: number): number {
    // 100 nano seconds = 100 x 1000 picoseconds
    return (picoseconds || 0) % 100000;
}

export function bn_hundredNanoSecondFrom1601ToDate(
    high: number,
    low: number,
    picoseconds = 0,
    _value: Date | null = null
): DateWithPicoseconds {
    assert(low !== undefined);
    //           value_64 / factor  - offset = t
    const l = new long(low, high, /*unsigned*/ true);
    const value1 = l.div(factor).toNumber() - offset;
    // const date = _value || new Date(value1);
    // if (_value) _value.setTime(value1);
    const date = new Date(value1);
    // enrich the date
    const excess100nanoInPico = l.mod(10000).mul(100000).toNumber();
    (date as any).high_low = [high, low];
    // picosecond will contains un-decoded 100 nanoseconds => 10 x 100 nanoseconds = 1 microsecond
    (date as any).picoseconds = excess100nanoInPico + (picoseconds || 0);
    return date as DateWithPicoseconds;
}

let lastNowDate: Date;
let lastPicoseconds = 0;
const smallTickPicosecond: number = 1000 * 100; // 100 nano second in picoseconds

export interface PreciseClock {
    timestamp: DateWithPicoseconds;
    picoseconds: number;
}

export interface PreciseClockEx extends PreciseClock {
    tick: number[];
}

/**
 *
 * @return PreciseClock
 */
export function getCurrentClockWithJavascriptDate(): PreciseClock {
    const now = new Date();
    if (lastNowDate && now.getTime() === lastNowDate.getTime()) {
        lastPicoseconds += smallTickPicosecond; // add 100-nano-second which is the resolution of OPCUA DateTime
    } else {
        lastPicoseconds = 0;
        lastNowDate = now;
    }
    return {
        timestamp: lastNowDate as DateWithPicoseconds,

        picoseconds: lastPicoseconds
    };
}

let origin = hrtime();
let refTime = Date.now();

export const periodicClockAdjustment = {
    adjustmentCount: 0,
    interval: 3000, /* every 30 seconds */
    timerInstallationCount: 0,
};
// update refTime now and then to make sure that we don't miss
// any system time adjustment here such as a NTP clock event
// see #651
let timerId: NodeJS.Timeout | null;
const g_setInterval = (typeof global === "object") ? global.setInterval : setInterval;
const g_clearInterval = (typeof global === "object") ? global.clearInterval: clearInterval;
export function installPeriodicClockAdjustment() {
    periodicClockAdjustment.timerInstallationCount++;
    if (timerId) {
        return;
    }
    timerId = g_setInterval(() => {
        origin = hrtime();
        refTime = Date.now();
        periodicClockAdjustment.adjustmentCount++;
    }, periodicClockAdjustment.interval);
}
export function uninstallPeriodicClockAdjustment() {
    periodicClockAdjustment.timerInstallationCount--;
    if (periodicClockAdjustment.timerInstallationCount <= 0) {
        g_clearInterval(timerId!);
        timerId = null;
    }
}

const gClock: PreciseClockEx = {
    tick: [0, 0],
    timestamp: new Date() as DateWithPicoseconds,

    picoseconds: 0
};

// make sure we get a pointer to the actual process.hrtime,
// just in case it get overridden by some library (such as sinon)
const original_hrtime = hrtime;

const setTimeout_check = setTimeout;
/*kWithProcessHRTime*/
export function getCurrentClock(): PreciseClock {
    if (setTimeout_check !== setTimeout) {
        // is fake sinon clock being used ?
        // in this case hrtime is not working
        return getCurrentClockWithJavascriptDate();
    }
    gClock.tick = original_hrtime(origin); // [seconds, nanoseconds]
    const milliseconds = gClock.tick[0] * 1000 + Math.floor(gClock.tick[1] / 1000000) + refTime;
    const picoseconds = (gClock.tick[1] % 1000000) * 1000;
    // display drift in seconds :
    //    console.log(gClock.tick[0] - Math.floor((Date.now()-refTime) / 1000));

    gClock.timestamp = new Date(milliseconds) as DateWithPicoseconds;
    gClock.picoseconds = picoseconds;
    return gClock;
}

export function coerceClock(timestamp: undefined | null | DateWithPicoseconds | Date, picoseconds = 0): PreciseClock {
    if (timestamp) {
        return { timestamp: timestamp as DateWithPicoseconds, picoseconds };
    } else {
        return getCurrentClock();
    }
}
 
export const minDate = new Date(Date.UTC(1601, 0, 1, 0, 0, 0));

export const minOPCUADate = minDate;

export function isMinDate(date?: Date | null): boolean {
    return !date || date.getTime() === minDate.getTime();
}
