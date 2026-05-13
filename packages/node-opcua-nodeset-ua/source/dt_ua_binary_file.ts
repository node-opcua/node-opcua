import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { Variant } from "node-opcua-variant";

import type { DTDataTypeSchemaHeader } from "./dt_data_type_schema_header";
import type { DTEnumDescription } from "./dt_enum_description";
import type { DTKeyValuePair } from "./dt_key_value_pair";
import type { DTSimpleTypeDescription } from "./dt_simple_type_description";
import type { DTStructureDescription } from "./dt_structure_description";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |UABinaryFileDataType                                        |
 * | isAbstract|false                                                       |
 */
export interface DTUABinaryFile extends DTDataTypeSchemaHeader {
  namespaces: UAString[]; // String ns=0;i=12
  structureDataTypes: DTStructureDescription[]; // ExtensionObject ns=0;i=15487
  enumDataTypes: DTEnumDescription[]; // ExtensionObject ns=0;i=15488
  simpleDataTypes: DTSimpleTypeDescription[]; // ExtensionObject ns=0;i=15005
  schemaLocation: UAString; // String ns=0;i=12
  fileHeader: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  body: Variant; // Variant ns=0;i=24
}
export interface UDTUABinaryFile extends ExtensionObject, DTUABinaryFile {};