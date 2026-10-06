import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";
import type { VariantOptions } from "node-opcua-variant";

import type { DTNodeIdArray } from "./dt_node_id_array.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/Data/                        |
 * | nodeClass |DataType                                                    |
 * | name      |NodeIdValuePair                                             |
 * | isAbstract|false                                                       |
 */
export interface DTNodeIdValuePair extends DTStructure {
  key: DTNodeIdArray; // ExtensionObject ns=33;i=1034
  value: VariantOptions; // Variant ns=0;i=24
}
export interface UDTNodeIdValuePair extends ExtensionObject, DTNodeIdValuePair {};