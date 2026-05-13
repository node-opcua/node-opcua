import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { Variant } from "node-opcua-variant";

import type { DTPubSubConfigurationRef } from "./dt_pub_sub_configuration_ref";
import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |PubSubConfigurationValueDataType                            |
 * | isAbstract|false                                                       |
 */
export interface DTPubSubConfigurationValue extends DTStructure {
  configurationElement: DTPubSubConfigurationRef; // ExtensionObject ns=0;i=25519
  name: UAString; // String ns=0;i=12
  identifier: Variant; // Variant ns=0;i=24
}
export interface UDTPubSubConfigurationValue extends ExtensionObject, DTPubSubConfigurationValue {};