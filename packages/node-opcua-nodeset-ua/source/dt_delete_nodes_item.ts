import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |DeleteNodesItem                                             |
 * | isAbstract|false                                                       |
 */
export interface DTDeleteNodesItem extends DTStructure {
  nodeId: NodeId; // NodeId ns=0;i=17
  deleteTargetReferences: boolean; // Boolean ns=0;i=1
}
export interface UDTDeleteNodesItem extends ExtensionObject, DTDeleteNodesItem {};