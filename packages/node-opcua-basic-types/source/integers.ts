/***
 * @module node-opcua-basic-types
 */
import { assert } from "node-opcua-assert";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { getRandomInt } from "./utils";

export function isValidUInt16(value: number): boolean {
    if (!isFinite(value)) {
        return false;
    }
    return value >= 0 && value <= 0xffff;
}

export type UInt8 = number;
export type UInt16 = number;
export type UInt32 = number;
export type UInt64 = UInt32[];

export type Int8 = number;
export type Int16 = number;
export type Int32 = number;
export type Int64 = UInt32[];

export type Byte = UInt8;
export type SByte = Int8;

// ---------------------------------------

export function randomUInt16(): UInt16 {
    return getRandomInt(0, 0xffff) as UInt16;
}

export function encodeUInt16(value: UInt16, stream: OutputBinaryStream): void {
    stream.writeUInt16(value);
}

export function decodeUInt16(stream: BinaryStream, value?: number): UInt16 {
    return stream.readUInt16() as UInt16;
}

export function isValidInt16(value: number): boolean {
    if (!isFinite(value)) {
        return false;
    }
    return value >= -0x8000 && value <= 0x7fff;
}

export function randomInt16(): Int16 {
    return getRandomInt(-0x8000, 0x7fff);
}

export function encodeInt16(value: Int16, stream: OutputBinaryStream): void {
    assert(isFinite(value));
    stream.writeInt16(value);
}

export function decodeInt16(stream: BinaryStream, value?: number): Int16 {
    return stream.readInt16() as Int16;
}

export function isValidInt32(value: number): boolean {
    if (!isFinite(value)) {
        return false;
    }
    return value >= -0x80000000 && value <= 0x7fffffff;
}

export function randomInt32(): Int32 {
    return getRandomInt(-0x80000000, 0x7fffffff) as Int32;
}

export function encodeInt32(value: Int32, stream: OutputBinaryStream): void {
    assert(isFinite(value));
    stream.writeInteger(value);
}

export function decodeInt32(stream: BinaryStream, value?: number): Int32 {
    return stream.readInteger() as Int32;
}

export function isValidUInt32(value: number): boolean {
    if (!isFinite(value)) {
        return false;
    }
    return value >= 0 && value <= 0xffffffff;
}

export function randomUInt32(): UInt32 {
    return getRandomInt(0, 0xffffffff);
}

export function encodeUInt32(value: UInt32, stream: OutputBinaryStream): void {
    stream.writeUInt32(value);
}

export function decodeUInt32(stream: BinaryStream, value?: number): UInt32 {
    return stream.readUInt32() as UInt32;
}

export function isValidInt8(value: number): boolean {
    if (!isFinite(value)) {
        return false;
    }
    return value >= -0x80 && value <= 0x7f;
}

export function randomInt8(): Int8 {
    return getRandomInt(-0x7f, 0x7e);
}

export function encodeInt8(value: Int8, stream: OutputBinaryStream): void {
    assert(isValidInt8(value));
    stream.writeInt8(value);
}

export function decodeInt8(stream: BinaryStream, value?: number): Int8 {
    return stream.readInt8();
}

export const isValidSByte = isValidInt8;
export const randomSByte = randomInt8;
export const encodeSByte = encodeInt8;
export const decodeSByte = decodeInt8;

export function isValidUInt8(value: number): boolean {
    if (!isFinite(value)) {
        return false;
    }
    return value >= 0x00 && value <= 0xff;
}

export function randomUInt8(): UInt8 {
    return getRandomInt(0x00, 0xff);
}

export function encodeUInt8(value: UInt8, stream: OutputBinaryStream): void {
    stream.writeUInt8(value);
}

export function decodeUInt8(stream: BinaryStream, value?: number): UInt8 {
    return stream.readUInt8();
}

export const isValidByte = isValidUInt8;
export const randomByte = randomUInt8;
export const encodeByte = encodeUInt8;
export const decodeByte = decodeUInt8;

export function isValidUInt64(value?: number | number[]): boolean {
    return value instanceof Array && value.length === 2;
}

export function randomUInt64(): UInt64 {
    return [getRandomInt(0, 0xffffffff), getRandomInt(0, 0xffffffff)];
}

export function encodeUInt64(value: UInt64 | number, stream: OutputBinaryStream): void {
    if (typeof value === "number") {
        const arr = coerceUInt64(value);
        stream.writeUInt32(arr[1]);
        stream.writeUInt32(arr[0]);
    } else {
        stream.writeUInt32((value as number[])[1]);
        stream.writeUInt32((value as number[])[0]);
    }
}

export function decodeUInt64(stream: BinaryStream, value?: UInt64): UInt64 {
    const low = stream.readUInt32() as UInt32;
    const high = stream.readUInt32() as UInt32;
    return constructInt64(high, low);
}

export function constructInt64(high: UInt32, low: UInt32): Int64 {
    if (high === 0 && low < 0) {
        high = 0xffffffff;
        low = 0xffffffff + low + 1;
    }
    assert(low >= 0 && low <= 0xffffffff);
    assert(high >= 0 && high <= 0xffffffff);
    return [high, low];
}

export function coerceUInt64(value: number | UInt64 | Int32 | string | null): UInt64 {
    let high;
    let low;
    let v;
    if (value === null || value === undefined) {
        return [0, 0];
    }
    if (value instanceof Array) {
        assert(typeof value[0] === "number");
        assert(typeof value[1] === "number");
        return value;
    }
    if (typeof value === "string") {
        v = value.split(",");
        if (v.length === 1) {
            // was a single string, good news ! BigInt can be used with nodejs >=12
            let a = BigInt(value);
            if (a < BigInt(0)) {
                const mask = BigInt("0xFFFFFFFFFFFFFFFF");
                a = (mask + a + BigInt(1)) & mask;
            }
            high = Number(a >> BigInt(32));
            low = Number(a & BigInt(0xffffffff));
        } else {
            high = parseInt(v[0], 10);
            low = parseInt(v[1], 10);
        }
        return constructInt64(high, low);
    }
    if (value > 0xffffffff) {
        // beware : as per javascript, value is a double here !
        //          our conversion will suffer from some inaccuracy
        high = Math.floor(value / 0x100000000);
        low = value - high * 0x100000000;
        return constructInt64(high, low);
    }
    return constructInt64(0, value);
}

export function randomInt64(): Int64 {
    // High, low
    return [getRandomInt(0, 0xffffffff), getRandomInt(0, 0xffffffff)];
}

export const coerceInt64 = coerceUInt64;
export const isValidInt64 = isValidUInt64;
export const encodeInt64 = encodeUInt64;
export const decodeInt64 = decodeUInt64;

export function coerceInt8(value: number | string | null): Int8 {
    if (value === null || value === undefined) {
        return 0;
    }
    if (typeof value === "number") {
        return value;
    }
    return parseInt(value, 10);
}

export function coerceUInt8(value: number | string | null): UInt8 {
    if (value === null || value === undefined) {
        return 0;
    }
    if (typeof value === "number") {
        return value;
    }
    return parseInt(value, 10);
}

export function coerceByte(value: number | string | null): UInt8 {
    if (value === null || value === undefined) {
        return 0;
    }
    if (typeof value === "number") {
        return value;
    }
    return parseInt(value, 10);
}

export function coerceSByte(value: number | string | null): Int8 {
    if (value === null || value === undefined) {
        return 0;
    }
    if (typeof value === "number") {
        return value;
    }
    return parseInt(value, 10);
}

export function coerceUInt16(value: number | string | null): UInt16 {
    if (value === null || value === undefined) {
        return 0;
    }
    if (typeof value === "number") {
        return value;
    }
    return parseInt(value, 10);
}

export function coerceInt16(value: number | string | null): Int16 {
    if (value === null || value === undefined) {
        return 0;
    }
    if (typeof value === "number") {
        return value;
    }
    return parseInt(value, 10);
}

interface EnumItemLike {
    value: number;
}
export function coerceUInt32(value: null | string | number | EnumItemLike): UInt32 {
    if (value === null || value === undefined) {
        return 0;
    }
    if (value && Object.prototype.hasOwnProperty.call(value, "value")) {
        // xx assert(value.constructor.name === "EnumItem");
        return coerceUInt32((value as EnumItemLike).value);
    }
    if (typeof value === "number") {
        return value;
    }
    return parseInt(value as string, 10);
}

export function coerceInt32(value: null | Int64 | UInt64 | number | string): Int32 {
    if (value === null || value === undefined) {
        return 0;
    }
    if (value instanceof Array) {
        // Int64 as a [high,low]
        return value[1] + value[0] * 0xffffffff;
    }
    if (typeof value === "number") {
        return value;
    }
    return parseInt(value, 10);
}
