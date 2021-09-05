/***
 * @module node-opcua-basic-types
 */
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

export function isValidFloat(value: number): boolean {
    if (!isFinite(value)) {
        return false;
    }
    return value > minFloat && value < maxFloat;
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

export function decodeFloat(stream: BinaryStream, value?: number): Float {
    return stream.readFloat();
}

export function isValidDouble(value: number): boolean {
    if (!isFinite(value)) {
        return false;
    }
    return true;
}

export type Double = number;

export function randomDouble(): Double {
    return getRandomDouble(-1000000, 1000000);
}

export function encodeDouble(value: Double, stream: OutputBinaryStream): void {
    stream.writeDouble(value);
}

export function decodeDouble(stream: BinaryStream, value?: number): Double {
    return stream.readDouble();
}

export function coerceFloat(value: number | null | string): Float {
    if (value === null || value === undefined) {
        return 0.0;
    }
    if (typeof value === "number") {
        return value;
    }
    return parseFloat(value);
}

export function coerceDouble(value: number | null | string): Double {
    if (value === null || value === undefined) {
        return 0.0;
    }
    if (typeof value === "number") {
        return value;
    }
    return parseFloat(value);
}
