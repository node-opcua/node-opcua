import type { Byte, UAString, UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IPriorityMappingEntryType i=24205                           |
 * |isAbstract      |true                                                        |
 */
export interface UAIPriorityMappingEntry_Base extends UABaseInterface_Base {
    mappingUri: UABaseDataVariable<UAString, DataType.String>;
    priorityLabel: UABaseDataVariable<UAString, DataType.String>;
    priorityValue_PCP?: UABaseDataVariable<Byte, DataType.Byte>;
    priorityValue_DSCP?: UABaseDataVariable<UInt32, DataType.UInt32>;
}
export interface UAIPriorityMappingEntry extends UABaseInterface, UAIPriorityMappingEntry_Base {}