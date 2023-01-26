// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { EnumToolLocked } from "./enum_tool_locked"
import { UABaseTool, UABaseTool_Base } from "./ua_base_tool"
import { EnumToolManagement } from "./enum_tool_management"
export interface UATool_locked<T, DT extends DataType> extends UABaseDataVariable<T, DT> { // Variable
      reasonForLocking: UAProperty<EnumToolLocked, DataType.Int32>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:ToolType ns=10;i=50                            |
 * |isAbstract      |false                                             |
 */
export interface UATool_Base extends UABaseTool_Base {
    controlIdentifier1: UABaseDataVariable<UInt32, DataType.UInt32>;
    controlIdentifier2?: UABaseDataVariable<UInt32, DataType.UInt32>;
    controlIdentifierInterpretation: UABaseDataVariable<EnumToolManagement, DataType.Int32>;
    lastUsage?: UABaseDataVariable<Date, DataType.DateTime>;
    locked: UATool_locked<boolean, DataType.Boolean>;
    plannedForOperating?: UABaseDataVariable<boolean, DataType.Boolean>;
    toolLife?: UAObject;
}
export interface UATool extends UABaseTool, UATool_Base {
}