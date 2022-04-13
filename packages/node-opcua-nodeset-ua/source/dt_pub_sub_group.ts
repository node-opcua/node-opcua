// ----- this file has been automatically generated - do not edit
import { UInt32, UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
import { EnumMessageSecurityMode } from "./enum_message_security_mode"
import { DTEndpointDescription } from "./dt_endpoint_description"
import { DTKeyValuePair } from "./dt_key_value_pair"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |PubSubGroupDataType                               |
 * | isAbstract|true                                              |
 */
export interface DTPubSubGroup extends DTStructure  {
  name: UAString; // String ns=0;i=12
  enabled: boolean; // Boolean ns=0;i=1
  securityMode: EnumMessageSecurityMode; // Int32 ns=0;i=302
  securityGroupId: UAString; // String ns=0;i=12
  securityKeyServices: DTEndpointDescription[]; // ExtensionObject ns=0;i=312
  maxNetworkMessageSize: UInt32; // UInt32 ns=0;i=7
  groupProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
}