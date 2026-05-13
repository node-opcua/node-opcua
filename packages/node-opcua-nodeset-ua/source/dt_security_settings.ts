import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTBaseConfigurationRecord } from "./dt_base_configuration_record";
import type { DTKeyValuePair } from "./dt_key_value_pair";
import type { EnumMessageSecurityMode } from "./enum_message_security_mode";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |SecuritySettingsDataType                                    |
 * | isAbstract|false                                                       |
 */
export interface DTSecuritySettings extends DTBaseConfigurationRecord {
  name: UAString; // String ns=0;i=12
  recordProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  securityModes: EnumMessageSecurityMode[]; // Int32 ns=0;i=302
  securityPolicyUris: UAString[]; // String ns=0;i=12
  certificateGroupName: UAString; // String ns=0;i=12
}
export interface UDTSecuritySettings extends ExtensionObject, DTSecuritySettings {};