import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTKeyValuePair } from "node-opcua-nodeset-ua/dist/dt_key_value_pair.js";
import type { EnumMessageSecurityMode } from "node-opcua-nodeset-ua/dist/enum_message_security_mode.js";

import type { DTAddressSelection } from "./dt_address_selection.js";
import type { DTCommunicationFlowConfigurationConf } from "./dt_communication_flow_configuration_conf.js";
import type { DTCommunicationFlowQos } from "./dt_communication_flow_qos.js";
import type { DTSubscriberConfigurationConf } from "./dt_subscriber_configuration_conf.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |PubSubCommunicationFlowConfigurationConfDataType            |
 * | isAbstract|false                                                       |
 */
export interface DTPubSubCommunicationFlowConfigurationConf extends DTCommunicationFlowConfigurationConf {
  browseName: UAString; // String ns=0;i=12
  flowProperties?: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  address?: DTAddressSelection; // ExtensionObject ns=35;i=13048
  transportProfileUri?: UAString; // String ns=0;i=12
  transportProfileUriSelection?: UAString[]; // String ns=0;i=12
  transportProfileUriModify?: boolean; // Boolean ns=0;i=1
  headerLayoutUri?: UAString; // String ns=0;i=12
  headerLayoutUriSelection?: UAString[]; // String ns=0;i=12
  headerLayoutUriModify?: boolean; // Boolean ns=0;i=1
  publishingInterval?: number; // Double ns=0;i=290
  publishingIntervalSelection?: number[]; // Double ns=0;i=290
  publishingIntervalModify?: boolean; // Boolean ns=0;i=1
  qos?: DTCommunicationFlowQos; // ExtensionObject ns=35;i=3004
  qosSelection?: DTCommunicationFlowQos[]; // ExtensionObject ns=35;i=3004
  qosModify?: boolean; // Boolean ns=0;i=1
  securityMode?: EnumMessageSecurityMode; // Int32 ns=0;i=302
  securityModeSelection?: EnumMessageSecurityMode[]; // Int32 ns=0;i=302
  securityModeModify?: boolean; // Boolean ns=0;i=1
  securityGroupId?: UAString; // String ns=0;i=12
  securityGroupIdSelection?: UAString[]; // String ns=0;i=12
  securityGroupIdModify?: boolean; // Boolean ns=0;i=1
  subscriberConfigurations?: DTSubscriberConfigurationConf[]; // ExtensionObject ns=35;i=13018
}
export interface UDTPubSubCommunicationFlowConfigurationConf extends ExtensionObject, DTPubSubCommunicationFlowConfigurationConf {};