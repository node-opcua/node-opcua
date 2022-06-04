// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt64, UInt32, UInt16, UAString } from "node-opcua-basic-types"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |FileType ns=0;i=11575                             |
 * |isAbstract      |false                                             |
 */
export interface UAFile_Base {
    size: UAProperty<UInt64, /*z*/DataType.UInt64>;
    writable: UAProperty<boolean, /*z*/DataType.Boolean>;
    userWritable: UAProperty<boolean, /*z*/DataType.Boolean>;
    openCount: UAProperty<UInt16, /*z*/DataType.UInt16>;
    mimeType?: UAProperty<UAString, /*z*/DataType.String>;
    maxByteStringLength?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    lastModifiedTime?: UAProperty<Date, /*z*/DataType.DateTime>;
    open: UAMethod;
    close: UAMethod;
    read: UAMethod;
    write: UAMethod;
    getPosition: UAMethod;
    setPosition: UAMethod;
}
export interface UAFile extends UAObject, UAFile_Base {
}