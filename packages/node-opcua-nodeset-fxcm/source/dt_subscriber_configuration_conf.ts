import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTKeyValuePair } from "node-opcua-nodeset-ua/dist/dt_key_value_pair.js";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

import type { DTAddressSelection } from "./dt_address_selection.js";
import type { DTReceiveQosSelection } from "./dt_receive_qos_selection.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |SubscriberConfigurationConfDataType                         |
 * | isAbstract|false                                                       |
 */
export interface DTSubscriberConfigurationConf extends DTStructure {
  browseName: UAString; // String ns=0;i=12
  address?: DTAddressSelection; // ExtensionObject ns=35;i=13048
  messageReceiveTimeout: number; // Double ns=0;i=290
  messageReceiveTimeoutSelection?: number[]; // Double ns=0;i=290
  messageReceiveTimeoutModify?: boolean; // Boolean ns=0;i=1
  receiveQos?: DTReceiveQosSelection; // ExtensionObject ns=35;i=13051
  subscriberProperties?: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
}
export interface UDTSubscriberConfigurationConf extends ExtensionObject, DTSubscriberConfigurationConf {};