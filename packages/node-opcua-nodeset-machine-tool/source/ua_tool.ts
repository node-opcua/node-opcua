import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { EnumToolLocked } from "./enum_tool_locked";
import type { EnumToolManagement } from "./enum_tool_management";
import type { UABaseTool, UABaseTool_Base } from "./ua_base_tool";

// ----- this file has been automatically generated - do not edit

export interface UATool_locked<T, DT extends DataType> extends UABaseDataVariable<T, DT> { // Variable
      reasonForLocking: UAProperty<EnumToolLocked, DataType.Int32>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ToolType i=50                                               |
 * |isAbstract      |false                                                       |
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
export interface UATool extends UABaseTool, UATool_Base {}