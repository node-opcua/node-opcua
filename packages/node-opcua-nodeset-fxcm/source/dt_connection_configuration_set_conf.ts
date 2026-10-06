import type { UAString, UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTKeyValuePair } from "node-opcua-nodeset-ua/dist/dt_key_value_pair.js";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

import type { DTAutomationComponentConfigurationConf } from "./dt_automation_component_configuration_conf.js";
import type { DTCommunicationFlowConfigurationConf } from "./dt_communication_flow_configuration_conf.js";
import type { DTConnectionConfigurationConf } from "./dt_connection_configuration_conf.js";
import type { DTSecurityKeyServerAddressConf } from "./dt_security_key_server_address_conf.js";
import type { DTServerAddressConf } from "./dt_server_address_conf.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |ConnectionConfigurationSetConfDataType                      |
 * | isAbstract|false                                                       |
 */
export interface DTConnectionConfigurationSetConf extends DTStructure {
  browseName: UAString; // String ns=0;i=12
  connectionConfigurationSetFolder: UAString[]; // String ns=0;i=12
  connections: DTConnectionConfigurationConf[]; // ExtensionObject ns=35;i=13006
  communicationFlows?: DTCommunicationFlowConfigurationConf[]; // ExtensionObject ns=35;i=13012
  serverAddresses: DTServerAddressConf[]; // ExtensionObject ns=35;i=13027
  automationComponentConfigurations: DTAutomationComponentConfigurationConf[]; // ExtensionObject ns=35;i=13021
  rollbackOnError: boolean; // Boolean ns=0;i=1
  securityKeyServer: DTSecurityKeyServerAddressConf; // ExtensionObject ns=35;i=13024
  version: UInt32; // UInt32 ns=0;i=7
  connectionConfigurationSetProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
}
export interface UDTConnectionConfigurationSetConf extends ExtensionObject, DTConnectionConfigurationSetConf {};