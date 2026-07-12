import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UInt16 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Weihenstephan/                  |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |WSBaseObjectType i=1001                                     |
 * |isAbstract      |false                                                       |
 */
export interface UAWSBaseObject_Base {
    wsTagNumber?: UAProperty<UInt16, DataType.UInt16>;
}
export interface UAWSBaseObject extends UAObject, UAWSBaseObject_Base {}