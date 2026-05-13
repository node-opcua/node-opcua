import type { UAString, UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTEndpointDescription } from "./dt_endpoint_description";
import type { DTKeyValuePair } from "./dt_key_value_pair";
import type { DTStructure } from "./dt_structure";
import type { EnumMessageSecurityMode } from "./enum_message_security_mode";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |PubSubGroupDataType                                         |
 * | isAbstract|true                                                        |
 */
export interface DTPubSubGroup extends DTStructure {
  name: UAString; // String ns=0;i=12
  enabled: boolean; // Boolean ns=0;i=1
  securityMode: EnumMessageSecurityMode; // Int32 ns=0;i=302
  securityGroupId: UAString; // String ns=0;i=12
  securityKeyServices: DTEndpointDescription[]; // ExtensionObject ns=0;i=312
  maxNetworkMessageSize: UInt32; // UInt32 ns=0;i=7
  groupProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
}
export interface UDTPubSubGroup extends ExtensionObject, DTPubSubGroup {};