// ----- this file has been automatically generated - do not edit
import { NodeId, ExpandedNodeId } from "node-opcua-nodeid"
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
import { EnumNodeClass } from "./enum_node_class"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |AddReferencesItem                                 |
 * | isAbstract|false                                             |
 */
export interface DTAddReferencesItem extends DTStructure  {
  sourceNodeId: NodeId; // NodeId ns=0;i=17
  referenceTypeId: NodeId; // NodeId ns=0;i=17
  isForward: boolean; // Boolean ns=0;i=1
  targetServerUri: UAString; // String ns=0;i=12
  targetNodeId: ExpandedNodeId; // ExpandedNodeId ns=0;i=18
  targetNodeClass: EnumNodeClass; // Int32 ns=0;i=257
}