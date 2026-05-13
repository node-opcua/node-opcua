import type { QualifiedName } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";

import type { DTDataTypeDescription } from "./dt_data_type_description";
import type { DTStructureDefinition } from "./dt_structure_definition";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |StructureDescription                                        |
 * | isAbstract|false                                                       |
 */
export interface DTStructureDescription extends DTDataTypeDescription {
  dataTypeId: NodeId; // NodeId ns=0;i=17
  name: QualifiedName; // QualifiedName ns=0;i=20
  structureDefinition: DTStructureDefinition; // ExtensionObject ns=0;i=99
}
export interface UDTStructureDescription extends ExtensionObject, DTStructureDescription {};