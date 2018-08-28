/***
 * @module node-opcua-basic-types
 */

import { BinaryStream } from "node-opcua-binary-stream";
import { emptyGuid, isValidGuid } from "node-opcua-guid";

import { getRandomInt } from "./utils";

export { isValidGuid, emptyGuid } from "node-opcua-guid";

function toHex(i: number, nb: number): string {
    return ("000000000000000" + i.toString(16)).substr(-nb);
}

export type Guid = string;

export  function randomGuid(): Guid {
    const b = new BinaryStream(20);
    for (let i = 0; i < 20; i++) {
        b.writeUInt8(getRandomInt(0, 255));
    }
    b.rewind();
    const value = decodeGuid(b) as Guid;
    return value;
}

export function encodeGuid(guid: Guid, stream: BinaryStream): void {
    if (!isValidGuid(guid)) {
        throw new Error(" Invalid GUID : '" + JSON.stringify(guid) + "'");
    }
    //           1         2         3
    // 012345678901234567890123456789012345
    // |        |    |    | |  | | | | | |
    // 12345678-1234-1234-ABCD-0123456789AB
    // 00000000-0000-0000-0000-000000000000";
    function write_UInt32(starts: number[]) {
        const n = starts.length;
        for (let i = 0; i < n; i++) {
            const start = starts[i];
            stream.writeUInt32(parseInt(guid.substr(start, 8), 16));
        }
    }

    function write_UInt16(starts: number[]) {
        const n = starts.length;
        for (let i = 0; i < n; i++) {
            const start = starts[i];
            stream.writeUInt16(parseInt(guid.substr(start, 4), 16));
        }
    }

    function write_UInt8(starts: number[]) {
        const n = starts.length;
        for (let i = 0; i < n; i++) {
            const start = starts[i];
            stream.writeUInt8(parseInt(guid.substr(start, 2), 16));
        }
    }

    write_UInt32([0]);
    write_UInt16([9, 14]);
    write_UInt8([19, 21, 24, 26, 28, 30, 32, 34]);
}

export function decodeGuid(stream: BinaryStream): Guid {
    function read_UInt32() {
        return toHex(stream.readUInt32(), 8);
    }

    function read_UInt16() {
        return toHex(stream.readUInt16(), 4);
    }

    function read_UInt8() {
        return toHex(stream.readUInt8(), 2);
    }

    function read_many(func: () => string, nb: number): string {
        let result = "";
        for (let i = 0; i < nb; i++) {
            result += func();
        }
        return result;
    }

    const data1 = read_UInt32();

    const data2 = read_UInt16();

    const data3 = read_UInt16();

    const data45 = read_many(read_UInt8, 2);

    const data6B = read_many(read_UInt8, 6);

    const guid = data1 + "-" + data2 + "-" + data3 + "-" + data45 + "-" + data6B;

    return guid.toUpperCase();
}
