import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

import type { DTPortableNodeIdentifier } from "./dt_portable_node_identifier.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |NodeIdTranslationDataType                                   |
 * | isAbstract|false                                                       |
 */
export interface DTNodeIdTranslation extends DTStructure {
  nodePlaceholder: NodeId; // NodeId ns=0;i=17
  portableNode: DTPortableNodeIdentifier; // ExtensionObject ns=35;i=3012
}
export interface UDTNodeIdTranslation extends ExtensionObject, DTNodeIdTranslation {};