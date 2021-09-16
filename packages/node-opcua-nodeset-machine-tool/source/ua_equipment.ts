// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAToolList } from "./ua_tool_list"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:EquipmentType ns=10;i=12                       |
 * |isAbstract      |false                                             |
 */
export interface UAEquipment_Base {
    tools?: UAToolList;
}
export interface UAEquipment extends UAObject, UAEquipment_Base {
}