import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTKeyValuePair } from "node-opcua-nodeset-ua/dist/dt_key_value_pair.js";
import type { DTPubSubKeyPushTarget } from "node-opcua-nodeset-ua/dist/dt_pub_sub_key_push_target.js";
import type { DTSecurityGroup } from "node-opcua-nodeset-ua/dist/dt_security_group.js";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |SecurityKeyServerAddressConfDataType                        |
 * | isAbstract|false                                                       |
 */
export interface DTSecurityKeyServerAddressConf extends DTStructure {
  address: UAString; // String ns=0;i=23751
  addressSelection?: UAString[]; // String ns=0;i=23751
  addressModify?: boolean; // Boolean ns=0;i=1
  securityPolicyUri: UAString; // String ns=0;i=12
  securityPolicyUriSelection?: UAString[]; // String ns=0;i=12
  securityPolicyUriModify?: boolean; // Boolean ns=0;i=1
  serverUri: UAString; // String ns=0;i=23751
  serverUriSelection?: UAString[]; // String ns=0;i=23751
  serverUriModify?: boolean; // Boolean ns=0;i=1
  usePushModel: boolean; // Boolean ns=0;i=1
  securityGroups?: DTSecurityGroup[]; // ExtensionObject ns=0;i=23601
  pubSubKeyPushTargets?: DTPubSubKeyPushTarget[]; // ExtensionObject ns=0;i=25270
  sksProperties?: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
}
export interface UDTSecurityKeyServerAddressConf extends ExtensionObject, DTSecurityKeyServerAddressConf {};