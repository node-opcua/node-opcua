import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt16 } from "node-opcua-basic-types";
import type { UAMultiStateValueDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_value_discrete.js";
import type { DataType } from "node-opcua-variant";

import type { UAAssetConnector, UAAssetConnector_Base } from "./ua_asset_connector.js";

// ----- this file has been automatically generated - do not edit

/**
 * ClampBlockType represents a wire connection block
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ClampBlockType i=7                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAClampBlock_Base extends UAAssetConnector_Base {
   // PlaceHolder for $Clamp$
    blockSize?: UAProperty<UInt16, DataType.UInt16>;
    kind?: UAMultiStateValueDiscrete<UInt16, DataType.UInt16>;
    name: UAProperty<UAString, DataType.String>;
}
export interface UAClampBlock extends Omit<UAAssetConnector, "name">, UAClampBlock_Base {}