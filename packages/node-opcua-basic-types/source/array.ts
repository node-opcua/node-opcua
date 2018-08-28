/***
 * @module node-opcua-basic-types
 */
import assert from "node-opcua-assert";
import { BinaryStream } from "node-opcua-binary-stream" ;
import * as _ from "underscore";

/**
 * @method encodeArray
 * @param arr {Array} the array to encode.
 * @param stream {BinaryStream}  the stream.
 * @param encodeElementFunc   The  function to encode a single array element.
 */
export function encodeArray(
    arr: any[] | null,
    stream: BinaryStream,
    encodeElementFunc: (value: any, stream: BinaryStream) => void): void {
    if (arr === null) {
        stream.writeUInt32(0xffffffff);
        return;
    }
    assert(_.isArray(arr));
    stream.writeUInt32(arr.length);
    for (const value of arr) {
        encodeElementFunc(value, stream);
    }
}

/**
 * decode an array from a BinaryStream
 * @param stream  the stream.
 * @param decodeElementFunc   The  function to decode a single array element.
 *                            This function returns the element decoded from the stream
 * @returns an array of elements or nul
 */
export function decodeArray(stream: BinaryStream, decodeElementFunc: (stream: BinaryStream) => any): any[] | null {
    const length = stream.readUInt32();
    if (length === 0xffffffff) {
        return null;
    }
    const arr = [];
    for (let i = 0; i < length; i++) {
        arr.push(decodeElementFunc(stream));
    }
    return arr;
}
