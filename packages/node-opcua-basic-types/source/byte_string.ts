/***
 * @module node-opcua-basic-types
 */
import * as _ from "underscore";

import { BinaryStream } from "node-opcua-binary-stream";
import { createFastUninitializedBuffer }  from "node-opcua-buffer-utils";

import { getRandomInt } from "./utils";

export function isValidByteString(value: any): boolean {
    return value === null || value instanceof Buffer;
}

export type ByteString = Buffer;

export function randomByteString(value: any, len: number): ByteString {
    len = len || getRandomInt(1, 200);
    const b = createFastUninitializedBuffer(len);
    for (let i = 0; i < len; i++) {
        b.writeUInt8(getRandomInt(0, 255), i);
    }
    return b;
}

export function encodeByteString(byteString: ByteString, stream: BinaryStream) {
    stream.writeByteStream(byteString);
}

export function decodeByteString(stream: BinaryStream): ByteString {
    return stream.readByteStream() as ByteString;
}

export function coerceByteString(value: any): ByteString {
    if (_.isArray(value)) {
        return Buffer.from(value);
    }
    if (typeof value === "string") {
        return Buffer.from(value, "base64");
    }
    return value;
}
