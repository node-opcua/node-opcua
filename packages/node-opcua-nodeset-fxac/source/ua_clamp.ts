import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt16 } from "node-opcua-basic-types";
import type { UAMultiStateValueDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_value_discrete.js";
import type { DataType } from "node-opcua-variant";

import type { UAAssetConnector, UAAssetConnector_Base } from "./ua_asset_connector.js";

// ----- this file has been automatically generated - do not edit

/**
 * ClampType represents a wire connection
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ClampType i=10                                              |
 * |isAbstract      |false                                                       |
 */
export interface UAClamp_Base extends UAAssetConnector_Base {
    kind?: UAMultiStateValueDiscrete<UInt16, DataType.UInt16>;
    name: UAProperty<UAString, DataType.String>;
}
export interface UAClamp extends Omit<UAAssetConnector, "name">, UAClamp_Base {}