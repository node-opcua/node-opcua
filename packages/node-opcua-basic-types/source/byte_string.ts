/***
 * @module node-opcua-basic-types
 */
import type { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { createFastUninitializedBuffer } from "node-opcua-buffer-utils";

import { getRandomInt, getRandomIntInclusive } from "./utils";

export function isValidByteString(value: unknown): boolean {
    return value === null || value instanceof Buffer;
}

/**
 * @public
 */
export type ByteString = Buffer;

export function randomByteString(_value: unknown, len: number): ByteString {
    len = len || getRandomInt(1, 200);
    const b = createFastUninitializedBuffer(len);
    for (let i = 0; i < len; i++) {
        b.writeUInt8(getRandomIntInclusive(0, 0xff), i);
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
    // Copy rather than adopt the caller's Buffer. A structure built from an existing
    // ByteString used to alias it, so cloning an ExtensionObject that carries one - which
    // is how the server records a sampled value - produced a "clone" that still followed
    // later writes to the original buffer.
    //
    // The decode path does not come through here (decodeByteString reads from the stream
    // directly), so this costs nothing on the wire path.
    if (Buffer.isBuffer(value)) {
        return Buffer.from(value);
    }
    return value;
}
