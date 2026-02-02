// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, UInt16 } from "node-opcua-basic-types"

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |LogObjectType i=19352                                       |
 * |isAbstract      |false                                                       |
 */
export interface UALogObject_Base {
    getRecords: UAMethod;
    maxRecords?: UAProperty<UInt32, DataType.UInt32>;
    maxStorageDuration?: UAProperty<number, DataType.Double>;
    minimumSeverity?: UAProperty<UInt16, DataType.UInt16>;
}
export interface UALogObject extends UAObject, UALogObject_Base {
}