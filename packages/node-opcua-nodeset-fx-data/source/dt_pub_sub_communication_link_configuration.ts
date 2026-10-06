import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTConfigurationVersion } from "node-opcua-nodeset-ua/dist/dt_configuration_version.js";
import type { DTPubSubConfigurationRef } from "node-opcua-nodeset-ua/dist/dt_pub_sub_configuration_ref.js";

import type { DTCommunicationLinkConfiguration } from "./dt_communication_link_configuration.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/Data/                        |
 * | nodeClass |DataType                                                    |
 * | name      |PubSubCommunicationLinkConfigurationDataType                |
 * | isAbstract|false                                                       |
 */
export interface DTPubSubCommunicationLinkConfiguration extends DTCommunicationLinkConfiguration {
  dataSetReaderRef: DTPubSubConfigurationRef; // ExtensionObject ns=0;i=25519
  expectedSubscribedDataSetVersion: DTConfigurationVersion; // ExtensionObject ns=0;i=14593
  dataSetWriterRef: DTPubSubConfigurationRef; // ExtensionObject ns=0;i=25519
  expectedPublishedDataSetVersion: DTConfigurationVersion; // ExtensionObject ns=0;i=14593
}
export interface UDTPubSubCommunicationLinkConfiguration extends ExtensionObject, DTPubSubCommunicationLinkConfiguration {};