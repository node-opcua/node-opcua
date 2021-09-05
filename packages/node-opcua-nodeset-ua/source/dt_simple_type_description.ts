// ----- this file has been automatically generated - do not edit
import { QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { Byte } from "node-opcua-basic-types"
import { DTDataTypeDescription } from "./dt_data_type_description"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |SimpleTypeDescription                             |
 * | isAbstract|false                                             |
 */
export interface DTSimpleTypeDescription extends DTDataTypeDescription  {
  dataTypeId: NodeId; // NodeId ns=0;i=17
  name: QualifiedName; // QualifiedName ns=0;i=20
  baseDataType: NodeId; // NodeId ns=0;i=17
  builtInType: Byte; // Byte ns=0;i=3
}