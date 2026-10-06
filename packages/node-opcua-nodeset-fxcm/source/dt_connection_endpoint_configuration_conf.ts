import type { Int32, UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";
import type { DTKeyValuePair } from "node-opcua-nodeset-ua/dist/dt_key_value_pair.js";
import type { DTPublishedDataSet } from "node-opcua-nodeset-ua/dist/dt_published_data_set.js";
import type { DTStandaloneSubscribedDataSet } from "node-opcua-nodeset-ua/dist/dt_standalone_subscribed_data_set.js";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

import type { DTNodeIdentifier } from "./dt_node_identifier.js";
import type { DTNodeIdentifierValuePair } from "./dt_node_identifier_value_pair.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |ConnectionEndpointConfigurationConfDataType                 |
 * | isAbstract|false                                                       |
 */
export interface DTConnectionEndpointConfigurationConf extends DTStructure {
  functionalEntityNode: DTNodeIdentifier; // ExtensionObject ns=35;i=13039
  functionalEntityNodeSelection?: DTNodeIdentifier[]; // ExtensionObject ns=35;i=13039
  functionalEntityNodeModify?: boolean; // Boolean ns=0;i=1
  name: UAString; // String ns=0;i=12
  nameSelection?: UAString[]; // String ns=0;i=12
  nameModify?: boolean; // Boolean ns=0;i=1
  connectionEndpointTypeId: NodeId; // NodeId ns=0;i=17
  inputVariableIds?: DTNodeIdentifier[]; // ExtensionObject ns=35;i=13039
  outputVariableIds?: DTNodeIdentifier[]; // ExtensionObject ns=35;i=13039
  isPersistent: boolean; // Boolean ns=0;i=1
  cleanupTimeout: number; // Double ns=0;i=290
  isPreconfigured: boolean; // Boolean ns=0;i=1
  communicationLinks?: DTStructure; // ExtensionObject ns=0;i=22
  preconfiguredPublishedDataSet?: UAString; // String ns=0;i=12
  publishedDataSetData?: DTPublishedDataSet; // ExtensionObject ns=0;i=15578
  preconfiguredSubscribedDataSet?: UAString; // String ns=0;i=12
  subscribedDataSetData?: DTStandaloneSubscribedDataSet; // ExtensionObject ns=0;i=23600
  expectedVerificationVariables?: DTNodeIdentifierValuePair[]; // ExtensionObject ns=35;i=13042
  controlGroups?: DTNodeIdentifier[]; // ExtensionObject ns=35;i=13039
  configurationData?: DTNodeIdentifierValuePair[]; // ExtensionObject ns=35;i=13042
  endpointProperties?: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  automationComponentIndex: Int32; // Int32 ns=0;i=6
  outboundFlowIndex?: Int32; // Int32 ns=0;i=6
  inboundFlowIndex?: Int32[]; // Int32 ns=0;i=6
}
export interface UDTConnectionEndpointConfigurationConf extends ExtensionObject, DTConnectionEndpointConfigurationConf {};