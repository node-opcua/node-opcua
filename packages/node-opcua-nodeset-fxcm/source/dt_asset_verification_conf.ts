import type { ExtensionObject } from "node-opcua-extension-object";
import type { EnumAssetVerificationModeEnum } from "node-opcua-nodeset-fx-data/dist/enum_asset_verification_mode_enum.js";
import type { EnumAssetVerificationResultEnum } from "node-opcua-nodeset-fx-data/dist/enum_asset_verification_result_enum.js";
import type { DTKeyValuePair } from "node-opcua-nodeset-ua/dist/dt_key_value_pair.js";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

import type { DTNodeIdentifier } from "./dt_node_identifier.js";
import type { DTNodeIdentifierValuePair } from "./dt_node_identifier_value_pair.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |AssetVerificationConfDataType                               |
 * | isAbstract|false                                                       |
 */
export interface DTAssetVerificationConf extends DTStructure {
  assetToVerify: DTNodeIdentifier; // ExtensionObject ns=35;i=13039
  verificationMode: EnumAssetVerificationModeEnum; // Int32 ns=33;i=1029
  expectedVerificationResult: EnumAssetVerificationResultEnum; // Int32 ns=33;i=1037
  expectedVerificationVariables: DTNodeIdentifierValuePair[]; // ExtensionObject ns=35;i=13042
  expectedAdditionalVerificationVariables: DTNodeIdentifierValuePair[]; // ExtensionObject ns=35;i=13042
  assetProperties?: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
}
export interface UDTAssetVerificationConf extends ExtensionObject, DTAssetVerificationConf {};