import type { ExtensionObject } from "node-opcua-extension-object";
import type { ExpandedNodeId, NodeId } from "node-opcua-nodeid";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |DeleteReferencesItem                                        |
 * | isAbstract|false                                                       |
 */
export interface DTDeleteReferencesItem extends DTStructure {
  sourceNodeId: NodeId; // NodeId ns=0;i=17
  referenceTypeId: NodeId; // NodeId ns=0;i=17
  isForward: boolean; // Boolean ns=0;i=1
  targetNodeId: ExpandedNodeId; // ExpandedNodeId ns=0;i=18
  deleteBidirectional: boolean; // Boolean ns=0;i=1
}
export interface UDTDeleteReferencesItem extends ExtensionObject, DTDeleteReferencesItem {};