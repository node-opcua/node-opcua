import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";
import type { EnumConfigurationUpdate } from "./enum_configuration_update";

// ----- this file has been automatically generated - do not edit

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