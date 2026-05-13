import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";

import type { DTDataTypeDefinition } from "./dt_data_type_definition";
import type { DTStructureField } from "./dt_structure_field";
import type { EnumStructure } from "./enum_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |StructureDefinition                                         |
 * | isAbstract|false                                                       |
 */
export interface DTStructureDefinition extends DTDataTypeDefinition {
  defaultEncodingId: NodeId; // NodeId ns=0;i=17
  baseDataType: NodeId; // NodeId ns=0;i=17
  structureType: EnumStructure; // Int32 ns=0;i=98
  fields: DTStructureField[]; // ExtensionObject ns=0;i=101
}
export interface UDTStructureDefinition extends ExtensionObject, DTStructureDefinition {};