// ----- this file has been automatically generated - do not edit
import { QualifiedName } from "node-opcua-data-model"
import { ExpandedNodeId } from "node-opcua-nodeid"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |AliasNameDataType                                 |
 * | isAbstract|false                                             |
 */
export interface DTAliasName extends DTStructure {
  aliasName: QualifiedName; // QualifiedName ns=0;i=20
  referencedNodes: ExpandedNodeId[]; // ExpandedNodeId ns=0;i=18
}
export interface UDTAliasName extends ExtensionObject, DTAliasName {};