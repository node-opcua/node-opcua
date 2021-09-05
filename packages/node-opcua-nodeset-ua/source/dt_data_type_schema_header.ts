// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
import { DTStructureDescription } from "./dt_structure_description"
import { DTEnumDescription } from "./dt_enum_description"
import { DTSimpleTypeDescription } from "./dt_simple_type_description"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |DataTypeSchemaHeader                              |
 * | isAbstract|true                                              |
 */
export interface DTDataTypeSchemaHeader extends DTStructure  {
  namespaces: UAString[]; // String ns=0;i=12
  structureDataTypes: DTStructureDescription[]; // ExtensionObject ns=0;i=15487
  enumDataTypes: DTEnumDescription[]; // ExtensionObject ns=0;i=15488
  simpleDataTypes: DTSimpleTypeDescription[]; // ExtensionObject ns=0;i=15005
}