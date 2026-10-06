import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";
import type { StatusCode } from "node-opcua-status-code";

import type { EnumAssetVerificationResultEnum } from "./enum_asset_verification_result_enum.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/Data/                        |
 * | nodeClass |DataType                                                    |
 * | name      |AssetVerificationResultDataType                             |
 * | isAbstract|false                                                       |
 */
export interface DTAssetVerificationResult extends DTStructure {
  verificationStatus: StatusCode; // StatusCode ns=0;i=19
  verificationResult: EnumAssetVerificationResultEnum; // Int32 ns=33;i=1037
  verificationVariablesErrors: StatusCode[]; // StatusCode ns=0;i=19
  verificationAdditionalVariablesErrors: StatusCode[]; // StatusCode ns=0;i=19
}
export interface UDTAssetVerificationResult extends ExtensionObject, DTAssetVerificationResult {};