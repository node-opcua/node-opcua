// ----- this file has been automatically generated - do not edit
import { NodeId, ExpandedNodeId } from "node-opcua-nodeid"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |DeleteReferencesItem                              |
 * | isAbstract|false                                             |
 */
export interface DTDeleteReferencesItem extends DTStructure  {
  sourceNodeId: NodeId; // NodeId ns=0;i=17
  referenceTypeId: NodeId; // NodeId ns=0;i=17
  isForward: boolean; // Boolean ns=0;i=1
  targetNodeId: ExpandedNodeId; // ExpandedNodeId ns=0;i=18
  deleteBidirectional: boolean; // Boolean ns=0;i=1
}