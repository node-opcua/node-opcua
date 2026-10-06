import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt16 } from "node-opcua-basic-types";
import type { UAMultiStateValueDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_value_discrete.js";
import type { DataType } from "node-opcua-variant";

import type { UAAssetConnector, UAAssetConnector_Base } from "./ua_asset_connector.js";

// ----- this file has been automatically generated - do not edit

/**
 * SocketType represents a physical socket where a
 * cable can be connected
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SocketType i=8                                              |
 * |isAbstract      |false                                                       |
 */
export interface UASocket_Base extends UAAssetConnector_Base {
    kind?: UAMultiStateValueDiscrete<UInt16, DataType.UInt16>;
    name: UAProperty<UAString, DataType.String>;
}
export interface UASocket extends Omit<UAAssetConnector, "name">, UASocket_Base {}