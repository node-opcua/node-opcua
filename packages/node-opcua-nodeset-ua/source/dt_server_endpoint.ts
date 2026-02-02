// ----- this file has been automatically generated - do not edit
import { UInt16, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTEndpoint } from "./dt_endpoint"
import { DTKeyValuePair } from "./dt_key_value_pair"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ServerEndpointDataType                                      |
 * | isAbstract|false                                                       |
 */
export interface DTServerEndpoint extends DTEndpoint {
  name: UAString; // String ns=0;i=12
  recordProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  discoveryUrls: UAString[]; // String ns=0;i=23751
  networkName: UAString; // String ns=0;i=12
  port: UInt16; // UInt16 ns=0;i=5
  endpointUrls: UAString[]; // String ns=0;i=23751
  securitySettingNames: UAString[]; // String ns=0;i=12
  transportProfileUri: UAString; // String ns=0;i=23751
  userTokenSettingNames: UAString[]; // String ns=0;i=12
  reverseConnectUrls: UAString[]; // String ns=0;i=12
}
export interface UDTServerEndpoint extends ExtensionObject, DTServerEndpoint {};