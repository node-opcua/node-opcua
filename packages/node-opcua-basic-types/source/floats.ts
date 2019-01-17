/***
 * @module node-opcua-basic-types
 */
import * as _ from "underscore";

import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";

const minFloat = -3.4 * Math.pow(10, 38);
const maxFloat = 3.4 * Math.pow(10, 38);

/**
 * return a random float value in the range of  min inclusive and  max exclusive
 * @method getRandomInt
 * @param min
 * @param max
 * @return {*}
 * @private
 */
function getRandomDouble(min: number, max: number) {
    return Math.random() * (max - min) + min;
}

export function isValidFloat(value: any): boolean {
    if (!_.isFinite(value)) {
        return false;
    }
    return value > minFloat && value < maxFloat;
}

export function roundToFloat2(float: number): number {
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
    const nbDigits = Math.ceil(Math.log(Math.abs(float)) / Math.log(10));
    const scale = Math.pow(10, -nbDigits + 2);
    return Math.round(float * scale) / scale;
}

const r = new Float32Array(1);

function roundToFloat(float: number): number {
    r[0] = float;
    const floatR = r[0];
    return floatR;
}

export type Float = number;

export function randomFloat(): Float {
    return roundToFloat(getRandomDouble(-1000, 1000));
}

export function encodeFloat(value: Float, stream: OutputBinaryStream): void {
    stream.writeFloat(value);
}

export function decodeFloat(stream: BinaryStream): Float {
    return stream.readFloat();
}

export function isValidDouble(value: any): boolean {
    if (!_.isFinite(value)) {
        return false;
    }
    return true;
}

export type Double = number;

export function randomDouble(): Double {
    return getRandomDouble(-1000000, 1000000);
}

export function encodeDouble(value: Double, stream: OutputBinaryStream) {
    stream.writeDouble(value);
}

export function decodeDouble(stream: BinaryStream) {
    return stream.readDouble();
}

export function coerceFloat(value: any): Float {
    if (value === null || value === undefined) {
        return value;
    }
    return parseFloat(value);
}

export function coerceDouble(value: any): Double {
    if (value === null || value === undefined) {
        return value;
    }
    return parseFloat(value);
}
