// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { UAToolList } from "./ua_tool_list"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |EquipmentType i=12                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAEquipment_Base {
    tools?: UAToolList;
}
export interface UAEquipment extends UAObject, UAEquipment_Base {
}