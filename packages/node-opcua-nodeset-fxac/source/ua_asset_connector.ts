import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt16 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * AssetConnectorType provides information about
 * physical connections that are part of an asset
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AssetConnectorType i=5                                      |
 * |isAbstract      |true                                                        |
 */
export interface UAAssetConnector_Base {
    id?: UAProperty<UInt16, DataType.UInt16>;
    name?: UAProperty<UAString, DataType.String>;
}
export interface UAAssetConnector extends UAObject, UAAssetConnector_Base {}