// ----- this file has been automatically generated - do not edit
import { ExtensionObject } from "node-opcua-extension-object"
import { DTDataTypeDefinition } from "./dt_data_type_definition"
import { DTEnumField } from "./dt_enum_field"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |EnumDefinition                                    |
 * | isAbstract|false                                             |
 */
export interface DTEnumDefinition extends DTDataTypeDefinition {
  fields: DTEnumField[]; // ExtensionObject ns=0;i=102
}
export interface UDTEnumDefinition extends ExtensionObject, DTEnumDefinition {};