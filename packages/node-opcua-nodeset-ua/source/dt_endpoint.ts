// ----- this file has been automatically generated - do not edit
import { UInt16, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTBaseConfigurationRecord } from "./dt_base_configuration_record"
import { DTKeyValuePair } from "./dt_key_value_pair"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |EndpointDataType                                            |
 * | isAbstract|false                                                       |
 */
export interface DTEndpoint extends DTBaseConfigurationRecord {
  name: UAString; // String ns=0;i=12
  recordProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  discoveryUrls: UAString[]; // String ns=0;i=23751
  networkName: UAString; // String ns=0;i=12
  port: UInt16; // UInt16 ns=0;i=5
}
export interface UDTEndpoint extends ExtensionObject, DTEndpoint {};