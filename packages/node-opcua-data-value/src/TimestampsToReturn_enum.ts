import { registerEnumeration } from "node-opcua-factory";
import { BinaryStream } from "node-opcua-binary-stream";
import { Enum } from "node-opcua-enum";

export enum TimestampsToReturn {
    Source = 0,
    Server = 1,
    Both = 2,
    Neither = 3,
    Invalid = 4
}

export const schemaTimestampsToReturn = {
    name: "TimestampsToReturn",
    enumValues: TimestampsToReturn,
};

export function encodeTimestampsToReturn(value: TimestampsToReturn, stream: BinaryStream) {
    stream.writeUInt32(value);
}

function clamp(min: number, a: number,  max: number) {
    return Math.max(Math.min(a, max), min);
}

export function decodeTimestampsToReturn(stream: BinaryStream): TimestampsToReturn {
    return clamp(TimestampsToReturn.Source, stream.readUInt32(), TimestampsToReturn.Invalid) as TimestampsToReturn;
}

export const _enumerationTimestampsToReturn : Enum = registerEnumeration(schemaTimestampsToReturn);
