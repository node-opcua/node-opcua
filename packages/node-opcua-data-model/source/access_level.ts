// tslint:disable:no-bitwise
// tslint:disable:max-line-length
/**
 * @module node-opcua-data-model
 */
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { registerBasicType } from "node-opcua-factory";
import * as utils from "node-opcua-utils";

export enum AccessLevelFlag {
    CurrentRead = 0x01, // bit 0 : Indicate if the current value is readable (0 means not readable, 1 means readable).
    CurrentWrite = 0x02, // bit 1 : Indicate if the current value is writable (0 means not writable, 1 means writable).
    HistoryRead = 0x04, // bit 2 : Indicates if the history of the value is readable (0 means not readable, 1 means readable).
    HistoryWrite = 0x08, // bit 3 : Indicates if the history of the value is writable (0 means not writable, 1 means writable).
    SemanticChange = 0x10, // bit 4 : Indicates if the Variable used as Property generates SemanticChangeEvents
    StatusWrite = 0x20, // bit 5 : Indicates if the current StatusCode of the value is writable (0 means not writable, 1 means writable).
    TimestampWrite = 0x40, // bit 6 : Indicates if the current SourceTimestamp of the value is writable (0 means not writable, 1 means writable).
    NONE = 0x800, // Deprecated
    None = 0x800,
    Execute = 0x1000
}

export function convertAccessLevelFlagToByte(accessLevel: AccessLevelFlag): number {
    return accessLevel & 0x3f;
}
// @example
//      makeAccessLevelFlag("CurrentRead | CurrentWrite").should.eql(0x03);
export function makeAccessLevelFlag(str: string | number | null): AccessLevelFlag {
    if (typeof str === "number") {
        const value = str as number;
        if (value === 0) {
            return AccessLevelFlag.None;
        }
        return value as AccessLevelFlag;
    }

    let accessFlag: AccessLevelFlag | null;

    if (str === "" || str === null) {
        accessFlag = AccessLevelFlag.None;
    } else {
        const flags = str.split(" | ");
        accessFlag = 0;
        for (const flag of flags) {
            accessFlag |= (AccessLevelFlag as any)[flag];
        }
    }

    return accessFlag as AccessLevelFlag;
}

export const coerceAccessLevelFlag = makeAccessLevelFlag;

export function randomAccessLevel(): AccessLevelFlag {
    return AccessLevelFlag.CurrentRead;
}

// tslint:disable:no-bitwise
export function accessLevelFlagToString(accessLevelFlag: AccessLevelFlag): string {
    const retVal = [];
    if (accessLevelFlag & AccessLevelFlag.CurrentRead) {
        retVal.push("CurrentRead");
    }
    if (accessLevelFlag & AccessLevelFlag.CurrentWrite) {
        retVal.push("CurrentWrite");
    }
    if (accessLevelFlag & AccessLevelFlag.StatusWrite) {
        retVal.push("StatusWrite");
    }
    if (accessLevelFlag & AccessLevelFlag.TimestampWrite) {
        retVal.push("TimestampWrite");
    }
    if (accessLevelFlag & AccessLevelFlag.HistoryRead) {
        retVal.push("HistoryRead");
    }
    if (accessLevelFlag & AccessLevelFlag.HistoryWrite) {
        retVal.push("HistoryWrite");
    }
    if (accessLevelFlag & AccessLevelFlag.SemanticChange) {
        retVal.push("SemanticChange");
    }
    if (retVal.length === 0) {
        retVal.push("None");
    }
    return retVal.join(" | ");
}

export function decodeAccessLevelFlag(stream: BinaryStream): AccessLevelFlag {
    const code = stream.readUInt8();
    return code;
}

export function encodeAccessLevelFlag(value: AccessLevelFlag, stream: OutputBinaryStream) {
    stream.writeUInt8(value & 0x8f);
}

registerBasicType({
    name: "AccessLevelFlag",
    subType: "Byte",

    defaultValue: AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite,

    coerce: makeAccessLevelFlag,
    decode: decodeAccessLevelFlag,
    encode: encodeAccessLevelFlag,
    random: randomAccessLevel
});
