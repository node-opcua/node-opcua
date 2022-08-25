// ----- this file has been automatically generated - do not edit
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UInt32 } from "node-opcua-basic-types"
import { EnumToolManagement } from "./enum_tool_management"
import { EnumToolLocked } from "./enum_tool_locked"
import { EnumToolLifeIndication } from "./enum_tool_life_indication"
import { UABaseTool, UABaseTool_Base } from "./ua_base_tool"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:MultiToolType ns=10;i=51                       |
 * |isAbstract      |false                                             |
 */
export type UAMultiTool_Base = UABaseTool_Base;
export interface UAMultiTool extends UABaseTool, UAMultiTool_Base {
}