// ----- this file has been automatically generated - do not edit
import { QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { DTDataTypeDescription } from "./dt_data_type_description"
import { DTStructureDefinition } from "./dt_structure_definition"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |StructureDescription                              |
 * | isAbstract|false                                             |
 */
export interface DTStructureDescription extends DTDataTypeDescription  {
  dataTypeId: NodeId; // NodeId ns=0;i=17
  name: QualifiedName; // QualifiedName ns=0;i=20
  structureDefinition: DTStructureDefinition; // ExtensionObject ns=0;i=99
}