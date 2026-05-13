import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTBaseConfigurationRecord } from "./dt_base_configuration_record";
import type { DTKeyValuePair } from "./dt_key_value_pair";
import type { EnumUserToken } from "./enum_user_token";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |UserTokenSettingsDataType                                   |
 * | isAbstract|false                                                       |
 */
export interface DTUserTokenSettings extends DTBaseConfigurationRecord {
  name: UAString; // String ns=0;i=12
  recordProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  tokenType: EnumUserToken; // Int32 ns=0;i=303
  issuedTokenType: UAString; // String ns=0;i=12
  issuerEndpointUrl: UAString; // String ns=0;i=12
  securityPolicyUri: UAString; // String ns=0;i=12
  certificateGroupName: UAString; // String ns=0;i=12
  authorizationServiceName: UAString; // String ns=0;i=12
}
export interface UDTUserTokenSettings extends ExtensionObject, DTUserTokenSettings {};