// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
import { EnumConfigurationUpdate } from "./enum_configuration_update"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ConfigurationUpdateTargetType                               |
 * | isAbstract|false                                                       |
 */
export interface DTConfigurationUpdateTarget extends DTStructure {
  path: UAString; // String ns=0;i=12
  updateType: EnumConfigurationUpdate; // Int32 ns=0;i=15539
}
export interface UDTConfigurationUpdateTarget extends ExtensionObject, DTConfigurationUpdateTarget {};