import type { Guid, UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTConfigurationVersion } from "./dt_configuration_version";
import type { DTDataTypeSchemaHeader } from "./dt_data_type_schema_header";
import type { DTEnumDescription } from "./dt_enum_description";
import type { DTFieldMetaData } from "./dt_field_meta_data";
import type { DTSimpleTypeDescription } from "./dt_simple_type_description";
import type { DTStructureDescription } from "./dt_structure_description";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |DataSetMetaDataType                                         |
 * | isAbstract|false                                                       |
 */
export interface DTDataSetMeta extends DTDataTypeSchemaHeader {
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
export interface UDTDataSetMeta extends ExtensionObject, DTDataSetMeta {};