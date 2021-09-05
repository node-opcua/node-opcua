/***
 * @module node-opcua-basic-types
 */
import { assert } from "node-opcua-assert";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";

export function isValidBoolean(value: unknown): boolean {
    return typeof value === "boolean";
}

export function randomBoolean(): boolean {
    return Math.random() > 0.5;
}

export function encodeBoolean(value: boolean, stream: OutputBinaryStream): void {
    assert(isValidBoolean(value));
    stream.writeUInt8(value ? 1 : 0);
}

export function decodeBoolean(stream: BinaryStream, _value?: boolean): boolean {
    return !!stream.readUInt8();
}

const falseDetectionRegex = /^(?:f(?:alse)?|no?|0+)$/i;

export function coerceBoolean(value: string): boolean {
    // http://stackoverflow.com/a/24744599/406458
    return !falseDetectionRegex.test(value) && !!value;
    // return !!(+value||String(value).toLowerCase().replace(!!0,''));
}

export type UABoolean = boolean;
export const encodeUABoolean = encodeBoolean;
export const decodeUABoolean = decodeBoolean;
