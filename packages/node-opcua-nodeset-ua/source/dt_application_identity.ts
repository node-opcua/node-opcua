// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTBaseConfigurationRecord } from "./dt_base_configuration_record"
import { DTKeyValuePair } from "./dt_key_value_pair"
import { DTApplicationDescription } from "./dt_application_description"
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