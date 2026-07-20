import type { UAString } from "node-opcua-basic-types";
import type { QualifiedName } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { ExpandedNodeId, NodeId } from "node-opcua-nodeid";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |AliasNameVerboseDataType                                    |
 * | isAbstract|false                                                       |
 */
export interface DTAliasNameVerbose extends DTStructure {
  aliasName: QualifiedName; // QualifiedName ns=0;i=20
  referencedNodes: ExpandedNodeId[]; // ExpandedNodeId ns=0;i=18
  serverUris: UAString[]; // String ns=0;i=12
  aliasNameCategoryId: NodeId; // NodeId ns=0;i=17
}
export interface UDTAliasNameVerbose extends ExtensionObject, DTAliasNameVerbose {};