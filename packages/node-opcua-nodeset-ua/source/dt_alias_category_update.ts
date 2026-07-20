import type { UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTPortableNodeId } from "./dt_portable_node_id";
import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |AliasCategoryUpdateDataType                                 |
 * | isAbstract|false                                                       |
 */
export interface DTAliasCategoryUpdate extends DTStructure {
  category: DTPortableNodeId; // ExtensionObject ns=0;i=24106
  lastChange: UInt32; // UInt32 ns=0;i=20998
}
export interface UDTAliasCategoryUpdate extends ExtensionObject, DTAliasCategoryUpdate {};