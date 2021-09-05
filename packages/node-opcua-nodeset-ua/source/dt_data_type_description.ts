// ----- this file has been automatically generated - do not edit
import { QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |DataTypeDescription                               |
 * | isAbstract|true                                              |
 */
export interface DTDataTypeDescription extends DTStructure  {
  dataTypeId: NodeId; // NodeId ns=0;i=17
  name: QualifiedName; // QualifiedName ns=0;i=20
}