import type { UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/Data/                        |
 * | nodeClass |DataType                                                    |
 * | name      |NodeIdArray                                                 |
 * | isAbstract|false                                                       |
 */
export interface DTNodeIdArray extends DTStructure {
  node: NodeId; // NodeId ns=0;i=17
  arrayIndex: UInt32[]; // UInt32 ns=0;i=7
}
export interface UDTNodeIdArray extends ExtensionObject, DTNodeIdArray {};