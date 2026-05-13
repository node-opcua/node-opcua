import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt16, UInt32, UInt64 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FileType i=11575                                            |
 * |isAbstract      |false                                                       |
 */
export interface UAFile_Base {
    size: UAProperty<UInt64, DataType.UInt64>;
    writable: UAProperty<boolean, DataType.Boolean>;
    userWritable: UAProperty<boolean, DataType.Boolean>;
    openCount: UAProperty<UInt16, DataType.UInt16>;
    mimeType?: UAProperty<UAString, DataType.String>;
    maxByteStringLength?: UAProperty<UInt32, DataType.UInt32>;
    lastModifiedTime?: UAProperty<Date, DataType.DateTime>;
    open: UAMethod;
    close: UAMethod;
    read: UAMethod;
    write: UAMethod;
    getPosition: UAMethod;
    setPosition: UAMethod;
}
export interface UAFile extends UAObject, UAFile_Base {}