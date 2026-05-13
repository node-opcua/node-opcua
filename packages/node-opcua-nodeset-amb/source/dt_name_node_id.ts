import type { LocalizedText } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

// ----- this file has been automatically generated - do not edit

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