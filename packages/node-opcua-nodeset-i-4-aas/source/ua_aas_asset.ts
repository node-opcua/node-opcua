import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { EnumAASAssetKind } from "./enum_aas_asset_kind.js";
import type { UAAASReference } from "./ua_aas_reference.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/I4AAS/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AASAssetType i=1005                                         |
 * |isAbstract      |false                                                       |
 */
export interface UAAASAsset_Base {
   // PlaceHolder for $DataSpecification$
    assetIdentificationModel?: UAAASReference;
    assetKind: UAProperty<EnumAASAssetKind, DataType.Int32>;
    billOfMaterial?: UAAASReference;
}
export interface UAAASAsset extends UAObject, UAAASAsset_Base {}