// ----- this file has been automatically generated - do not edit
import { NodeId } from "node-opcua-nodeid"
import { DTDataTypeDefinition } from "./dt_data_type_definition"
import { EnumStructure } from "./enum_structure"
import { DTStructureField } from "./dt_structure_field"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |StructureDefinition                               |
 * | isAbstract|false                                             |
 */
export interface DTStructureDefinition extends DTDataTypeDefinition  {
  defaultEncodingId: NodeId; // NodeId ns=0;i=17
  baseDataType: NodeId; // NodeId ns=0;i=17
  structureType: EnumStructure; // Int32 ns=0;i=98
  fields: DTStructureField[]; // ExtensionObject ns=0;i=101
}