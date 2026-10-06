import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTPubSubConfiguration2 } from "node-opcua-nodeset-ua/dist/dt_pub_sub_configuration_2.js";
import type { DTPubSubConfigurationRef } from "node-opcua-nodeset-ua/dist/dt_pub_sub_configuration_ref.js";

import type { DTCommunicationModelConfiguration } from "./dt_communication_model_configuration.js";
import type { DTNodeIdTranslation } from "./dt_node_id_translation.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |PubSubCommunicationModelConfigurationDataType               |
 * | isAbstract|false                                                       |
 */
export interface DTPubSubCommunicationModelConfiguration extends DTCommunicationModelConfiguration {
  pubSubConfiguration: DTPubSubConfiguration2; // ExtensionObject ns=0;i=23602
  translationTable: DTNodeIdTranslation[]; // ExtensionObject ns=35;i=3006
  configurationReferences: DTPubSubConfigurationRef[]; // ExtensionObject ns=0;i=25519
}
export interface UDTPubSubCommunicationModelConfiguration extends ExtensionObject, DTPubSubCommunicationModelConfiguration {};