import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |SemanticChangeStructureDataType                             |
 * | isAbstract|false                                                       |
 */
export interface DTSemanticChangeStructure extends DTStructure {
  affected: NodeId; // NodeId ns=0;i=17
  affectedType: NodeId; // NodeId ns=0;i=17
}
export interface UDTSemanticChangeStructure extends ExtensionObject, DTSemanticChangeStructure {};