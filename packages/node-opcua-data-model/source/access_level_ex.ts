import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { registerBasicType } from "node-opcua-factory";
import { _accessLevelFlagToString } from "./access_level";
import { _make_flag } from "./_make_flag";
/**
 * from https://reference.opcfoundation.org/v104/Core/docs/Part3/8.58/:
 *
 * This is a subtype of the UInt32 DataType with the OptionSetValues Property defined.
 * It is used to indicate how the Value of a Variable can be accessed (read/write),
 * if it contains current and/or historic data and its atomicity.
 * The AccessLevelExType DataType is an extended version of the AccessLevelType DataType and
 * as such contains the 8 bits of the AccessLevelType as the first 8 bits.
 * The NonatomicRead, and NonatomicWrite Fields represent the atomicity of a Variable.
 *  In general Atomicity is expected of OPC UA read and write operations.
 * These Fields are used by systems, in particular hard-realtime controllers, which can not ensure atomicity.
 */
export enum AccessLevelExFlag {
    CurrentRead = 0x01, // bit 0 : Indicate if the current value is readable (0 means not readable, 1 means readable).
    CurrentWrite = 0x02, // bit 1 : Indicate if the current value is writable (0 means not writable, 1 means writable).
    HistoryRead = 0x04, // bit 2 : Indicates if the history of the value is readable (0 means not readable, 1 means readable).
    HistoryWrite = 0x08, // bit 3 : Indicates if the history of the value is writable (0 means not writable, 1 means writable).
    SemanticChange = 0x10, // bit 4 : Indicates if the Variable used as Property generates SemanticChangeEvents
    StatusWrite = 0x20, // bit 5 : Indicates if the current StatusCode of the value is writable (0 means not writable, 1 means writable).
    TimestampWrite = 0x40, // bit 6 : Indicates if the current SourceTimestamp of the value is writable (0 means not writable, 1 means writable).
    // reserved bit 7

    NonatomicRead = 0x80, // bit 8	 Indicates non-atomicity for Read access (0 means that atomicity is assured).
    NonatomicWrite = 0x100, // bit 9  Indicates non-atomicity for Write access (0 means that atomicity is assured).
    WriteFullArrayOnly = 0x200, // bit 10 Indicates if Write of IndexRange is supported.(0 means Write of IndexRange is supported)
    NoSubDataTypes = 0x400, // bit 11 Indicates if the Variable doesn’t allow its DataType to be subtyped (0 means the Variable accepts the defined DataType and subtypes of that DataType)
    // new in 1.5.1
    NonVolatile = 0x800, // bit 12 Indicates if the Variable is non-volatile (0 means it is volatile or not known to be, 1 means non-volatile
    Constant = 0x1000, // bit 13   Indicates if the Value of the Variable can be considered constant (0 means the Value is not constant, 1 means the Value is constant)

    // Reserved for future use. Shall always be zero.
    None = 0x800
}

// @example
//      makeAccessLevelFlag("CurrentRead | CurrentWrite").should.eql(0x03);
export function makeAccessLevelExFlag(str: string | number | null): AccessLevelExFlag {
    return _make_flag(str, AccessLevelExFlag.None, AccessLevelExFlag) as AccessLevelExFlag;
}

export function randomAccessLevelEx(): AccessLevelExFlag {
    return Math.ceil(Math.random() * 0x200);
}

export function accessLevelExFlagToString(accessLevelFlag: AccessLevelExFlag): string {
    const retVal = _accessLevelFlagToString(accessLevelFlag);

    if (accessLevelFlag & AccessLevelExFlag.NonatomicRead) {
        retVal.push("NonatomicRead");
    }
    if (accessLevelFlag & AccessLevelExFlag.NonatomicWrite) {
        retVal.push("NonatomicWrite");
    }
    if (accessLevelFlag & AccessLevelExFlag.WriteFullArrayOnly) {
        retVal.push("WriteFullArrayOnly");
    }
    if (accessLevelFlag & AccessLevelExFlag.NoSubDataTypes) {
        retVal.push("NoSubDataTypes");
    }
    if (accessLevelFlag & AccessLevelExFlag.NonVolatile) {
        retVal.push("NonVolatile");
    }
    if (accessLevelFlag & AccessLevelExFlag.Constant) {
        retVal.push("Constant");
    }

    if (retVal.length === 0) {
        retVal.push("None");
    }
    return retVal.join(" | ");
}

export function encodeAccessLevelExFlag(value: AccessLevelExFlag, stream: OutputBinaryStream): void {
    stream.writeUInt32(value & 0xfffff);
}
export function decodeAccessLevelExFlag(stream: BinaryStream): AccessLevelExFlag {
    const code = stream.readUInt32();
    return code;
}
