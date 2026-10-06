import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTPubSubConfiguration2 } from "node-opcua-nodeset-ua/dist/dt_pub_sub_configuration_2.js";
import type { DTPubSubConfigurationRef } from "node-opcua-nodeset-ua/dist/dt_pub_sub_configuration_ref.js";

import type { DTCommunicationConfiguration } from "./dt_communication_configuration.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/Data/                        |
 * | nodeClass |DataType                                                    |
 * | name      |PubSubCommunicationConfigurationDataType                    |
 * | isAbstract|false                                                       |
 */
export interface DTPubSubCommunicationConfiguration extends DTCommunicationConfiguration {
  pubSubConfiguration: DTPubSubConfiguration2; // ExtensionObject ns=0;i=23602
  requireCompleteUpdate: boolean; // Boolean ns=0;i=1
  configurationReferences: DTPubSubConfigurationRef[]; // ExtensionObject ns=0;i=25519
}
export interface UDTPubSubCommunicationConfiguration extends ExtensionObject, DTPubSubCommunicationConfiguration {};