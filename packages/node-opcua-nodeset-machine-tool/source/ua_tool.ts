// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UABaseTool, UABaseTool_Base } from "./ua_base_tool"
export interface UATool_locked<T, DT extends DataType> extends UABaseDataVariable<T, /*b*/DT> { // Variable
      reasonForLocking: UAProperty<any, any>;
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
    controlIdentifier1: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    controlIdentifier2?: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    controlIdentifierInterpretation: UABaseDataVariable<any, any>;
    lastUsage?: UABaseDataVariable<Date, /*z*/DataType.DateTime>;
    locked: UATool_locked<boolean, /*z*/DataType.Boolean>;
    plannedForOperating?: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    toolLife?: UAObject;
}
export interface UATool extends UABaseTool, UATool_Base {
}