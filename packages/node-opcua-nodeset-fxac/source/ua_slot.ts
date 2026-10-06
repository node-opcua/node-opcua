import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt16 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UAAssetConnector, UAAssetConnector_Base } from "./ua_asset_connector.js";

// ----- this file has been automatically generated - do not edit

/**
 * SlotType represents a physical slot where a
 * module can attach
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SlotType i=6                                                |
 * |isAbstract      |false                                                       |
 */
export interface UASlot_Base extends UAAssetConnector_Base {
    id: UAProperty<UInt16, DataType.UInt16>;
    logicalId?: UAProperty<UInt16, DataType.UInt16>;
}
export interface UASlot extends Omit<UAAssetConnector, "id">, UASlot_Base {}