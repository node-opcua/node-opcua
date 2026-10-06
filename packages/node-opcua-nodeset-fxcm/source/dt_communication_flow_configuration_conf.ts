import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTKeyValuePair } from "node-opcua-nodeset-ua/dist/dt_key_value_pair.js";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |CommunicationFlowConfigurationConfDataType                  |
 * | isAbstract|true                                                        |
 */
export interface DTCommunicationFlowConfigurationConf extends DTStructure {
  browseName: UAString; // String ns=0;i=12
  flowProperties?: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
}
export interface UDTCommunicationFlowConfigurationConf extends ExtensionObject, DTCommunicationFlowConfigurationConf {};