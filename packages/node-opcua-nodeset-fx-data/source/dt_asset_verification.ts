import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";
import type { DTKeyValuePair } from "node-opcua-nodeset-ua/dist/dt_key_value_pair.js";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

import type { DTNodeIdValuePair } from "./dt_node_id_value_pair.js";
import type { EnumAssetVerificationModeEnum } from "./enum_asset_verification_mode_enum.js";
import type { EnumAssetVerificationResultEnum } from "./enum_asset_verification_result_enum.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/Data/                        |
 * | nodeClass |DataType                                                    |
 * | name      |AssetVerificationDataType                                   |
 * | isAbstract|false                                                       |
 */
export interface DTAssetVerification extends DTStructure {
  assetToVerify: NodeId; // NodeId ns=0;i=17
  verificationMode: EnumAssetVerificationModeEnum; // Int32 ns=33;i=1029
  expectedVerificationResult: EnumAssetVerificationResultEnum; // Int32 ns=33;i=1037
  expectedVerificationVariables: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  expectedAdditionalVerificationVariables: DTNodeIdValuePair[]; // ExtensionObject ns=33;i=1028
}
export interface UDTAssetVerification extends ExtensionObject, DTAssetVerification {};