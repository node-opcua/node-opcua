import type { QualifiedName } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { ExpandedNodeId } from "node-opcua-nodeid";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |AliasNameDataType                                           |
 * | isAbstract|false                                                       |
 */
export interface DTAliasName extends DTStructure {
  aliasName: QualifiedName; // QualifiedName ns=0;i=20
  referencedNodes: ExpandedNodeId[]; // ExpandedNodeId ns=0;i=18
}
export interface UDTAliasName extends ExtensionObject, DTAliasName {};