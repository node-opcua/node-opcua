import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

export interface UAOrderedList_$OrderedObject$ extends UAObject { // Object
      numberInList: UAProperty<any, any>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |OrderedListType i=23518                                     |
 * |isAbstract      |false                                                       |
 */
export interface UAOrderedList_Base {
   // PlaceHolder for $OrderedObject$
    nodeVersion?: UAProperty<UAString, DataType.String>;
}
export interface UAOrderedList extends UAObject, UAOrderedList_Base {}