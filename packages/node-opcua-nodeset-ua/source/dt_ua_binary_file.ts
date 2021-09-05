// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTDataTypeSchemaHeader } from "./dt_data_type_schema_header"
import { DTStructureDescription } from "./dt_structure_description"
import { DTEnumDescription } from "./dt_enum_description"
import { DTSimpleTypeDescription } from "./dt_simple_type_description"
import { DTKeyValuePair } from "./dt_key_value_pair"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |UABinaryFileDataType                              |
 * | isAbstract|false                                             |
 */
export interface DTUABinaryFile extends DTDataTypeSchemaHeader  {
  namespaces: UAString[]; // String ns=0;i=12
  structureDataTypes: DTStructureDescription[]; // ExtensionObject ns=0;i=15487
  enumDataTypes: DTEnumDescription[]; // ExtensionObject ns=0;i=15488
  simpleDataTypes: DTSimpleTypeDescription[]; // ExtensionObject ns=0;i=15005
  schemaLocation: UAString; // String ns=0;i=12
  fileHeader: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  body: undefined; // Null ns=0;i=0
}