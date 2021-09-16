// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt16, UAString } from "node-opcua-basic-types"
export interface UABaseTool_location extends UAObject { // Object
      name: UAProperty<UAString, /*z*/DataType.String>;
      placeNumber: UAProperty<UInt16, /*z*/DataType.UInt16>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:BaseToolType ns=10;i=49                        |
 * |isAbstract      |true                                              |
 */
export interface UABaseTool_Base {
    identifier?: UAProperty<UAString, /*z*/DataType.String>;
    location?: UABaseTool_location;
    name?: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UABaseTool extends UAObject, UABaseTool_Base {
}