// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt32, Byte, UAString } from "node-opcua-basic-types"
import { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface"
import { UABaseDataVariable } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |IPriorityMappingEntryType ns=0;i=24205            |
 * |isAbstract      |true                                              |
 */
export interface UAIPriorityMappingEntry_Base extends UABaseInterface_Base {
    mappingUri: UABaseDataVariable<UAString, /*z*/DataType.String>;
    priorityLabel: UABaseDataVariable<UAString, /*z*/DataType.String>;
    priorityValue_PCP?: UABaseDataVariable<Byte, /*z*/DataType.Byte>;
    priorityValue_DSCP?: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
}
export interface UAIPriorityMappingEntry extends UABaseInterface, UAIPriorityMappingEntry_Base {
}