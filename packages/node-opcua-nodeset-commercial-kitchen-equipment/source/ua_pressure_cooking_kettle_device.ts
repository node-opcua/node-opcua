import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { EnumEnergySource } from "./enum_energy_source";
import type { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device";
import type { UAPressureCookingKettleParameter } from "./ua_pressure_cooking_kettle_parameter";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PressureCookingKettleDeviceType i=1015                      |
 * |isAbstract      |false                                                       |
 */
export interface UAPressureCookingKettleDevice_Base extends UACommercialKitchenDevice_Base {
    energySource: UAProperty<EnumEnergySource, DataType.Int32>;
    pressureCookingKettle: UAPressureCookingKettleParameter;
}
export interface UAPressureCookingKettleDevice extends UACommercialKitchenDevice, UAPressureCookingKettleDevice_Base {}