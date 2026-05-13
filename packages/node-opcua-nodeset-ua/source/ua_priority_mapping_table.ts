import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTPriorityMappingEntry } from "./dt_priority_mapping_entry";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PriorityMappingTableType i=25227                            |
 * |isAbstract      |false                                                       |
 */
export interface UAPriorityMappingTable_Base {
    priorityMapppingEntries: UAProperty<DTPriorityMappingEntry[], DataType.ExtensionObject>;
    addPriorityMappingEntry?: UAMethod;
    deletePriorityMappingEntry?: UAMethod;
}
export interface UAPriorityMappingTable extends UAObject, UAPriorityMappingTable_Base {}