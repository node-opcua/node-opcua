import type { Byte, Guid, Int32, UAString, UInt16, UInt32 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";

import type { DTKeyValuePair } from "./dt_key_value_pair";
import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |FieldMetaData                                               |
 * | isAbstract|false                                                       |
 */
export interface DTFieldMetaData extends DTStructure {
  name: UAString; // String ns=0;i=12
  description: LocalizedText; // LocalizedText ns=0;i=21
  fieldFlags: UInt16; // UInt16 ns=0;i=15904
  builtInType: Byte; // Byte ns=0;i=3
  dataType: NodeId; // NodeId ns=0;i=17
  valueRank: Int32; // Int32 ns=0;i=6
  arrayDimensions: UInt32[]; // UInt32 ns=0;i=7
  maxStringLength: UInt32; // UInt32 ns=0;i=7
  dataSetFieldId: Guid; // Guid ns=0;i=14
  properties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
}
export interface UDTFieldMetaData extends ExtensionObject, DTFieldMetaData {};