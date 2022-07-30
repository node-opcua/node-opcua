import assert from "node-opcua-assert";
import { OutputBinaryStream, BinaryStream } from "node-opcua-binary-stream";

export function defaultEncode(value: any, stream: OutputBinaryStream): void {
    /** */
}

export function defaultDecode(stream: BinaryStream): any {
    return null;
}

export function defaultGuidValue(): any {
    return Buffer.alloc(0);
}

export function toJSONGuid(value: any): any {
    if (typeof value === "string") {
        return value;
    }
    assert(value instanceof Buffer);
    return value.toString("base64");
}

export function encodeAny(value: any, stream: OutputBinaryStream) {
    assert(false, "type 'Any' cannot be encoded");
}

export function decodeAny(stream: BinaryStream) {
    assert(false, "type 'Any' cannot be decoded");
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function encodeNull(value: any, stream: OutputBinaryStream): void {}

export function decodeNull(stream: BinaryStream): any {
    return null;
}
