// ----- this file has been automatically generated - do not edit
import { QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { Byte } from "node-opcua-basic-types"
import { DTDataTypeDescription } from "./dt_data_type_description"
import { DTEnumDefinition } from "./dt_enum_definition"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |EnumDescription                                   |
 * | isAbstract|false                                             |
 */
export interface DTEnumDescription extends DTDataTypeDescription  {
  dataTypeId: NodeId; // NodeId ns=0;i=17
  name: QualifiedName; // QualifiedName ns=0;i=20
  enumDefinition: DTEnumDefinition; // ExtensionObject ns=0;i=100
  builtInType: Byte; // Byte ns=0;i=3
}