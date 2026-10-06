import Long from "long";
import should from "should";
import { bn_dateToHundredNanoSecondFrom1601, bn_hundredNanoSecondFrom1601ToDate, offsetFactor1601 } from "../dist/index.js";

/**
 * The DateTime conversions compute on plain numbers. They must give, bit for bit, what the
 * 64-bit arithmetic of the `long` package gave: these are that arithmetic, as it was written.
 */
const [offset, factor] = offsetFactor1601;
const offsetLong = Long.fromNumber(offset, true);
const factorLong = Long.fromNumber(factor, true);

function referenceEncode(date: Date, picoseconds?: number): number[] {
    const t = date.getTime();
    const excess100nanosecond = picoseconds !== undefined ? Math.floor(picoseconds / 100000) : 0;
    const a = Long.fromNumber(t, false).add(offsetLong).multiply(factorLong).add(excess100nanosecond);
    return [a.getHighBits(), a.getLowBits()];
}

function referenceDecode(high: number, low: number, picoseconds = 0): [number, number] {
    const l = new Long(low, high, true);
    const value1 = l.div(factor).toNumber() - offset;
    const excess100nanoInPico = l.mod(10000).mul(100000).toNumber();
    return [value1, excess100nanoInPico + (picoseconds || 0)];
}

/** a seeded generator, so that a failure can be replayed */
function makeRandom(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

const maxTime = 8.64e15; // the range of a javascript Date, in ms either side of 1970

function checkEncode(date: Date, picoseconds?: number) {
    const expected = referenceEncode(date, picoseconds);
    const actual = bn_dateToHundredNanoSecondFrom1601(date, picoseconds);
    should(actual).eql(expected, `encode ${date.getTime()} ps=${picoseconds}`);
}

function checkDecode(high: number, low: number, picoseconds?: number) {
    const [expectedTime, expectedPicoseconds] = referenceDecode(high, low, picoseconds);
    const [date, actualPicoseconds] = bn_hundredNanoSecondFrom1601ToDate(high, low, picoseconds);
    should(Object.is(date.getTime(), new Date(expectedTime).getTime())).eql(
        true,
        `decode ${high},${low}: ${date.getTime()} vs ${expectedTime}`
    );
    should(actualPicoseconds).eql(expectedPicoseconds, `decode picoseconds ${high},${low}`);
}

describe("DTE - DateTime conversions give what 64-bit arithmetic gave", () => {
    it("DTE-1 encodes the edge dates the same", () => {
        const dates = [
            new Date(Date.UTC(1601, 0, 1)),
            new Date(Date.UTC(1601, 0, 1, 0, 0, 0, 1)),
            new Date(Date.UTC(1600, 11, 31, 23, 59, 59, 999)),
            new Date(Date.UTC(1970, 0, 1)),
            new Date(-1),
            new Date(Date.UTC(9999, 11, 31, 23, 59, 59, 999)),
            new Date(maxTime),
            new Date(-maxTime),
            new Date(Number.NaN)
        ];
        for (const date of dates) {
            for (const picoseconds of [undefined, 0, 99999, 100000, 999999, -100000, -1, 1e20, Number.NaN]) {
                checkEncode(date, picoseconds);
            }
        }
    });

    it("DTE-2 encodes random dates over the whole Date range the same", () => {
        const random = makeRandom(1601);
        for (let i = 0; i < 200000; i++) {
            const t = Math.floor((random() * 2 - 1) * maxTime);
            const picoseconds = i % 3 === 0 ? undefined : Math.floor(random() * 1000000);
            checkEncode(new Date(t), picoseconds);
        }
    });

    it("DTE-3 decodes the edge values the same", () => {
        const words = [0, 1, -1, 0x7fffffff, -0x80000000, 9999, 10000, 0x019db1de, -0x2ac18000];
        for (const high of words) {
            for (const low of words) {
                checkDecode(high, low);
                checkDecode(high, low, 12345);
            }
        }
    });

    it("DTE-4 decodes random 64-bit values the same", () => {
        const random = makeRandom(1970);
        for (let i = 0; i < 200000; i++) {
            const high = (random() * 0x100000000) | 0;
            const low = (random() * 0x100000000) | 0;
            checkDecode(high, low, i % 2 ? 0 : Math.floor(random() * 100000));
        }
    });

    it("DTE-5 a date and its picoseconds survive a round trip", () => {
        const random = makeRandom(2026);
        const from1601 = Date.UTC(1601, 0, 1);
        const to9999 = Date.UTC(9999, 11, 31);
        for (let i = 0; i < 100000; i++) {
            const t = from1601 + Math.floor(random() * (to9999 - from1601));
            // a whole number of 100 ns ticks, under one millisecond
            const picoseconds = Math.floor(random() * 10000) * 100000;
            const [high, low] = bn_dateToHundredNanoSecondFrom1601(new Date(t), picoseconds);
            const [date, picosecondsBack] = bn_hundredNanoSecondFrom1601ToDate(high, low);
            should(date.getTime()).eql(t);
            should(picosecondsBack).eql(picoseconds);
        }
    });
});
