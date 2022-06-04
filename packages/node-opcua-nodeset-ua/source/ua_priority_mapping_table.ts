// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTPriorityMappingEntry } from "./dt_priority_mapping_entry"
import { DTArgument } from "./dt_argument"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |PriorityMappingTableType ns=0;i=25227             |
 * |isAbstract      |false                                             |
 */
export interface UAPriorityMappingTable_Base {
    priorityMapppingEntries: UAProperty<DTPriorityMappingEntry[], /*z*/DataType.ExtensionObject>;
    addPriorityMappingEntry?: UAMethod;
    deletePriorityMappingEntry?: UAMethod;
}
export interface UAPriorityMappingTable extends UAObject, UAPriorityMappingTable_Base {
}