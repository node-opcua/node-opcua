import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTKeyValuePair } from "node-opcua-nodeset-ua/dist/dt_key_value_pair.js";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";
import type { EnumMessageSecurityMode } from "node-opcua-nodeset-ua/dist/enum_message_security_mode.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |ServerAddressConfDataType                                   |
 * | isAbstract|false                                                       |
 */
export interface DTServerAddressConf extends DTStructure {
  browseName: UAString; // String ns=0;i=12
  address: UAString; // String ns=0;i=23751
  addressSelection?: UAString[]; // String ns=0;i=23751
  addressModify?: boolean; // Boolean ns=0;i=1
  securityMode: EnumMessageSecurityMode; // Int32 ns=0;i=302
  securityModeSelection?: EnumMessageSecurityMode[]; // Int32 ns=0;i=302
  securityModeModify?: boolean; // Boolean ns=0;i=1
  securityPolicyUri: UAString; // String ns=0;i=12
  securityPolicyUriSelection?: UAString[]; // String ns=0;i=12
  securityPolicyUriModify?: boolean; // Boolean ns=0;i=1
  serverUri: UAString; // String ns=0;i=23751
  serverUriSelection?: UAString[]; // String ns=0;i=23751
  serverUriModify?: boolean; // Boolean ns=0;i=1
  serverProperties?: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  namespaces: UAString[]; // String ns=0;i=12
}
export interface UDTServerAddressConf extends ExtensionObject, DTServerAddressConf {};