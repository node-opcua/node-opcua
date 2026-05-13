import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTEnumDescription } from "./dt_enum_description";
import type { DTSimpleTypeDescription } from "./dt_simple_type_description";
import type { DTStructure } from "./dt_structure";
import type { DTStructureDescription } from "./dt_structure_description";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |DataTypeSchemaHeader                                        |
 * | isAbstract|true                                                        |
 */
export interface DTDataTypeSchemaHeader extends DTStructure {
  namespaces: UAString[]; // String ns=0;i=12
  structureDataTypes: DTStructureDescription[]; // ExtensionObject ns=0;i=15487
  enumDataTypes: DTEnumDescription[]; // ExtensionObject ns=0;i=15488
  simpleDataTypes: DTSimpleTypeDescription[]; // ExtensionObject ns=0;i=15005
}
export interface UDTDataTypeSchemaHeader extends ExtensionObject, DTDataTypeSchemaHeader {};