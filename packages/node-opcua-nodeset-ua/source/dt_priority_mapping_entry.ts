import type { Byte, UAString, UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |PriorityMappingEntryType                                    |
 * | isAbstract|false                                                       |
 */
export interface DTPriorityMappingEntry extends DTStructure {
  mappingUri: UAString; // String ns=0;i=12
  priorityLabel: UAString; // String ns=0;i=12
  priorityValue_PCP: Byte; // Byte ns=0;i=3
  priorityValue_DSCP: UInt32; // UInt32 ns=0;i=7
}
export interface UDTPriorityMappingEntry extends ExtensionObject, DTPriorityMappingEntry {};