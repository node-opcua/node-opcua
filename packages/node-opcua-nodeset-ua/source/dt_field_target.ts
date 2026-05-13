import type { Guid, UAString, UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";
import type { Variant } from "node-opcua-variant";

import type { DTStructure } from "./dt_structure";
import type { EnumOverrideValueHandling } from "./enum_override_value_handling";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |FieldTargetDataType                                         |
 * | isAbstract|false                                                       |
 */
export interface DTFieldTarget extends DTStructure {
  dataSetFieldId: Guid; // Guid ns=0;i=14
  receiverIndexRange: UAString; // String ns=0;i=291
  targetNodeId: NodeId; // NodeId ns=0;i=17
  attributeId: UInt32; // UInt32 ns=0;i=288
  writeIndexRange: UAString; // String ns=0;i=291
  overrideValueHandling: EnumOverrideValueHandling; // Int32 ns=0;i=15874
  overrideValue: Variant; // Variant ns=0;i=24
}
export interface UDTFieldTarget extends ExtensionObject, DTFieldTarget {};