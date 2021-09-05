// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
export interface UAOrderedList_$OrderedObject$ extends UAObject { // Object
      numberInList: UAProperty<any, any>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |OrderedListType ns=0;i=23518                      |
 * |isAbstract      |false                                             |
 */
export interface UAOrderedList_Base {
    nodeVersion?: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UAOrderedList extends UAObject, UAOrderedList_Base {
}