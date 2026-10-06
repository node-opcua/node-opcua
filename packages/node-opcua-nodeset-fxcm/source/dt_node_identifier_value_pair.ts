import type { UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";
import type { VariantOptions } from "node-opcua-variant";

import type { DTNodeIdentifier } from "./dt_node_identifier.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |NodeIdentifierValuePair                                     |
 * | isAbstract|false                                                       |
 */
export interface DTNodeIdentifierValuePair extends DTStructure {
  key: DTNodeIdentifier; // ExtensionObject ns=35;i=13039
  arrayIndex: UInt32[]; // UInt32 ns=0;i=7
  value: VariantOptions; // Variant ns=0;i=24
}
export interface UDTNodeIdentifierValuePair extends ExtensionObject, DTNodeIdentifierValuePair {};