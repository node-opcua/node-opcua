import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

import type { DTNodeIdentifier } from "./dt_node_identifier.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |NodeIdTranslationConfDataType                               |
 * | isAbstract|false                                                       |
 */
export interface DTNodeIdTranslationConf extends DTStructure {
  nodePlaceholder: NodeId; // NodeId ns=0;i=17
  node: DTNodeIdentifier; // ExtensionObject ns=35;i=13039
}
export interface UDTNodeIdTranslationConf extends ExtensionObject, DTNodeIdTranslationConf {};