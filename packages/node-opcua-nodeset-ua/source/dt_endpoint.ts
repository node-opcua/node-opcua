import type { UAString, UInt16 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTBaseConfigurationRecord } from "./dt_base_configuration_record";
import type { DTKeyValuePair } from "./dt_key_value_pair";

// ----- this file has been automatically generated - do not edit

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