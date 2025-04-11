// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure"
/**
 * A human-readable name of something plus
 * optionally the NodeId in case the something is
 * represented in the AddressSpace
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AMB/                            |
 * | nodeClass |DataType                                                    |
 * | name      |NameNodeIdDataType                                          |
 * | isAbstract|false                                                       |
 */
export interface DTNameNodeId extends DTStructure {
  /** The human-readable name. Shall be the DisplayName of the NodeId field, in case the NodeId is provided*/
  name: LocalizedText; // LocalizedText ns=0;i=21
  /** Optionally provided NodeId, in case the referenced thing is represented as Node in the AddressSpace.*/
  nodeId: NodeId; // NodeId ns=0;i=17
}
export interface UDTNameNodeId extends ExtensionObject, DTNameNodeId {};