// ----- this file has been automatically generated - do not edit
import { NodeId, ExpandedNodeId } from "node-opcua-nodeid"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ReferenceListEntryDataType                                  |
 * | isAbstract|false                                                       |
 */
export interface DTReferenceListEntry extends DTStructure {
  referenceType: NodeId; // NodeId ns=0;i=17
  isForward: boolean; // Boolean ns=0;i=1
  targetNode: ExpandedNodeId; // ExpandedNodeId ns=0;i=18
}
export interface UDTReferenceListEntry extends ExtensionObject, DTReferenceListEntry {};