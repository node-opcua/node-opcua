import type { UAObject } from "node-opcua-address-space-base";
import type { EnumAssetVerificationModeEnum } from "node-opcua-nodeset-fx-data/dist/enum_asset_verification_mode_enum.js";
import type { EnumAssetVerificationResultEnum } from "node-opcua-nodeset-fx-data/dist/enum_asset_verification_result_enum.js";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { UASelectionList } from "node-opcua-nodeset-ua/dist/ua_selection_list.js";
import type { DataType } from "node-opcua-variant";

import type { DTPortableNodeIdentifier } from "./dt_portable_node_identifier.js";
import type { DTPortableNodeIdentifierValuePair } from "./dt_portable_node_identifier_value_pair.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/CM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AssetVerificationType i=1247                                |
 * |isAbstract      |false                                                       |
 */
export interface UAAssetVerification_Base {
    assetToVerify: UASelectionList<DTPortableNodeIdentifier, DataType.ExtensionObject>;
    expectedAdditionalVerificationVariables: UABaseDataVariable<DTPortableNodeIdentifierValuePair[], DataType.ExtensionObject>;
    expectedVerificationResult: UABaseDataVariable<EnumAssetVerificationResultEnum, DataType.Int32>;
    expectedVerificationVariables: UABaseDataVariable<DTPortableNodeIdentifierValuePair[], DataType.ExtensionObject>;
    verificationMode: UABaseDataVariable<EnumAssetVerificationModeEnum, DataType.Int32>;
}
export interface UAAssetVerification extends UAObject, UAAssetVerification_Base {}