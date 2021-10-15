/**
 * @module node-opcua-data-value
 */
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { registerEnumeration } from "node-opcua-factory";

export enum TimestampsToReturn {
    Source = 0,
    Server = 1,
    Both = 2,
    Neither = 3,
    Invalid = 4
}

export const schemaTimestampsToReturn = {
    name: "TimestampsToReturn",

    enumValues: TimestampsToReturn
};

export function encodeTimestampsToReturn(value: TimestampsToReturn, stream: OutputBinaryStream): void {
    stream.writeUInt32(value);
}

function clamp(min: number, a: number, max: number) {
    return Math.max(Math.min(a, max), min);
}

export function decodeTimestampsToReturn(stream: BinaryStream, value?: TimestampsToReturn): TimestampsToReturn {
    return clamp(TimestampsToReturn.Source, stream.readUInt32(), TimestampsToReturn.Invalid) as TimestampsToReturn;
}

export const _enumerationTimestampsToReturn = registerEnumeration(schemaTimestampsToReturn);

export function coerceTimestampsToReturn(value: number | null | undefined): TimestampsToReturn {
    return typeof value === "number" ? +value : TimestampsToReturn.Neither;
}
