/**
 * @module node-opcua-date-time
 */
import { assert } from "node-opcua-assert";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import {
    bn_dateToHundredNanoSecondFrom1601,
    bn_hundredNanoSecondFrom1601ToDate,
    DateWithPicoseconds,
    minOPCUADate
} from "./date_time";

//  Date(year, month [, day, hours, minutes, seconds, ms])
export function isValidDateTime(value: any) {
    return value instanceof Date;
}

/**
 * return a random integer value in the range of  min inclusive and  max exclusive
 * @method getRandomInt
 * @param min
 * @param max
 * @return {*}
 * @private
 */
function getRandomInt(min: number, max: number) {
    // note : Math.random() returns a random number between 0 (inclusive) and 1 (exclusive):
    return Math.floor(Math.random() * (max - min)) + min;
}

export function randomDateTime() {
    const r = getRandomInt;
    return new Date(1900 + r(0, 200), r(0, 11), r(0, 28), r(0, 24), r(0, 59), r(0, 59), r(0, 1000));
}

/**
 *
 * @param date {Date}
 * @param picoseconds {null} {number of picoseconds to improve javascript date... }
 * @param stream {BinaryStream}
 */
export function encodeHighAccuracyDateTime(date: Date | null, picoseconds: number, stream: OutputBinaryStream) {
    if (date === null) {
        stream.writeUInt32(0);
        stream.writeUInt32(picoseconds % 100000);
        return;
    }
    const hl = bn_dateToHundredNanoSecondFrom1601(date, picoseconds);
    const hi = hl[0];
    const lo = hl[1];

    stream.writeInteger(lo);
    stream.writeInteger(hi);
}

export function encodeDateTime(date: Date | null, stream: OutputBinaryStream) {
    encodeHighAccuracyDateTime(date, 0, stream);
}

/**
 *
 * @param stream
 * @returns {Date}
 */
export function decodeDateTime(stream: BinaryStream, _value?: Date | null): DateWithPicoseconds {
    const lo = stream.readInteger();
    const hi = stream.readInteger();
    return bn_hundredNanoSecondFrom1601ToDate(hi, lo, 0, _value);
}
export const decodeHighAccuracyDateTime = decodeDateTime;

export function coerceDateTime(value: any): Date {
    if (!value) {
        return minOPCUADate;
    }
    if (value instanceof Date) {
        return value;
    }
    return new Date(value);
}
