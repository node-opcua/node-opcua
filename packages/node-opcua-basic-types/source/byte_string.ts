/***
 * @module node-opcua-basic-types
 */
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { createFastUninitializedBuffer } from "node-opcua-buffer-utils";

import { getRandomInt } from "./utils";

export function isValidByteString(value: unknown): boolean {
    return value === null || value instanceof Buffer;
}

export type ByteString = Buffer;

export function randomByteString(value: unknown, len: number): ByteString {
    len = len || getRandomInt(1, 200);
    const b = createFastUninitializedBuffer(len);
    for (let i = 0; i < len; i++) {
        b.writeUInt8(getRandomInt(0, 255), i);
    }
    return b;
}

export function encodeByteString(byteString: ByteString, stream: OutputBinaryStream): void {
    stream.writeByteStream(byteString);
}

export function decodeByteString(stream: BinaryStream, _value?: ByteString): ByteString {
    return stream.readByteStream() as ByteString;
}

export function coerceByteString(value: number[] | string | ByteString): ByteString {
    if (Array.isArray(value)) {
        return Buffer.from(value);
    }
    if (typeof value === "string") {
        return Buffer.from(value, "base64");
    }
    return value;
}
