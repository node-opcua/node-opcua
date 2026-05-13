import type { ExtensionObject } from "node-opcua-extension-object";
import type { ExpandedNodeId, NodeId } from "node-opcua-nodeid";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ReferenceDescriptionDataType                                |
 * | isAbstract|false                                                       |
 */
export interface DTReferenceDescription extends DTStructure {
  sourceNode: NodeId; // NodeId ns=0;i=17
  referenceType: NodeId; // NodeId ns=0;i=17
  isForward: boolean; // Boolean ns=0;i=1
  targetNode: ExpandedNodeId; // ExpandedNodeId ns=0;i=18
}
export interface UDTReferenceDescription extends ExtensionObject, DTReferenceDescription {};