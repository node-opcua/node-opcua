import assert from "node-opcua-assert";
import type { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";

export function defaultEncode(_value: unknown, _stream: OutputBinaryStream): void {
    /** */
}

export function defaultDecode(_stream: BinaryStream): unknown {
    return null;
}

export function defaultGuidValue(): Buffer {
    return Buffer.alloc(0);
}

export function toJSONGuid(value: unknown): unknown {
    if (typeof value === "string") {
        return value;
    }
    assert(value instanceof Buffer);
    return (value as Buffer).toString("base64");
}

export function encodeAny(_value: unknown, _stream: OutputBinaryStream) {
    assert(false, "type 'Any' cannot be encoded");
}

export function decodeAny(_stream: BinaryStream) {
    assert(false, "type 'Any' cannot be decoded");
}

export function encodeNull(_value: unknown, _stream: OutputBinaryStream): void {}

export function decodeNull(_stream: BinaryStream): unknown {
    return null;
}
