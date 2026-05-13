import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { EnumEnergySource } from "./enum_energy_source";
import type { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device";
import type { UAFryingPanParameter } from "./ua_frying_pan_parameter";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FryingPanDeviceType i=1009                                  |
 * |isAbstract      |false                                                       |
 */
export interface UAFryingPanDevice_Base extends UACommercialKitchenDevice_Base {
    energySource: UAProperty<EnumEnergySource, DataType.Int32>;
    fryingPan: UAFryingPanParameter;
    isWithPressure: UAProperty<boolean, DataType.Boolean>;
}
export interface UAFryingPanDevice extends UACommercialKitchenDevice, UAFryingPanDevice_Base {}