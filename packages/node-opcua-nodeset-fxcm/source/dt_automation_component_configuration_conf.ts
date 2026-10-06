import type { Int32, UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTKeyValuePair } from "node-opcua-nodeset-ua/dist/dt_key_value_pair.js";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

import type { DTAssetVerificationConf } from "./dt_asset_verification_conf.js";
import type { DTCommunicationModelConfiguration } from "./dt_communication_model_configuration.js";
import type { DTNodeIdentifier } from "./dt_node_identifier.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |AutomationComponentConfigurationConfDataType                |
 * | isAbstract|false                                                       |
 */
export interface DTAutomationComponentConfigurationConf extends DTStructure {
  browseName: UAString; // String ns=0;i=12
  automationComponentNode: DTNodeIdentifier; // ExtensionObject ns=35;i=13039
  automationComponentNodeSelection: DTNodeIdentifier[]; // ExtensionObject ns=35;i=13039
  automationComponentNodeModify: boolean; // Boolean ns=0;i=1
  commandBundleRequired: boolean; // Boolean ns=0;i=1
  assetVerification: DTAssetVerificationConf[]; // ExtensionObject ns=35;i=13030
  communicationModelConfig?: DTCommunicationModelConfiguration; // ExtensionObject ns=35;i=13033
  automationComponentProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  serverAddressIndex: Int32; // Int32 ns=0;i=6
}
export interface UDTAutomationComponentConfigurationConf extends ExtensionObject, DTAutomationComponentConfigurationConf {};