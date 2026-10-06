import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";
import type { DTPubSubConfigurationValue } from "node-opcua-nodeset-ua/dist/dt_pub_sub_configuration_value.js";
import type { StatusCode } from "node-opcua-status-code";

import type { DTCommunicationConfigurationResult } from "./dt_communication_configuration_result.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/Data/                        |
 * | nodeClass |DataType                                                    |
 * | name      |PubSubCommunicationConfigurationResultDataType              |
 * | isAbstract|false                                                       |
 */
export interface DTPubSubCommunicationConfigurationResult extends DTCommunicationConfigurationResult {
  result: StatusCode; // StatusCode ns=0;i=19
  changesApplied: boolean; // Boolean ns=0;i=1
  referenceResults: StatusCode[]; // StatusCode ns=0;i=19
  configurationValues: DTPubSubConfigurationValue[]; // ExtensionObject ns=0;i=25520
  configurationObjects: NodeId[]; // NodeId ns=0;i=17
}
export interface UDTPubSubCommunicationConfigurationResult extends ExtensionObject, DTPubSubCommunicationConfigurationResult {};