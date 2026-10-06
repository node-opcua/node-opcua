import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTKeyValuePair } from "node-opcua-nodeset-ua/dist/dt_key_value_pair.js";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

import type { DTConnectionEndpointConfigurationConf } from "./dt_connection_endpoint_configuration_conf.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |ConnectionConfigurationConfDataType                         |
 * | isAbstract|false                                                       |
 */
export interface DTConnectionConfigurationConf extends DTStructure {
  browseName: UAString; // String ns=0;i=12
  endpoint1: DTConnectionEndpointConfigurationConf; // ExtensionObject ns=35;i=13009
  endpoint2?: DTConnectionEndpointConfigurationConf; // ExtensionObject ns=35;i=13009
  connectionProperties?: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
}
export interface UDTConnectionConfigurationConf extends ExtensionObject, DTConnectionConfigurationConf {};