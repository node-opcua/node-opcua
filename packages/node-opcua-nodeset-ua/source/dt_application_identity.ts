import type { UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTApplicationDescription } from "./dt_application_description";
import type { DTBaseConfigurationRecord } from "./dt_base_configuration_record";
import type { DTKeyValuePair } from "./dt_key_value_pair";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ApplicationIdentityDataType                                 |
 * | isAbstract|false                                                       |
 */
export interface DTApplicationIdentity extends DTBaseConfigurationRecord {
  name: UAString; // String ns=0;i=12
  recordProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  applicationUri: UAString; // String ns=0;i=23751
  applicationNames: LocalizedText[]; // LocalizedText ns=0;i=21
  additionalServers: DTApplicationDescription[]; // ExtensionObject ns=0;i=308
}
export interface UDTApplicationIdentity extends ExtensionObject, DTApplicationIdentity {};