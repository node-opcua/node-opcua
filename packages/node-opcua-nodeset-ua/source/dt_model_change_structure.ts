import type { Byte } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ModelChangeStructureDataType                                |
 * | isAbstract|false                                                       |
 */
export interface DTModelChangeStructure extends DTStructure {
  affected: NodeId; // NodeId ns=0;i=17
  affectedType: NodeId; // NodeId ns=0;i=17
  verb: Byte; // Byte ns=0;i=3
}
export interface UDTModelChangeStructure extends ExtensionObject, DTModelChangeStructure {};