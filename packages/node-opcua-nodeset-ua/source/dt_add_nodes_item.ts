// ----- this file has been automatically generated - do not edit
import { Variant } from "node-opcua-variant"
import { QualifiedName } from "node-opcua-data-model"
import { NodeId, ExpandedNodeId } from "node-opcua-nodeid"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |AddNodesItem                                      |
 * | isAbstract|false                                             |
 */
export interface DTAddNodesItem extends DTStructure  {
  parentNodeId: ExpandedNodeId; // ExpandedNodeId ns=0;i=18
  referenceTypeId: NodeId; // NodeId ns=0;i=17
  requestedNewNodeId: ExpandedNodeId; // ExpandedNodeId ns=0;i=18
  browseName: QualifiedName; // QualifiedName ns=0;i=20
  ["$nodeClass"]: Variant; // Variant ns=0;i=257
  nodeAttributes: DTStructure; // ExtensionObject ns=0;i=22
  typeDefinition: ExpandedNodeId; // ExpandedNodeId ns=0;i=18
}