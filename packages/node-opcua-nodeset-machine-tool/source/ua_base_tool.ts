import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt16 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

export interface UABaseTool_location extends UAObject { // Object
      name: UAProperty<UAString, DataType.String>;
      placeNumber: UAProperty<UInt16, DataType.UInt16>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |BaseToolType i=49                                           |
 * |isAbstract      |true                                                        |
 */
export interface UABaseTool_Base {
    identifier?: UAProperty<UAString, DataType.String>;
    location?: UABaseTool_location;
    name?: UAProperty<UAString, DataType.String>;
}
export interface UABaseTool extends UAObject, UABaseTool_Base {}