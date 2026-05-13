import type { UAString } from "node-opcua-basic-types";
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
 * | name      |AddReferencesItem                                           |
 * | isAbstract|false                                                       |
 */
export interface DTAddReferencesItem extends DTStructure {
  sourceNodeId: NodeId; // NodeId ns=0;i=17
  referenceTypeId: NodeId; // NodeId ns=0;i=17
  isForward: boolean; // Boolean ns=0;i=1
  targetServerUri: UAString; // String ns=0;i=12
  targetNodeId: ExpandedNodeId; // ExpandedNodeId ns=0;i=18
  targetNodeClass: EnumNodeClass; // Int32 ns=0;i=257
}
export interface UDTAddReferencesItem extends ExtensionObject, DTAddReferencesItem {};