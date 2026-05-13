import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTDataTypeDefinition } from "./dt_data_type_definition";
import type { DTEnumField } from "./dt_enum_field";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |EnumDefinition                                              |
 * | isAbstract|false                                                       |
 */
export interface DTEnumDefinition extends DTDataTypeDefinition {
  fields: DTEnumField[]; // ExtensionObject ns=0;i=102
}
export interface UDTEnumDefinition extends ExtensionObject, DTEnumDefinition {};