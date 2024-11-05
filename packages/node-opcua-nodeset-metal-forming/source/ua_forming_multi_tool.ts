// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UInt32, UInt16, UAString } from "node-opcua-basic-types"
import { EnumToolManagement } from "node-opcua-nodeset-machine-tool/source/enum_tool_management"
import { EnumToolLocked } from "node-opcua-nodeset-machine-tool/source/enum_tool_locked"
import { EnumToolLifeIndication } from "node-opcua-nodeset-machine-tool/source/enum_tool_life_indication"
import { UAMultiTool, UAMultiTool_Base } from "node-opcua-nodeset-machine-tool/source/ua_multi_tool"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MetalForming/                   |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FormingMultiToolType i=1012                                 |
 * |isAbstract      |false                                                       |
 */
export type UAFormingMultiTool_Base = UAMultiTool_Base;
export interface UAFormingMultiTool extends UAMultiTool, UAFormingMultiTool_Base {
}