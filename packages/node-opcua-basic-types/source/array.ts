/***
 * @module node-opcua-basic-types
 */
import { assert } from "node-opcua-assert";
import { BinaryStream, BinaryStreamSizeCalculator, OutputBinaryStream } from "node-opcua-binary-stream";

/**
 * @method encodeArray
 * @param arr     the array to encode.
 * @param stream  the stream.
 * @param encodeElementFunc   The  function to encode a single array element.
 */
export function encodeArray(
    arr: any[] | null,
    stream: OutputBinaryStream,
    encodeElementFunc: (value: any, stream: OutputBinaryStream) => void
): void {
    if (arr === null) {
        stream.writeUInt32(0xffffffff);
        return;
    }
    assert(Array.isArray(arr));
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
