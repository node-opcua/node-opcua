// ----- this file has been automatically generated - do not edit
import { QualifiedName } from "node-opcua-data-model"
import { ExpandedNodeId } from "node-opcua-nodeid"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |AliasNameDataType                                 |
 * | isAbstract|false                                             |
 */
export interface DTAliasName extends DTStructure  {
  aliasName: QualifiedName; // QualifiedName ns=0;i=20
  referencedNodes: ExpandedNodeId[]; // ExpandedNodeId ns=0;i=18
}