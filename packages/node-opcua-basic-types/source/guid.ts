/***
 * @module node-opcua-basic-types
 */

import assert from "node-opcua-assert";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { emptyGuid, isValidGuid } from "node-opcua-guid";

import { getRandomInt } from "./utils";

export { isValidGuid, emptyGuid } from "node-opcua-guid";

function toHex(i: number, nb: number): string {
    return i.toString(16).padStart(nb, "0");
}

export type Guid = string;

export function randomGuid(): Guid {
    const b = new BinaryStream(20);
    for (let i = 0; i < 20; i++) {
        b.writeUInt8(getRandomInt(0, 255));
    }
    b.rewind();
    const value = decodeGuid(b) as Guid;
    return value;
}

//           1         2         3
// 012345678901234567890123456789012345
// |        |    |    | |  | | | | | |
// 12345678-1234-1234-ABCD-0123456789AB
// 00000000-0000-0000-0000-000000000000";

const hexCharToNum = (h: number): number => {
    // tslint:disable-next-line: no-bitwise
    const l = h & 0x5f;
    const r = l <= 25 ? l - 16 : l - 55;
    // xx assert(r >= 0 && r < 16);
    return r;
};
assert(hexCharToNum("A".charCodeAt(0)) === 10);
assert(hexCharToNum("a".charCodeAt(0)) === 10);
assert(hexCharToNum("b".charCodeAt(0)) === 11);
assert(hexCharToNum("B".charCodeAt(0)) === 11);
assert(hexCharToNum("0".charCodeAt(0)) === 0);
assert(hexCharToNum("9".charCodeAt(0)) === 9);
const doDebug = false;

function write_UInt32(stream: OutputBinaryStream, guid: string, starts: number[]) {
    const n = starts.length;
    for (let i = 0; i < n; i++) {
        const start = starts[i];
        const d1 = hexCharToNum(guid.charCodeAt(start));
        const d2 = hexCharToNum(guid.charCodeAt(start + 1));
        const d3 = hexCharToNum(guid.charCodeAt(start + 2));
        const d4 = hexCharToNum(guid.charCodeAt(start + 3));
        const d5 = hexCharToNum(guid.charCodeAt(start + 4));
        const d6 = hexCharToNum(guid.charCodeAt(start + 5));
        const d7 = hexCharToNum(guid.charCodeAt(start + 6));
        const d8 = hexCharToNum(guid.charCodeAt(start + 7));
        // tslint:disable-next-line: no-bitwise
        const value = (((((((((((((d1 << 4) | d2) << 4) | d3) << 4) | d4) << 4) | d5) << 4) | d6) << 4) | d7) << 4) | d8;
        stream.writeInteger(value);
    }
}

function write_UInt16(stream: OutputBinaryStream, guid: string, starts: number[]) {
    const n = starts.length;
    for (let i = 0; i < n; i++) {
        const start = starts[i];
        const d1 = hexCharToNum(guid.charCodeAt(start));
        const d2 = hexCharToNum(guid.charCodeAt(start + 1));
        const d3 = hexCharToNum(guid.charCodeAt(start + 2));
        const d4 = hexCharToNum(guid.charCodeAt(start + 3));
        // tslint:disable-next-line: no-bitwise
        const value = (((((d1 << 4) | d2) << 4) | d3) << 4) | d4;
        stream.writeUInt16(value);
    }
}

function write_UInt8(stream: OutputBinaryStream, guid: string, starts: number[]) {
    const n = starts.length;
    for (let i = 0; i < n; i++) {
        const start = starts[i];
        const d1 = hexCharToNum(guid.charCodeAt(start));
        const d2 = hexCharToNum(guid.charCodeAt(start + 1));
        // tslint:disable-next-line: no-bitwise
        const value = (d1 << 4) | d2;
        stream.writeUInt8(value);
    }
}

export function encodeGuid(guid: Guid, stream: OutputBinaryStream): void {
    if (!isValidGuid(guid)) {
        throw new Error(" Invalid GUID : '" + JSON.stringify(guid) + "'");
    }
    write_UInt32(stream, guid, [0]);
    write_UInt16(stream, guid, [9, 14]);
    write_UInt8(stream, guid, [19, 21, 24, 26, 28, 30, 32, 34]);
}

function read_UInt32(stream: BinaryStream) {
    return toHex(stream.readUInt32(), 8);
}

function read_UInt16(stream: BinaryStream) {
    return toHex(stream.readUInt16(), 4);
}

function read_UInt8(stream: BinaryStream) {
    return toHex(stream.readUInt8(), 2);
}

function read_many(stream: BinaryStream, func: (stream: BinaryStream) => string, nb: number): string {
    let result = "";
    for (let i = 0; i < nb; i++) {
        result += func(stream);
    }
    return result;
}

export function decodeGuid(stream: BinaryStream, value?: Guid): Guid {
    const data1 = read_UInt32(stream);

    const data2 = read_UInt16(stream);

    const data3 = read_UInt16(stream);

    const data45 = read_many(stream, read_UInt8, 2);

    const data6B = read_many(stream, read_UInt8, 6);

    const guid = data1 + "-" + data2 + "-" + data3 + "-" + data45 + "-" + data6B;

    return guid.toUpperCase();
}
