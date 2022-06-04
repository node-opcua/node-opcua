// ----- this file has been automatically generated - do not edit
import { UInt16, UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
import { DTUserTokenPolicy } from "./dt_user_token_policy"
import { DTKeyValuePair } from "./dt_key_value_pair"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |PubSubKeyPushTargetDataType                       |
 * | isAbstract|false                                             |
 */
export interface DTPubSubKeyPushTarget extends DTStructure  {
  applicationUri: UAString; // String ns=0;i=12
  pushTargetFolder: UAString[]; // String ns=0;i=12
  endpointUrl: UAString; // String ns=0;i=12
  securityPolicyUri: UAString; // String ns=0;i=12
  userTokenType: DTUserTokenPolicy; // ExtensionObject ns=0;i=304
  requestedKeyCount: UInt16; // UInt16 ns=0;i=5
  retryInterval: number; // Double ns=0;i=290
  pushTargetProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  securityGroups: UAString[]; // String ns=0;i=12
}