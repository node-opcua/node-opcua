/**
 * @module node-opcua-data-model
 */
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { Enum } from "node-opcua-enum";
import { registerEnumeration } from "node-opcua-factory";

export enum BrowseDirection {
    Forward = 0, // return forward references.
    Inverse = 1, // return inverse references.
    Both = 2, // return forward and inverse references.
    Invalid = 3 //
}

export const schemaBrowseDirection = {
    name: "BrowseDirection",

    enumValues: BrowseDirection
    // decode: (stream: BinaryStream) => {
    //
    //     const value = stream.readInteger();
    //     if (value < 0 || value > 2) {
    //         return BrowseDirection.Invalid;
    //     }
    //     return BrowseDirection[value];
    // }
};

export function encodeBrowseDirection(value: BrowseDirection, stream: OutputBinaryStream): void {
    stream.writeUInt32(value);
}

export function decodeBrowseDirection(stream: BinaryStream, _value?: BrowseDirection): BrowseDirection {
    let value = stream.readUInt32();
    if (value < 0 || value > 3 || Number.isNaN(value)) {
        value = BrowseDirection.Invalid;
    }
    return value as BrowseDirection;
}

export const _enumerationBrowseDirection: Enum = registerEnumeration(schemaBrowseDirection);
