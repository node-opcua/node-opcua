/***
 * @module node-opcua-basic-types
 */
import { assert } from "node-opcua-assert";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream" ;
import * as _ from "underscore";
import { getRandomInt } from "./utils" ;

export function isValidUInt16(value: any): boolean {
    if (!_.isFinite(value)) {
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

export function decodeUInt16(stream: BinaryStream): UInt16 {
    return stream.readUInt16() as UInt16;
}

export function isValidInt16(value: any): boolean {
    if (!_.isFinite(value)) {
        return false;
    }
    return value >= -0x8000 && value <= 0x7fff;
}

export function randomInt16(): Int16 {
    return getRandomInt(-0x8000, 0x7fff);
}

export function encodeInt16(value: Int16, stream: OutputBinaryStream): void {
    assert(_.isFinite(value));
    stream.writeInt16(value);
}

export function decodeInt16(stream: BinaryStream): Int16 {
    return stream.readInt16() as Int16;
}

export function isValidInt32(value: any): boolean {
    if (!_.isFinite(value)) {
        return false;
    }
    return value >= -0x80000000 && value <= 0x7fffffff;
}

export function randomInt32(): Int32 {
    return getRandomInt(-0x80000000, 0x7fffffff) as Int32;
}

export function encodeInt32(value: Int32, stream: OutputBinaryStream): void {
    assert(_.isFinite(value));
    stream.writeInteger(value);
}

export function decodeInt32(stream: BinaryStream): Int32 {
    return stream.readInteger() as Int32;
}

export function isValidUInt32(value: any): boolean {
    if (!_.isFinite(value)) {
        return false;
    }
    return value >= 0 && value <= 0xffffffff;
}

export function randomUInt32(): UInt32 {
    return getRandomInt(0, 0xffffffff);
}

export function encodeUInt32(value: UInt32, stream: OutputBinaryStream) {
    stream.writeUInt32(value);
}

export function decodeUInt32(stream: BinaryStream): UInt32 {
    return stream.readUInt32() as UInt32;
}

export function isValidInt8(value: any): boolean {
    if (!_.isFinite(value)) {
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

export function decodeInt8(stream: BinaryStream): Int8 {
    return stream.readInt8();
}

export const isValidSByte = isValidInt8;
export const randomSByte = randomInt8;
export const encodeSByte = encodeInt8;
export const decodeSByte = decodeInt8;

export function isValidUInt8(value: any): boolean {
    if (!_.isFinite(value)) {
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

export function decodeUInt8(stream: BinaryStream): UInt8 {
    return stream.readUInt8();
}

export const isValidByte = isValidUInt8;
export const randomByte = randomUInt8;
export const encodeByte = encodeUInt8;
export const decodeByte = decodeUInt8;

export function isValidUInt64(value: any): boolean {
    return value instanceof Array && value.length === 2;
}

export function randomUInt64(): UInt64 {
    return [getRandomInt(0, 0xffffffff), getRandomInt(0, 0xffffffff)];
}

export function encodeUInt64(value: UInt64 | number, stream: OutputBinaryStream) {
    if (_.isNumber(value)) {
        const arr = coerceUInt64(value);
        stream.writeUInt32(arr[1]);
        stream.writeUInt32(arr[0]);
    } else {
        stream.writeUInt32((value as number[])[1]);
        stream.writeUInt32((value as number[])[0]);
    }
}
export function encodeInt64(value: Int64 | number, stream: OutputBinaryStream) {
    if (_.isNumber(value)) {
        const arr = coerceInt64(value);
        stream.writeUInt32(arr[1]);
        stream.writeUInt32(arr[0]);
    } else {
        stream.writeUInt32((value as number[])[1]);
        stream.writeUInt32((value as number[])[0]);
    }
}


export function decodeUInt64(stream: BinaryStream): UInt64 {
    const low = stream.readUInt32() as UInt32;
    const high = stream.readUInt32() as UInt32;
    return constructInt64(high, low);
}

export function constructInt64(high: UInt32, low: UInt32) {
    assert(low >= 0 && low <= 0xffffffff);
    assert(high >= 0 && high <= 0xffffffff);
    return [high, low];
}

const FFFFFFFFFFFFFFFF = BigInt("0xFFFFFFFFFFFFFFFF");
const FFFFFFFF00000000 = BigInt("0xFFFFFFFF00000000");
const H100000000 = BigInt("0x100000000");
const FFFFFFFF = BigInt("0xFFFFFFFF");

// tslint:disable:no-bitwise
export function coerceUInt64(value: any): UInt64 {
    let high;
    let low;
    let v;
    if (value === null || value === undefined) {
        return value;
    }
    if (value instanceof Array) {
        assert(_.isNumber(value[0]));
        assert(_.isNumber(value[1]));
        return value;
    }
    if (typeof(value) === "string") {
        v = value.split(",");
        high = parseInt(v[0], 10);
        low = parseInt(v[1], 10);
        return constructInt64(high, low);
    }
    if (typeof value === "number" || (value && value.constructor && value.constructor.name === "BigInt")) {
        const bnValue = BigInt(value);
        if (bnValue < BigInt(0)) {
            throw new Error("Value is negative and canno be coerced to UInt64 " + value);
        }
        const h = (bnValue & FFFFFFFF00000000 ) / H100000000;
        const l = (bnValue & FFFFFFFF);
        return [Number(h) , Number(l)];
    }
    return constructInt64(0, value);
}

export function coerceInt64(value: any): Int64 {
    if (typeof value === "number" || (value && value.constructor && value.constructor.name === "BigInt")) {
        const a = value < 0 ? FFFFFFFFFFFFFFFF  + BigInt(value)  + BigInt(1) : BigInt(value);
        const h = (a & FFFFFFFF00000000 ) / H100000000;
        const l = (a & FFFFFFFF);
        return [Number(h) , Number(l)];
    }
    return coerceUInt64(value) as Int64;
}
export function randomInt64(): Int64 {
    // High, low
    return [getRandomInt(0, 0xffffffff), getRandomInt(0, 0xffffffff)];
}

export const isValidInt64 = isValidUInt64;
export const decodeInt64 = decodeUInt64;

export function coerceInt8(value: any): Int8 {
    if (value === null || value === undefined) {
        return value;
    }
    return parseInt(value, 10);
}

export function coerceUInt8(value: any): UInt8 {
    if (value === null || value === undefined) {
        return value;
    }
    return parseInt(value, 10);
}

export function coerceByte(value: any): UInt8 {
    if (value === null || value === undefined) {
        return value;
    }
    return parseInt(value, 10);
}

export function coerceSByte(value: any): Int8 {
    if (value === null || value === undefined) {
        return value;
    }
    return parseInt(value, 10);
}

export function coerceUInt16(value: any): UInt16 {
    if (value === null || value === undefined) {
        return value;
    }
    return parseInt(value, 10);
}

export function coerceInt16(value: any): Int16 {
    if (value === null || value === undefined) {
        return value;
    }
    return parseInt(value, 10);
}

export function coerceUInt32(value: any): UInt32 {
    if (value === null || value === undefined) {
        return value;
    }
    if (value.hasOwnProperty("value")) {
        assert(value.constructor.name === "EnumItem");
        return parseInt(value.value, 10);
    }
    return parseInt(value, 10);
}

export function coerceInt32(value: any): Int32 {
    if (value === null || value === undefined) {
        return value;
    }
    if (value.length === 2 && (typeof value[0] === "number") && (typeof value[1] === "number")) {
        // Int64 as a [high,low]
        return value[1]  + value[0] * 0xFFFFFFFF;
    }
    return parseInt(value, 10);
}
