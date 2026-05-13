import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |PortableNodeId                                              |
 * | isAbstract|false                                                       |
 */
export interface DTPortableNodeId extends DTStructure {
  namespaceUri: UAString; // String ns=0;i=12
  identifier: NodeId; // NodeId ns=0;i=17
}
export interface UDTPortableNodeId extends ExtensionObject, DTPortableNodeId {};