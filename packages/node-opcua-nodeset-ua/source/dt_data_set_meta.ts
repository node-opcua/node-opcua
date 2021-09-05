// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { UAString, Guid } from "node-opcua-basic-types"
import { DTDataTypeSchemaHeader } from "./dt_data_type_schema_header"
import { DTStructureDescription } from "./dt_structure_description"
import { DTEnumDescription } from "./dt_enum_description"
import { DTSimpleTypeDescription } from "./dt_simple_type_description"
import { DTFieldMetaData } from "./dt_field_meta_data"
import { DTConfigurationVersion } from "./dt_configuration_version"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |DataSetMetaDataType                               |
 * | isAbstract|false                                             |
 */
export interface DTDataSetMeta extends DTDataTypeSchemaHeader  {
  namespaces: UAString[]; // String ns=0;i=12
  structureDataTypes: DTStructureDescription[]; // ExtensionObject ns=0;i=15487
  enumDataTypes: DTEnumDescription[]; // ExtensionObject ns=0;i=15488
  simpleDataTypes: DTSimpleTypeDescription[]; // ExtensionObject ns=0;i=15005
  name: UAString; // String ns=0;i=12
  description: LocalizedText; // LocalizedText ns=0;i=21
  fields: DTFieldMetaData[]; // ExtensionObject ns=0;i=14524
  dataSetClassId: Guid; // Guid ns=0;i=14
  configurationVersion: DTConfigurationVersion; // ExtensionObject ns=0;i=14593
}