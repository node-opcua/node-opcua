import type { QualifiedName } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { ExpandedNodeId, NodeId } from "node-opcua-nodeid";

import type { DTStructure } from "./dt_structure";
import type { EnumNodeClass } from "./enum_node_class";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |AddNodesItem                                                |
 * | isAbstract|false                                                       |
 */
export interface DTAddNodesItem extends DTStructure {
  parentNodeId: ExpandedNodeId; // ExpandedNodeId ns=0;i=18
  referenceTypeId: NodeId; // NodeId ns=0;i=17
  requestedNewNodeId: ExpandedNodeId; // ExpandedNodeId ns=0;i=18
  browseName: QualifiedName; // QualifiedName ns=0;i=20
  ["$nodeClass"]: EnumNodeClass; // Int32 ns=0;i=257
  nodeAttributes: DTStructure; // ExtensionObject ns=0;i=22
  typeDefinition: ExpandedNodeId; // ExpandedNodeId ns=0;i=18
}
export interface UDTAddNodesItem extends ExtensionObject, DTAddNodesItem {};